/**
 * Domain value types shared across the deterministic financial engine.
 * Framework-free. Persistence-shaped entities live in src/data/schema.ts and
 * map onto these.
 */
import type { Money } from "./money";

/** Calendar date as ISO "YYYY-MM-DD" — timezone-free by construction. */
export type IsoDate = string;

/** Provenance label — mandatory on every displayed financial value. */
export type DataSource =
  | "paystub" // "From paystub"
  | "user_entered" // "You entered this"
  | "estimated" // "Estimated"
  | "kova_suggested"; // "Suggested by Kova"

export interface SourcedValue<T> {
  readonly value: T;
  readonly source: DataSource;
  /** 0–1; only meaningful for extracted values. */
  readonly confidence?: number;
  /** True when OCR confidence is low or values conflict — "Needs review". */
  readonly needsReview: boolean;
  /** Raw label seen on the document, e.g. "FED W/H". */
  readonly rawLabel?: string;
}

export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly" | "irregular";

export type BillCategory =
  | "housing"
  | "utilities"
  | "phone"
  | "transport"
  | "subscriptions"
  | "debt"
  | "insurance"
  | "other";

export interface BillDue {
  readonly id: string;
  readonly name: string;
  readonly amount: Money;
  readonly dueDate: IsoDate;
  readonly category: BillCategory;
}

export type GoalPriority = "high" | "medium" | "low";

export interface GoalAllocationInput {
  readonly id: string;
  readonly name: string;
  readonly price: Money;
  readonly saved: Money;
  readonly perCheckContribution: Money;
  readonly priority: GoalPriority;
  readonly paused: boolean;
  readonly targetDate?: IsoDate;
}

export type AllocationCategory =
  | "bill"
  | "buffer"
  | "goal"
  | "future_fund"
  | "flexible";

export type ReasonCode =
  | "bill_due_before_next_payday"
  | "buffer_minimum"
  | "goal_minimum_contribution"
  | "future_fund_user_setting"
  | "flexible_remainder"
  | "shortfall_bill_unfunded"
  | "shortfall_buffer_reduced"
  | "shortfall_goal_reduced"
  | "shortfall_future_fund_skipped";

export interface Allocation {
  readonly id: string;
  readonly category: AllocationCategory;
  /** Refers to a bill id or goal id when applicable. */
  readonly refId?: string;
  readonly label: string;
  /** What the plan wants to set aside. */
  readonly planned: Money;
  /** What available money actually covered. funded <= planned always. */
  readonly funded: Money;
  readonly priorityRank: number;
  readonly reason: ReasonCode;
}

export interface Shortfall {
  /** Total planned minus total fundable. */
  readonly amount: Money;
  /** Human-readable, shame-free explanation lines. */
  readonly explanations: readonly string[];
  /** Categories that were reduced or skipped, in priority order. */
  readonly affected: readonly AllocationCategory[];
}

export type PlanStatus = "proposed" | "approved" | "needs_attention";

export interface AllocationPlan {
  readonly paycheckId: string;
  readonly netPay: Money;
  readonly payDate: IsoDate;
  readonly nextPayDate: IsoDate;
  readonly allocations: readonly Allocation[];
  /** Funded flexible money — the safe-to-spend pool at plan time. */
  readonly safeToSpend: Money;
  readonly status: PlanStatus;
  readonly shortfall?: Shortfall;
}

export interface PaycheckDeduction {
  readonly label: string;
  readonly amount: Money;
  readonly kind:
    | "federal_withholding"
    | "state_withholding"
    | "social_security"
    | "medicare"
    | "retirement"
    | "insurance"
    | "other";
}

export interface PlanValidationIssue {
  readonly severity: "error" | "warning";
  readonly code:
    | "over_allocated"
    | "negative_allocation"
    | "funded_exceeds_planned"
    | "duplicate_bill"
    | "sum_mismatch";
  readonly message: string;
}
