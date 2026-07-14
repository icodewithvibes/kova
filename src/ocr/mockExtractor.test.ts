import { describe, expect, it } from "vitest";
import { reconcilePaycheck } from "@/domain/paycheck";
import type { PaycheckDeduction } from "@/domain/types";
import { MockPaystubExtractor } from "./mockExtractor";

const dates = { payDate: "2026-07-24", periodStart: "2026-07-05", periodEnd: "2026-07-18" };

function deductionsOf(x: {
  federalWithholding: { value: { amount: number } };
  stateWithholding: { value: { amount: number } };
  socialSecurity: { value: { amount: number } };
  medicare: { value: { amount: number } };
  otherDeductions: { value: { amount: number } };
}): PaycheckDeduction[] {
  return [
    { label: "fed", amount: x.federalWithholding.value as never, kind: "federal_withholding" },
    { label: "state", amount: x.stateWithholding.value as never, kind: "state_withholding" },
    { label: "ss", amount: x.socialSecurity.value as never, kind: "social_security" },
    { label: "medicare", amount: x.medicare.value as never, kind: "medicare" },
    { label: "other", amount: x.otherDeductions.value as never, kind: "other" },
  ];
}

describe("MockPaystubExtractor", () => {
  const extractor = new MockPaystubExtractor(dates);

  it("clean-scan reconciles within tolerance and flags exactly the low-confidence fields", async () => {
    const x = await extractor.extract({ fixtureKey: "clean-scan" });
    const r = reconcilePaycheck(x.gross.value, deductionsOf(x), x.net.value);
    expect(r.reconciles).toBe(true);
    expect(x.tips?.requiresReview).toBe(true); // 0.84 < 0.90 critical
    expect(x.stateWithholding.requiresReview).toBe(true); // 0.87 < 0.90 critical
    expect(x.gross.requiresReview).toBe(false);
    expect(x.net.requiresReview).toBe(false);
  });

  it("blurry-photo does NOT reconcile — forcing the mismatch banner", async () => {
    const x = await extractor.extract({ fixtureKey: "blurry-photo" });
    const r = reconcilePaycheck(x.gross.value, deductionsOf(x), x.net.value);
    expect(r.reconciles).toBe(false);
    expect(r.difference.amount).toBeGreaterThan(100);
  });

  it("every extracted field carries the strict schema: source, method, review flag", async () => {
    const x = await extractor.extract({ fixtureKey: "clean-scan" });
    for (const field of [x.employer, x.payDate, x.gross, x.net, x.federalWithholding]) {
      expect(field.source).toBe("paystub");
      expect(field.method).toBe("mock_ocr");
      expect(typeof field.requiresReview).toBe("boolean");
      expect(field.confidence).toBeGreaterThan(0);
      expect(field.confidence).toBeLessThanOrEqual(1);
      expect(field.rawLabel).toBeTruthy();
    }
  });

  it("rejects unknown fixtures", async () => {
    await expect(extractor.extract({ fixtureKey: "real-paystub" })).rejects.toThrow();
  });
});
