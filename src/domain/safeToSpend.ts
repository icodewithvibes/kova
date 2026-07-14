/**
 * Safe-to-spend: the flexible pool from the current plan minus flexible
 * expenses logged since the pay date.
 *
 * IMPORTANT FRAMING: safe-to-spend is "unallocated money from this paycheck".
 * Kova never claims to know a bank balance it was not given.
 */
import { ZERO, floorZero, isPositive, subtract, sum, type Money } from "./money";
import type { AllocationPlan, IsoDate } from "./types";

export interface ExpenseEntry {
  readonly id: string;
  readonly amount: Money;
  readonly date: IsoDate;
  readonly label: string;
  /** Expenses can draw from flexible (default) or from a named allocation. */
  readonly allocationCategory?: "flexible" | "bill" | "goal";
}

export interface SafeToSpendResult {
  /** Never negative — display value. */
  readonly amount: Money;
  /** Raw remainder; negative when flexible spending exceeded the pool. */
  readonly rawRemainder: Money;
  readonly overspent: boolean;
  readonly overspendAmount: Money;
  readonly flexibleSpent: Money;
  readonly flexiblePool: Money;
  readonly until: IsoDate;
}

/** Deterministic safe-to-spend from a plan plus logged expenses. */
export function calculateSafeToSpend(
  plan: AllocationPlan,
  expenses: readonly ExpenseEntry[],
): SafeToSpendResult {
  const inPeriod = expenses.filter(
    (e) =>
      e.date >= plan.payDate &&
      e.date <= plan.nextPayDate &&
      (e.allocationCategory ?? "flexible") === "flexible",
  );
  const flexibleSpent = sum(inPeriod.map((e) => e.amount));
  const raw = subtract(plan.safeToSpend, flexibleSpent);
  const overspend = raw.amount < 0 ? subtract(flexibleSpent, plan.safeToSpend) : ZERO;
  return {
    amount: floorZero(raw),
    rawRemainder: raw,
    overspent: isPositive(overspend),
    overspendAmount: overspend,
    flexibleSpent,
    flexiblePool: plan.safeToSpend,
    until: plan.nextPayDate,
  };
}

/** Cash left after protecting a set of obligations — building block for scenarios. */
export function calculateAvailableCash(netPay: Money, protectedAmounts: readonly Money[]): Money {
  return floorZero(subtract(netPay, sum(protectedAmounts)));
}
