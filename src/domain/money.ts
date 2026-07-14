/**
 * Kova money core.
 *
 * All currency in Kova is integer minor units (cents) behind the branded `Cents`
 * type. Constructors here are the ONLY sanctioned way to produce money values;
 * float arithmetic on currency anywhere else is a defect.
 */

export type Cents = number & { readonly __cents: unique symbol };

export type CurrencyCode = "USD";

export interface Money {
  readonly amount: Cents;
  readonly currency: CurrencyCode;
}

const MAX_SAFE_MONEY = 100_000_000_00; // $100M in cents — sanity ceiling for a paycheck app

export class MoneyError extends Error {
  override name = "MoneyError";
}

function assertIntegerCents(n: number): asserts n is Cents {
  if (!Number.isSafeInteger(n)) {
    throw new MoneyError(`Money amount must be integer cents, got ${n}`);
  }
  if (Math.abs(n) > MAX_SAFE_MONEY) {
    throw new MoneyError(`Money amount ${n} exceeds supported range`);
  }
}

export function cents(n: number): Cents {
  assertIntegerCents(n);
  return n;
}

export function usd(amountCents: number): Money {
  return { amount: cents(amountCents), currency: "USD" };
}

export const ZERO: Money = usd(0);

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return usd(a.amount + b.amount);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return usd(a.amount - b.amount);
}

export function sum(items: readonly Money[]): Money {
  return items.reduce((acc, m) => add(acc, m), ZERO);
}

/** Multiply by a ratio with banker's-free deterministic rounding (round half away from zero). */
export function multiplyRatio(m: Money, numerator: number, denominator: number): Money {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    throw new MoneyError(`Invalid ratio ${numerator}/${denominator}`);
  }
  const raw = (m.amount * numerator) / denominator;
  const rounded = raw >= 0 ? Math.floor(raw + 0.5) : Math.ceil(raw - 0.5);
  return usd(rounded);
}

/** Percentage helper: pct(50) of $10.00 = $5.00. */
export function percentage(m: Money, pct: number): Money {
  return multiplyRatio(m, pct, 100);
}

export function min(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amount <= b.amount ? a : b;
}

export function max(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amount >= b.amount ? a : b;
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  return a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0;
}

export function isZero(m: Money): boolean {
  return m.amount === 0;
}

export function isNegative(m: Money): boolean {
  return m.amount < 0;
}

export function isPositive(m: Money): boolean {
  return m.amount > 0;
}

export function gte(a: Money, b: Money): boolean {
  return compare(a, b) >= 0;
}

export function lte(a: Money, b: Money): boolean {
  return compare(a, b) <= 0;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount === b.amount;
}

/** Clamp to zero floor — used when a display value must never show negative. */
export function floorZero(m: Money): Money {
  return m.amount < 0 ? ZERO : m;
}

export function abs(m: Money): Money {
  return m.amount < 0 ? usd(-m.amount) : m;
}

/**
 * Split a total into parts proportional to `weights` using the largest-remainder
 * method. The parts ALWAYS sum exactly to the total — no lost or invented cents.
 */
export function allocateProportionally(total: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) return [];
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new MoneyError("Allocation weights must be non-negative finite numbers");
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) {
    const parts = weights.map(() => ZERO);
    if (parts.length > 0) parts[0] = total;
    return parts;
  }
  const raw = weights.map((w) => (total.amount * w) / weightSum);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = total.amount - floors.reduce((a, b) => a + b, 0);
  const byFraction = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const result = floors.slice();
  for (const { i } of byFraction) {
    if (remainder <= 0) break;
    result[i] = (result[i] ?? 0) + 1;
    remainder -= 1;
  }
  return result.map((n) => usd(n));
}

// ---------------------------------------------------------------------------
// Parsing and formatting
// ---------------------------------------------------------------------------

export interface NormalizedMoneyInput {
  ok: boolean;
  money?: Money;
  error?: string;
}

/**
 * normalizeMoneyInput — tolerant, deterministic parser for human money input.
 * Accepts "1234.56", "$1,234.56", "1,234", "$80", " 12.5 " (=$12.50).
 * Rejects negatives, more than 2 decimals, and garbage. Never uses parseFloat
 * on the raw string end-to-end; digits are assembled as integer cents.
 */
export function normalizeMoneyInput(raw: string): NormalizedMoneyInput {
  const trimmed = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (trimmed.length === 0) return { ok: false, error: "Enter an amount" };
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    return { ok: false, error: "Use a positive amount like 1234.56" };
  }
  const wholeStr = match[1] ?? "0";
  const fracStr = (match[2] ?? "").padEnd(2, "0");
  const whole = Number.parseInt(wholeStr, 10);
  const frac = fracStr.length > 0 ? Number.parseInt(fracStr, 10) : 0;
  const total = whole * 100 + frac;
  if (!Number.isSafeInteger(total) || total > MAX_SAFE_MONEY) {
    return { ok: false, error: "Amount is too large" };
  }
  return { ok: true, money: usd(total) };
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdWholeFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "$1,234.56" — always two decimals; negative renders with leading minus. */
export function formatMoney(m: Money): string {
  return usdFormatter.format(m.amount / 100);
}

/** "$1,234" when cents are zero, otherwise "$1,234.56" — for hero displays. */
export function formatMoneyCompact(m: Money): string {
  return m.amount % 100 === 0 ? usdWholeFormatter.format(m.amount / 100) : formatMoney(m);
}

/** Split for styled rendering: { sign, dollars: "1,234", cents: "56" }. */
export function formatMoneyParts(m: Money): { sign: string; dollars: string; cents: string } {
  const negative = m.amount < 0;
  const absCents = Math.abs(m.amount);
  const dollars = Math.floor(absCents / 100);
  const centsPart = absCents % 100;
  return {
    sign: negative ? "−" : "",
    dollars: new Intl.NumberFormat("en-US").format(dollars),
    cents: centsPart.toString().padStart(2, "0"),
  };
}

/** Screen-reader friendly: "$1,234.56" → "1,234 dollars and 56 cents". */
export function formatMoneyForSpeech(m: Money): string {
  const { sign, dollars, cents: c } = formatMoneyParts(m);
  const prefix = sign ? "minus " : "";
  if (c === "00") return `${prefix}${dollars} dollars`;
  return `${prefix}${dollars} dollars and ${c} cents`;
}
