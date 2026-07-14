import { describe, expect, it } from "vitest";
import { usd } from "../money";
import { TAX_DISCLAIMER } from "./adapter";
import { estimatePaycheckTaxes, illustriaAdapter } from "./mockRegion";

describe("illustria tax adapter (illustrative only)", () => {
  const estimate = illustriaAdapter.estimate({ grossPerCheck: usd(120_000), frequency: "biweekly" });

  it("is permanently labeled illustrative with the disclaimer", () => {
    expect(illustriaAdapter.illustrative).toBe(true);
    expect(estimate.illustrative).toBe(true);
    expect(estimate.disclaimer).toBe(TAX_DISCLAIMER);
    expect(estimate.disclaimer).toMatch(/not tax, legal, or financial advice/);
  });

  it("estimated net = gross − total estimated, exactly", () => {
    expect(estimate.estimatedNet.amount).toBe(120_000 - estimate.totalEstimated.amount);
  });

  it("payroll lines are flat percentages of gross", () => {
    const social = estimate.lines.find((l) => l.label.startsWith("Social"))!;
    const care = estimate.lines.find((l) => l.label.startsWith("Care"))!;
    expect(social.amount.amount).toBe(7_440); // 6.2% of 120000
    expect(care.amount.amount).toBe(1_740); // 1.45% of 120000
  });

  it("progressive income tax grows with income", () => {
    const low = illustriaAdapter.estimate({ grossPerCheck: usd(60_000), frequency: "biweekly" });
    const high = illustriaAdapter.estimate({ grossPerCheck: usd(300_000), frequency: "biweekly" });
    const lowRate = low.totalEstimated.amount / 60_000;
    const highRate = high.totalEstimated.amount / 300_000;
    expect(highRate).toBeGreaterThan(lowRate);
  });

  it("zero gross → zero tax", () => {
    const zero = illustriaAdapter.estimate({ grossPerCheck: usd(0), frequency: "weekly" });
    expect(zero.totalEstimated.amount).toBe(0);
  });

  it("estimatePaycheckTaxes marks paystub withholding as superseding", () => {
    const withActual = estimatePaycheckTaxes(
      { grossPerCheck: usd(120_000), frequency: "biweekly" },
      illustriaAdapter,
      usd(30_000),
    );
    expect(withActual.supersededByPaystub).toBe(true);
    const withoutActual = estimatePaycheckTaxes({
      grossPerCheck: usd(120_000),
      frequency: "biweekly",
    });
    expect(withoutActual.supersededByPaystub).toBe(false);
  });
});
