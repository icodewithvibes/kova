/**
 * "Illustria" — a deliberately fictional jurisdiction with US-shaped mechanics.
 *
 * Exists so the product can demonstrate tax-estimate UX honestly without
 * claiming real-region accuracy. Rates are round, invented numbers. The
 * adapter is modular: a verified real-region adapter can replace this after
 * sourcing + legal review.
 */
import { ZERO, add, multiplyRatio, percentage, subtract, sum, usd, type Money } from "../money";
import {
  TAX_DISCLAIMER,
  type TaxEstimate,
  type TaxEstimateInput,
  type TaxJurisdictionAdapter,
  type TaxLineEstimate,
} from "./adapter";
import type { PayFrequency } from "../types";

const CHECKS_PER_YEAR: Record<Exclude<PayFrequency, "irregular">, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

/** Illustrative progressive brackets on ANNUAL income (cents). */
const BRACKETS: ReadonlyArray<{ upToAnnual: number | null; ratePct: number }> = [
  { upToAnnual: 12_000_00, ratePct: 0 },
  { upToAnnual: 45_000_00, ratePct: 10 },
  { upToAnnual: 100_000_00, ratePct: 18 },
  { upToAnnual: null, ratePct: 24 },
];

const SOCIAL_FUND_PCT = 6.2; // illustrative payroll line
const CARE_FUND_PCT = 1.45; // illustrative payroll line

function progressiveAnnualTax(annualGross: Money): Money {
  let tax = ZERO;
  let prevCap = 0;
  for (const bracket of BRACKETS) {
    const cap = bracket.upToAnnual ?? annualGross.amount;
    const taxableInBracket = Math.max(0, Math.min(annualGross.amount, cap) - prevCap);
    if (taxableInBracket > 0 && bracket.ratePct > 0) {
      tax = add(tax, percentage(usd(taxableInBracket), bracket.ratePct));
    }
    prevCap = cap;
    if (bracket.upToAnnual !== null && annualGross.amount <= bracket.upToAnnual) break;
  }
  return tax;
}

export const illustriaAdapter: TaxJurisdictionAdapter = {
  id: "illustria",
  label: "Illustria (illustrative region)",
  illustrative: true,
  estimate(input: TaxEstimateInput): TaxEstimate {
    const checks = CHECKS_PER_YEAR[input.frequency];
    const annualGross = multiplyRatio(input.grossPerCheck, checks, 1);
    const annualIncomeTax = progressiveAnnualTax(annualGross);
    const incomeTaxPerCheck = multiplyRatio(annualIncomeTax, 1, checks);

    const lines: TaxLineEstimate[] = [
      { label: "Income tax (est.)", amount: incomeTaxPerCheck, kind: "income_tax" },
      {
        label: "Social fund (est.)",
        amount: percentage(input.grossPerCheck, SOCIAL_FUND_PCT),
        kind: "payroll_tax",
      },
      {
        label: "Care fund (est.)",
        amount: percentage(input.grossPerCheck, CARE_FUND_PCT),
        kind: "payroll_tax",
      },
    ];
    const totalEstimated = sum(lines.map((l) => l.amount));
    return {
      jurisdictionId: "illustria",
      jurisdictionLabel: "Illustria (illustrative region)",
      illustrative: true,
      lines,
      totalEstimated,
      estimatedNet: subtract(input.grossPerCheck, totalEstimated),
      disclaimer: TAX_DISCLAIMER,
    };
  },
};

/**
 * estimatePaycheckTaxes — entry point used by the app.
 * Direct paystub withholding, when present, always outranks this estimate;
 * callers pass `actualWithholdingTotal` to make that explicit in the result.
 */
export function estimatePaycheckTaxes(
  input: TaxEstimateInput,
  adapter: TaxJurisdictionAdapter = illustriaAdapter,
  actualWithholdingTotal?: Money,
): TaxEstimate & { supersededByPaystub: boolean } {
  const estimate = adapter.estimate(input);
  return {
    ...estimate,
    supersededByPaystub: actualWithholdingTotal !== undefined,
  };
}
