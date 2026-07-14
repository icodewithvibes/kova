/**
 * MockPaystubExtractor — deterministic extraction from synthetic fixtures.
 *
 * Two fixtures exercise both review paths:
 * - "clean-scan": high confidence, reconciles; two fields still flagged
 *   (state withholding, tips) to demonstrate the amber review pattern.
 * - "blurry-photo": several low-confidence fields AND a stated net that does
 *   not reconcile with gross − deductions, driving the mismatch banner.
 */
import { CRITICAL_FIELD_CONFIDENCE_THRESHOLD } from "@/domain/paycheck";
import { usd, type Money } from "@/domain/money";
import type { IsoDate } from "@/domain/types";
import type { ExtractedField, ExtractedPaystub, PaystubExtractor } from "./extractor";

function field<T>(
  value: T,
  confidence: number,
  rawLabel: string,
  opts: { critical?: boolean } = {},
): ExtractedField<T> {
  const threshold = opts.critical ? CRITICAL_FIELD_CONFIDENCE_THRESHOLD : 0.75;
  return {
    value,
    source: "paystub",
    confidence,
    rawLabel,
    method: "mock_ocr",
    requiresReview: confidence < threshold,
  };
}

const money = (m: Money, confidence: number, rawLabel: string) =>
  field(m, confidence, rawLabel, { critical: true });

export interface MockFixture {
  key: string;
  title: string;
  description: string;
  build(payDate: IsoDate, periodStart: IsoDate, periodEnd: IsoDate): ExtractedPaystub;
}

export const MOCK_FIXTURES: MockFixture[] = [
  {
    key: "clean-scan",
    title: "Clear photo",
    description: "Well-lit paystub — most fields extract confidently.",
    build: (payDate, periodStart, periodEnd) => ({
      fixtureKey: "clean-scan",
      employer: field("Harborline Café", 0.98, "HARBORLINE CAFE LLC"),
      payDate: field(payDate, 0.99, "PAY DATE", { critical: true }),
      periodStart: field(periodStart, 0.97, "PERIOD BEGIN"),
      periodEnd: field(periodEnd, 0.97, "PERIOD END"),
      hours: field(71.25, 0.95, "REG HRS"),
      hourlyRate: money(usd(14_00), 0.96, "RATE"),
      tips: money(usd(297_50), 0.84, "TIPS/GRATUITY"),
      gross: money(usd(1_295_00), 0.97, "GROSS PAY"),
      federalWithholding: money(usd(136_00), 0.95, "FED W/H"),
      stateWithholding: money(usd(34_10), 0.87, "ST W/H"),
      socialSecurity: money(usd(80_29), 0.96, "OASDI"),
      medicare: money(usd(18_78), 0.96, "MEDICARE"),
      otherDeductions: money(usd(0), 0.93, "OTHER DED"),
      net: money(usd(1_025_83), 0.96, "NET PAY"),
    }),
  },
  {
    key: "blurry-photo",
    title: "Blurry photo",
    description: "Low light and a creased stub — more fields need your eyes.",
    build: (payDate, periodStart, periodEnd) => ({
      fixtureKey: "blurry-photo",
      employer: field("Harborline Café", 0.91, "HARBORLINE CAFE LLC"),
      payDate: field(payDate, 0.93, "PAY DATE", { critical: true }),
      periodStart: field(periodStart, 0.88, "PERIOD BEGIN"),
      periodEnd: field(periodEnd, 0.9, "PERIOD END"),
      hours: field(66.0, 0.72, "REG HRS"),
      hourlyRate: money(usd(14_00), 0.9, "RATE"),
      tips: money(usd(244_00), 0.68, "TIPS/GRATUITY"),
      gross: money(usd(1_168_00), 0.85, "GROSS PAY"),
      federalWithholding: money(usd(121_00), 0.83, "FED W/H"),
      stateWithholding: money(usd(30_20), 0.71, "ST W/H"),
      socialSecurity: money(usd(72_42), 0.88, "OASDI"),
      medicare: money(usd(16_94), 0.88, "MEDICARE"),
      otherDeductions: money(usd(0), 0.7, "OTHER DED"),
      // Deliberately does NOT reconcile: computed net = 927.44, stated 939.84.
      net: money(usd(939_84), 0.79, "NET PAY"),
    }),
  },
];

export class MockPaystubExtractor implements PaystubExtractor {
  readonly id = "mock";
  readonly label = "Demo extractor (synthetic documents)";

  constructor(
    private dates: { payDate: IsoDate; periodStart: IsoDate; periodEnd: IsoDate },
  ) {}

  async extract({ fixtureKey }: { fixtureKey: string }): Promise<ExtractedPaystub> {
    const fixture = MOCK_FIXTURES.find((f) => f.key === fixtureKey);
    if (!fixture) throw new Error(`Unknown fixture: ${fixtureKey}`);
    // Simulate scanner latency so the processing state is honest, not fake-typing.
    await new Promise((r) => setTimeout(r, 900));
    return fixture.build(this.dates.payDate, this.dates.periodStart, this.dates.periodEnd);
  }
}
