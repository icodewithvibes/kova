/**
 * Jurisdiction tax-estimation adapter — PLANNING ONLY.
 *
 * Every figure produced here is an illustrative estimate. Direct paystub
 * withholding always outranks these estimates. Kova makes no compliance
 * claims and gives no tax advice.
 */
import type { Money } from "../money";
import type { PayFrequency } from "../types";

export const TAX_DISCLAIMER =
  "Estimate — not tax, legal, or financial advice. Verify with your paystub, employer, or a qualified professional.";

export interface TaxEstimateInput {
  readonly grossPerCheck: Money;
  readonly frequency: Exclude<PayFrequency, "irregular">;
}

export interface TaxLineEstimate {
  readonly label: string;
  readonly amount: Money;
  readonly kind: "income_tax" | "payroll_tax" | "other";
}

export interface TaxEstimate {
  readonly jurisdictionId: string;
  readonly jurisdictionLabel: string;
  readonly illustrative: boolean;
  readonly lines: readonly TaxLineEstimate[];
  readonly totalEstimated: Money;
  readonly estimatedNet: Money;
  readonly disclaimer: string;
}

export interface TaxJurisdictionAdapter {
  readonly id: string;
  readonly label: string;
  /** True when rules are illustrative rather than verified legal data. */
  readonly illustrative: boolean;
  estimate(input: TaxEstimateInput): TaxEstimate;
}
