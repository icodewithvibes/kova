/**
 * Goal completion forecasting — deterministic, paycheck-granular.
 */
import { isPositive, subtract, type Money } from "./money";
import { upcomingPayDates } from "./payPeriod";
import type { GoalAllocationInput, IsoDate, PayFrequency } from "./types";

export interface GoalForecast {
  readonly goalId: string;
  /** Remaining amount still to save. */
  readonly remaining: Money;
  /** Number of future paychecks needed at the current contribution. Null when unforecastable. */
  readonly checksNeeded: number | null;
  /** Projected completion pay date. Null when unforecastable (paused, zero contribution, irregular pay). */
  readonly completionDate: IsoDate | null;
  readonly reason:
    | "on_track"
    | "already_complete"
    | "no_contribution"
    | "paused"
    | "irregular_income";
}

const FORECAST_HORIZON_CHECKS = 520; // ten years of weekly checks — hard stop

export function forecastGoalCompletion(
  goal: GoalAllocationInput,
  frequency: PayFrequency,
  anchorPayDate: IsoDate,
  fromDate: IsoDate,
): GoalForecast {
  const remaining = subtract(goal.price, goal.saved);

  if (!isPositive(remaining)) {
    return {
      goalId: goal.id,
      remaining,
      checksNeeded: 0,
      completionDate: fromDate,
      reason: "already_complete",
    };
  }
  if (goal.paused) {
    return { goalId: goal.id, remaining, checksNeeded: null, completionDate: null, reason: "paused" };
  }
  if (!isPositive(goal.perCheckContribution)) {
    return {
      goalId: goal.id,
      remaining,
      checksNeeded: null,
      completionDate: null,
      reason: "no_contribution",
    };
  }

  const checksNeeded = Math.ceil(remaining.amount / goal.perCheckContribution.amount);
  if (checksNeeded > FORECAST_HORIZON_CHECKS || frequency === "irregular") {
    // Irregular income: we can count checks but not date them honestly.
    return {
      goalId: goal.id,
      remaining,
      checksNeeded: frequency === "irregular" ? checksNeeded : null,
      completionDate: null,
      reason: frequency === "irregular" ? "irregular_income" : "no_contribution",
    };
  }

  const dates = upcomingPayDates(frequency, anchorPayDate, fromDate, checksNeeded);
  const completionDate = dates[checksNeeded - 1] ?? null;
  return {
    goalId: goal.id,
    remaining,
    checksNeeded,
    completionDate,
    reason: "on_track",
  };
}
