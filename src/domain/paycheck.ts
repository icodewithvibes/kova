/**
 * Paycheck-level deterministic calculations: net pay, reconciliation,
 * and provenance classification of extracted fields.
 */
import { abs, subtract, sum, usd, type Money } from "./money";
import type { DataSource, PaycheckDeduction, SourcedValue } from "./types";

/** Net pay = gross − all deductions. Deterministic; used to cross-check OCR. */
export function calculateNetPay(gross: Money, deductions: readonly PaycheckDeduction[]): Money {
  return subtract(gross, sum(deductions.map((d) => d.amount)));
}

/** Tolerance for OCR reconciliation: gross − deductions ≈ net within $1.00. */
export const RECONCILE_TOLERANCE = usd(1_00);

export interface ReconciliationResult {
  readonly reconciles: boolean;
  readonly computedNet: Money;
  readonly statedNet: Money;
  readonly difference: Money;
}

export function reconcilePaycheck(
  gross: Money,
  deductions: readonly PaycheckDeduction[],
  statedNet: Money,
): ReconciliationResult {
  const computedNet = calculateNetPay(gross, deductions);
  const difference = abs(subtract(computedNet, statedNet));
  return {
    reconciles: difference.amount <= RECONCILE_TOLERANCE.amount,
    computedNet,
    statedNet,
    difference,
  };
}

/** Confidence below this on money-critical fields forces "needs review". */
export const CRITICAL_FIELD_CONFIDENCE_THRESHOLD = 0.9;

export interface FieldClassificationInput {
  /** Where the value came from mechanically. */
  readonly origin: "ocr" | "manual" | "computed" | "suggestion";
  readonly confidence?: number;
  /** Money-critical fields (net, gross, deductions) get the strict threshold. */
  readonly critical: boolean;
  /** Set when a deterministic cross-check disagreed with this value. */
  readonly conflictsWithComputed?: boolean;
}

/**
 * classifyPaycheckFieldSource — single source of truth for the mandatory
 * data-provenance labels ("From paystub", "You entered this", "Estimated",
 * "Suggested by Kova", "Needs review").
 */
export function classifyPaycheckFieldSource(input: FieldClassificationInput): {
  source: DataSource;
  needsReview: boolean;
} {
  const source: DataSource =
    input.origin === "ocr"
      ? "paystub"
      : input.origin === "manual"
        ? "user_entered"
        : input.origin === "computed"
          ? "estimated"
          : "kova_suggested";

  const lowConfidence =
    input.origin === "ocr" &&
    input.confidence !== undefined &&
    input.confidence < (input.critical ? CRITICAL_FIELD_CONFIDENCE_THRESHOLD : 0.75);

  return {
    source,
    needsReview: lowConfidence || input.conflictsWithComputed === true,
  };
}

export function sourceLabel(source: DataSource): string {
  switch (source) {
    case "paystub":
      return "From paystub";
    case "user_entered":
      return "You entered this";
    case "estimated":
      return "Estimated";
    case "kova_suggested":
      return "Suggested by Kova";
  }
}

export function describeSourcedMoney(v: SourcedValue<Money>): string {
  const base = sourceLabel(v.source);
  return v.needsReview ? `${base} · Needs review` : base;
}
