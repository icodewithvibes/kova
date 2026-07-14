/**
 * The Kova allocation engine.
 *
 * Deterministic waterfall over a confirmed net paycheck:
 *   1. Required bills due before the next expected payday
 *   2. Required minimum safety buffer
 *   3. User-approved minimum goal contributions
 *   4. User-defined future/business fund
 *   5. Flexible safe-to-spend remainder
 *
 * If money runs out mid-waterfall the plan NEVER over-allocates: lower
 * priorities are reduced or skipped, the plan is marked `needs_attention`,
 * and the shortfall is explained without judgment.
 */
import {
  ZERO,
  add,
  formatMoney,
  isPositive,
  min,
  subtract,
  sum,
  usd,
  type Money,
} from "./money";
import { calculateMinimumBuffer, calculateProtectedBills, type BufferPolicy } from "./bills";
import type {
  Allocation,
  AllocationPlan,
  BillDue,
  GoalAllocationInput,
  IsoDate,
  PlanValidationIssue,
  Shortfall,
} from "./types";

export interface AllocationPlanInput {
  readonly paycheckId: string;
  readonly netPay: Money;
  readonly payDate: IsoDate;
  readonly nextPayDate: IsoDate;
  readonly bills: readonly BillDue[];
  readonly bufferPolicy: BufferPolicy;
  readonly goals: readonly GoalAllocationInput[];
  /** Optional user-defined future/business fund per check. */
  readonly futureFundPerCheck: Money;
}

const GOAL_PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function generateAllocationPlan(input: AllocationPlanInput): AllocationPlan {
  const allocations: Allocation[] = [];
  const explanations: string[] = [];
  const affected: Shortfall["affected"][number][] = [];
  let remaining = input.netPay;
  let rank = 0;
  let shortfallTotal = ZERO;

  const fund = (planned: Money): Money => {
    const funded = min(planned, remaining.amount > 0 ? remaining : ZERO);
    remaining = subtract(remaining, funded);
    return funded;
  };

  // 1. Bills due before next payday, earliest due first.
  const { bills } = calculateProtectedBills(input.bills, input.payDate, input.nextPayDate);
  for (const bill of bills) {
    const funded = fund(bill.amount);
    const short = subtract(bill.amount, funded);
    if (isPositive(short)) {
      shortfallTotal = add(shortfallTotal, short);
      if (!affected.includes("bill")) affected.push("bill");
      explanations.push(
        `${bill.name} (${formatMoney(bill.amount)}, due ${bill.dueDate}) is ${formatMoney(short)} short this period.`,
      );
    }
    allocations.push({
      id: `alloc-bill-${bill.id}`,
      category: "bill",
      refId: bill.id,
      label: bill.name,
      planned: bill.amount,
      funded,
      priorityRank: rank++,
      reason: isPositive(short) ? "shortfall_bill_unfunded" : "bill_due_before_next_payday",
    });
  }

  // 2. Minimum safety buffer.
  const bufferPlanned = calculateMinimumBuffer(input.netPay, input.bufferPolicy);
  if (isPositive(bufferPlanned)) {
    const funded = fund(bufferPlanned);
    const short = subtract(bufferPlanned, funded);
    if (isPositive(short)) {
      shortfallTotal = add(shortfallTotal, short);
      affected.push("buffer");
      explanations.push(
        `The safety buffer could only receive ${formatMoney(funded)} of its usual ${formatMoney(bufferPlanned)}.`,
      );
    }
    allocations.push({
      id: "alloc-buffer",
      category: "buffer",
      label: "Safety buffer",
      planned: bufferPlanned,
      funded,
      priorityRank: rank++,
      reason: isPositive(short) ? "shortfall_buffer_reduced" : "buffer_minimum",
    });
  }

  // 3. Goal minimum contributions — high priority first, then by name for determinism.
  const activeGoals = input.goals
    .filter((g) => !g.paused && isPositive(g.perCheckContribution))
    .sort(
      (a, b) =>
        GOAL_PRIORITY_ORDER[a.priority] - GOAL_PRIORITY_ORDER[b.priority] ||
        a.name.localeCompare(b.name),
    );
  for (const goal of activeGoals) {
    // Never contribute past the goal's remaining need.
    const remainingNeed = subtract(goal.price, goal.saved);
    const planned = min(goal.perCheckContribution, remainingNeed.amount > 0 ? remainingNeed : ZERO);
    if (!isPositive(planned)) continue;
    const funded = fund(planned);
    const short = subtract(planned, funded);
    if (isPositive(short)) {
      shortfallTotal = add(shortfallTotal, short);
      if (!affected.includes("goal")) affected.push("goal");
      explanations.push(
        `${goal.name} received ${formatMoney(funded)} instead of ${formatMoney(planned)} this check.`,
      );
    }
    allocations.push({
      id: `alloc-goal-${goal.id}`,
      category: "goal",
      refId: goal.id,
      label: goal.name,
      planned,
      funded,
      priorityRank: rank++,
      reason: isPositive(short) ? "shortfall_goal_reduced" : "goal_minimum_contribution",
    });
  }

  // 4. Future / business fund.
  if (isPositive(input.futureFundPerCheck)) {
    const funded = fund(input.futureFundPerCheck);
    const short = subtract(input.futureFundPerCheck, funded);
    if (isPositive(short)) {
      shortfallTotal = add(shortfallTotal, short);
      affected.push("future_fund");
      explanations.push(`The future fund was paused for this check.`);
    }
    allocations.push({
      id: "alloc-future",
      category: "future_fund",
      label: "Future fund",
      planned: input.futureFundPerCheck,
      funded,
      priorityRank: rank++,
      reason: isPositive(short) ? "shortfall_future_fund_skipped" : "future_fund_user_setting",
    });
  }

  // 5. Flexible remainder — whatever is left is safe to spend.
  const flexible = remaining.amount > 0 ? remaining : ZERO;
  allocations.push({
    id: "alloc-flexible",
    category: "flexible",
    label: "Flexible spending",
    planned: flexible,
    funded: flexible,
    priorityRank: rank,
    reason: "flexible_remainder",
  });

  const hasShortfall = isPositive(shortfallTotal);
  return {
    paycheckId: input.paycheckId,
    netPay: input.netPay,
    payDate: input.payDate,
    nextPayDate: input.nextPayDate,
    allocations,
    safeToSpend: flexible,
    status: hasShortfall ? "needs_attention" : "proposed",
    ...(hasShortfall
      ? {
          shortfall: {
            amount: shortfallTotal,
            explanations,
            affected,
          } satisfies Shortfall,
        }
      : {}),
  };
}

/** Invariant checks — run on every generated or AI-proposed plan before display. */
export function validateAllocationPlan(plan: AllocationPlan): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];
  let fundedTotal = ZERO;

  for (const a of plan.allocations) {
    if (a.planned.amount < 0 || a.funded.amount < 0) {
      issues.push({
        severity: "error",
        code: "negative_allocation",
        message: `"${a.label}" has a negative amount.`,
      });
    }
    if (a.funded.amount > a.planned.amount) {
      issues.push({
        severity: "error",
        code: "funded_exceeds_planned",
        message: `"${a.label}" funded more than planned.`,
      });
    }
    fundedTotal = add(fundedTotal, a.funded);
  }

  if (fundedTotal.amount > plan.netPay.amount) {
    issues.push({
      severity: "error",
      code: "over_allocated",
      message: `Allocations (${formatMoney(fundedTotal)}) exceed net pay (${formatMoney(plan.netPay)}).`,
    });
  }

  // Funded totals must account for every cent of net pay when net is positive.
  if (plan.netPay.amount > 0 && fundedTotal.amount !== plan.netPay.amount) {
    issues.push({
      severity: "error",
      code: "sum_mismatch",
      message: `Allocations sum to ${formatMoney(fundedTotal)} but net pay is ${formatMoney(plan.netPay)}.`,
    });
  }

  const billRefs = plan.allocations.filter((a) => a.category === "bill").map((a) => a.refId);
  if (new Set(billRefs).size !== billRefs.length) {
    issues.push({
      severity: "error",
      code: "duplicate_bill",
      message: "The same bill appears twice in this plan.",
    });
  }

  return issues;
}

/** Convenience totals for rendering plan lanes. */
export function planTotals(plan: AllocationPlan): Record<string, Money> {
  const totals: Record<string, Money> = {
    bill: ZERO,
    buffer: ZERO,
    goal: ZERO,
    future_fund: ZERO,
    flexible: ZERO,
  };
  for (const a of plan.allocations) {
    totals[a.category] = add(totals[a.category] ?? ZERO, a.funded);
  }
  return totals;
}

/** Sum of everything protected (non-flexible). */
export function protectedTotal(plan: AllocationPlan): Money {
  return sum(plan.allocations.filter((a) => a.category !== "flexible").map((a) => a.funded));
}

export { usd };
