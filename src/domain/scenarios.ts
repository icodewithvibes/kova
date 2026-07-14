/**
 * Scenario comparison and expense simulation.
 * Scenario browsing NEVER mutates the live plan — these functions are pure.
 */
import { daysBetween } from "./payPeriod";
import { ZERO, formatMoney, multiplyRatio, subtract, type Money } from "./money";
import { generateAllocationPlan, planTotals, type AllocationPlanInput } from "./allocation";
import { forecastGoalCompletion, type GoalForecast } from "./forecast";
import { calculateSafeToSpend, type ExpenseEntry } from "./safeToSpend";
import type { AllocationPlan, GoalAllocationInput, IsoDate, PayFrequency } from "./types";

export type ScenarioKind = "conservative" | "balanced" | "faster_goal";

export interface ScenarioKnobs {
  /** Multiplier on goal contributions, in percent (100 = unchanged). */
  readonly goalPercent: number;
  /** Multiplier on buffer percent-of-net, in percent. */
  readonly bufferPercent: number;
}

export const SCENARIO_PRESETS: Record<ScenarioKind, ScenarioKnobs> = {
  conservative: { goalPercent: 60, bufferPercent: 150 },
  balanced: { goalPercent: 100, bufferPercent: 100 },
  faster_goal: { goalPercent: 150, bufferPercent: 100 },
};

export interface ScenarioResult {
  readonly kind: ScenarioKind;
  readonly plan: AllocationPlan;
  readonly safeToSpend: Money;
  readonly totalToGoals: Money;
  readonly totalToBuffer: Money;
  readonly primaryGoalForecast: GoalForecast | null;
  /** Days sooner (positive) or later (negative) vs the balanced scenario. */
  readonly goalDaysDelta: number | null;
  readonly explanation: string;
}

function applyKnobs(input: AllocationPlanInput, knobs: ScenarioKnobs): AllocationPlanInput {
  return {
    ...input,
    bufferPolicy: {
      ...input.bufferPolicy,
      percentOfNet: (input.bufferPolicy.percentOfNet * knobs.bufferPercent) / 100,
    },
    goals: input.goals.map((g) => ({
      ...g,
      perCheckContribution: multiplyRatio(g.perCheckContribution, knobs.goalPercent, 100),
    })),
  };
}

function primaryGoal(goals: readonly GoalAllocationInput[]): GoalAllocationInput | null {
  const active = goals.filter((g) => !g.paused);
  if (active.length === 0) return null;
  const order = { high: 0, medium: 1, low: 2 } as const;
  return [...active].sort(
    (a, b) => order[a.priority] - order[b.priority] || a.name.localeCompare(b.name),
  )[0]!;
}

/** Compare the three preset scenarios against one paycheck input. Pure. */
export function compareScenarios(
  input: AllocationPlanInput,
  frequency: PayFrequency,
  anchorPayDate: IsoDate,
): ScenarioResult[] {
  const baseline = buildScenario(input, "balanced", frequency, anchorPayDate, null);
  const kinds: ScenarioKind[] = ["conservative", "balanced", "faster_goal"];
  return kinds.map((kind) =>
    kind === "balanced" ? baseline : buildScenario(input, kind, frequency, anchorPayDate, baseline),
  );
}

function buildScenario(
  input: AllocationPlanInput,
  kind: ScenarioKind,
  frequency: PayFrequency,
  anchorPayDate: IsoDate,
  baseline: ScenarioResult | null,
): ScenarioResult {
  const knobbed = applyKnobs(input, SCENARIO_PRESETS[kind]);
  const plan = generateAllocationPlan(knobbed);
  const totals = planTotals(plan);
  const goal = primaryGoal(knobbed.goals);
  const forecast = goal
    ? forecastGoalCompletion(goal, frequency, anchorPayDate, plan.payDate)
    : null;

  let goalDaysDelta: number | null = null;
  if (
    baseline?.primaryGoalForecast?.completionDate &&
    forecast?.completionDate
  ) {
    goalDaysDelta = daysBetween(forecast.completionDate, baseline.primaryGoalForecast.completionDate);
  }

  const explanation = buildExplanation(kind, plan, goalDaysDelta, goal?.name ?? null);
  return {
    kind,
    plan,
    safeToSpend: plan.safeToSpend,
    totalToGoals: totals["goal"]!,
    totalToBuffer: totals["buffer"]!,
    primaryGoalForecast: forecast,
    goalDaysDelta,
    explanation,
  };
}

function buildExplanation(
  kind: ScenarioKind,
  plan: AllocationPlan,
  goalDaysDelta: number | null,
  goalName: string | null,
): string {
  const spend = formatMoney(plan.safeToSpend);
  const timing =
    goalDaysDelta === null || goalName === null || goalDaysDelta === 0
      ? ""
      : goalDaysDelta > 0
        ? ` ${goalName} finishes about ${goalDaysDelta} days sooner.`
        : ` ${goalName} takes about ${-goalDaysDelta} more days.`;
  switch (kind) {
    case "conservative":
      return `More cushion, slower goals. ${spend} stays flexible.${timing}`;
    case "balanced":
      return `Your current setup. ${spend} stays flexible.`;
    case "faster_goal":
      return `Goals move faster, less flexible money. ${spend} stays flexible.${timing}`;
  }
}

export interface ExpenseImpact {
  readonly expense: Money;
  readonly safeToSpendBefore: Money;
  readonly safeToSpendAfter: Money;
  readonly fits: boolean;
  /** Amount that would exceed the flexible pool if spent anyway. */
  readonly exceedsBy: Money;
  /** Plain-language consequence. Bills and goals are untouched by flexible spending. */
  readonly explanation: string;
}

/** "What happens if I spend $X?" — pure simulation against the live plan. */
export function simulateExpenseImpact(
  plan: AllocationPlan,
  loggedExpenses: readonly ExpenseEntry[],
  candidate: Money,
): ExpenseImpact {
  const before = calculateSafeToSpend(plan, loggedExpenses);
  const after = subtract(before.amount, candidate);
  const fits = after.amount >= 0;
  const exceedsBy = fits ? ZERO : subtract(candidate, before.amount);
  const explanation = fits
    ? `After a ${formatMoney(candidate)} purchase you would have ${formatMoney(after)} safe to spend until ${plan.nextPayDate}. Your bills and goal contributions stay protected.`
    : `A ${formatMoney(candidate)} purchase goes ${formatMoney(exceedsBy)} past your flexible money. Bills and goals stay protected, but the extra would need to come from somewhere else.`;
  return {
    expense: candidate,
    safeToSpendBefore: before.amount,
    safeToSpendAfter: fits ? after : before.amount,
    fits,
    exceedsBy,
    explanation,
  };
}
