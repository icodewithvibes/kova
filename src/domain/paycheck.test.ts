import { describe, expect, it } from "vitest";
import {
  calculateNetPay,
  classifyPaycheckFieldSource,
  reconcilePaycheck,
  sourceLabel,
} from "./paycheck";
import { usd } from "./money";
import type { PaycheckDeduction } from "./types";

const deductions: PaycheckDeduction[] = [
  { label: "FED W/H", amount: usd(18_000), kind: "federal_withholding" },
  { label: "STATE W/H", amount: usd(5_000), kind: "state_withholding" },
  { label: "OASDI", amount: usd(7_440), kind: "social_security" },
  { label: "MEDICARE", amount: usd(1_740), kind: "medicare" },
];

describe("calculateNetPay", () => {
  it("subtracts all deductions from gross", () => {
    expect(calculateNetPay(usd(120_000), deductions).amount).toBe(87_820);
  });
  it("no deductions → net equals gross", () => {
    expect(calculateNetPay(usd(120_000), []).amount).toBe(120_000);
  });
});

describe("reconcilePaycheck", () => {
  it("passes within $1.00 tolerance", () => {
    const r = reconcilePaycheck(usd(120_000), deductions, usd(87_900));
    expect(r.reconciles).toBe(true);
    expect(r.difference.amount).toBe(80);
  });
  it("fails outside tolerance", () => {
    const r = reconcilePaycheck(usd(120_000), deductions, usd(90_000));
    expect(r.reconciles).toBe(false);
    expect(r.difference.amount).toBe(2_180);
  });
});

describe("classifyPaycheckFieldSource", () => {
  it("high-confidence OCR on critical field → paystub, no review", () => {
    expect(classifyPaycheckFieldSource({ origin: "ocr", confidence: 0.97, critical: true })).toEqual(
      { source: "paystub", needsReview: false },
    );
  });
  it("low-confidence OCR on critical field → needs review", () => {
    expect(classifyPaycheckFieldSource({ origin: "ocr", confidence: 0.82, critical: true })).toEqual(
      { source: "paystub", needsReview: true },
    );
  });
  it("critical threshold is stricter than non-critical", () => {
    expect(
      classifyPaycheckFieldSource({ origin: "ocr", confidence: 0.85, critical: false }).needsReview,
    ).toBe(false);
    expect(
      classifyPaycheckFieldSource({ origin: "ocr", confidence: 0.85, critical: true }).needsReview,
    ).toBe(true);
  });
  it("manual entry is trusted", () => {
    expect(classifyPaycheckFieldSource({ origin: "manual", critical: true })).toEqual({
      source: "user_entered",
      needsReview: false,
    });
  });
  it("computed values are estimates", () => {
    expect(classifyPaycheckFieldSource({ origin: "computed", critical: false }).source).toBe(
      "estimated",
    );
  });
  it("conflict with deterministic cross-check forces review even at high confidence", () => {
    expect(
      classifyPaycheckFieldSource({
        origin: "ocr",
        confidence: 0.99,
        critical: true,
        conflictsWithComputed: true,
      }).needsReview,
    ).toBe(true);
  });
});

describe("sourceLabel", () => {
  it("uses the mandatory label wording", () => {
    expect(sourceLabel("paystub")).toBe("From paystub");
    expect(sourceLabel("user_entered")).toBe("You entered this");
    expect(sourceLabel("estimated")).toBe("Estimated");
    expect(sourceLabel("kova_suggested")).toBe("Suggested by Kova");
  });
});
