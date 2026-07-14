import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MoneyError,
  ZERO,
  add,
  allocateProportionally,
  cents,
  compare,
  formatMoney,
  formatMoneyCompact,
  formatMoneyForSpeech,
  formatMoneyParts,
  multiplyRatio,
  normalizeMoneyInput,
  percentage,
  subtract,
  sum,
  usd,
} from "./money";

describe("money constructors", () => {
  it("accepts integer cents", () => {
    expect(usd(12345).amount).toBe(12345);
  });
  it("rejects fractional cents", () => {
    expect(() => cents(1.5)).toThrow(MoneyError);
  });
  it("rejects NaN and Infinity", () => {
    expect(() => cents(Number.NaN)).toThrow(MoneyError);
    expect(() => cents(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });
  it("rejects amounts beyond the sanity ceiling", () => {
    expect(() => usd(100_000_000_01)).toThrow(MoneyError);
  });
});

describe("arithmetic", () => {
  it("adds and subtracts exactly", () => {
    expect(add(usd(1099), usd(1)).amount).toBe(1100);
    expect(subtract(usd(1000), usd(1)).amount).toBe(999);
  });
  it("classic float trap: 0.1 + 0.2 style values stay exact", () => {
    expect(add(usd(10), usd(20)).amount).toBe(30);
  });
  it("sums lists", () => {
    expect(sum([usd(1), usd(2), usd(3)]).amount).toBe(6);
    expect(sum([]).amount).toBe(0);
  });
  it("percentage rounds half away from zero deterministically", () => {
    expect(percentage(usd(1000), 5).amount).toBe(50);
    expect(percentage(usd(999), 5).amount).toBe(50); // 49.95 → 50
    expect(percentage(usd(989), 5).amount).toBe(49); // 49.45 → 49
  });
  it("multiplyRatio rejects zero denominator", () => {
    expect(() => multiplyRatio(usd(100), 1, 0)).toThrow(MoneyError);
  });
  it("compare orders correctly", () => {
    expect(compare(usd(1), usd(2))).toBe(-1);
    expect(compare(usd(2), usd(2))).toBe(0);
    expect(compare(usd(3), usd(2))).toBe(1);
  });
});

describe("allocateProportionally", () => {
  it("splits exactly with no lost cents", () => {
    const parts = allocateProportionally(usd(100), [1, 1, 1]);
    expect(parts.map((p) => p.amount)).toEqual([34, 33, 33]);
    expect(sum(parts).amount).toBe(100);
  });
  it("handles zero weights by giving everything to the first slot", () => {
    const parts = allocateProportionally(usd(500), [0, 0]);
    expect(sum(parts).amount).toBe(500);
  });
  it("property: parts always sum to total", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_00 }),
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 8 }),
        (total, weights) => {
          const parts = allocateProportionally(usd(total), weights);
          expect(sum(parts).amount).toBe(total);
          for (const p of parts) expect(p.amount).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

describe("normalizeMoneyInput", () => {
  it.each([
    ["1234.56", 123456],
    ["$1,234.56", 123456],
    ["$80", 8000],
    ["1,234", 123400],
    [" 12.5 ", 1250],
    ["0.05", 5],
    ["0", 0],
  ])("parses %s → %d cents", (input, expected) => {
    const r = normalizeMoneyInput(input);
    expect(r.ok).toBe(true);
    expect(r.money?.amount).toBe(expected);
  });
  it.each(["", "-5", "abc", "12.345", "1.2.3", "$", "1e5"])("rejects %s", (input) => {
    expect(normalizeMoneyInput(input).ok).toBe(false);
  });
  it("property: round-trips any cents value through formatting-free string", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000_000_00 }), (n) => {
        const s = `${Math.floor(n / 100)}.${(n % 100).toString().padStart(2, "0")}`;
        const r = normalizeMoneyInput(s);
        expect(r.ok).toBe(true);
        expect(r.money?.amount).toBe(n);
      }),
    );
  });
});

describe("formatting", () => {
  it("formats standard money", () => {
    expect(formatMoney(usd(123456))).toBe("$1,234.56");
    expect(formatMoney(ZERO)).toBe("$0.00");
  });
  it("compact formatting drops .00 only", () => {
    expect(formatMoneyCompact(usd(120000))).toBe("$1,200");
    expect(formatMoneyCompact(usd(120050))).toBe("$1,200.50");
  });
  it("splits parts for styled display", () => {
    expect(formatMoneyParts(usd(17420))).toEqual({ sign: "", dollars: "174", cents: "20" });
    expect(formatMoneyParts(usd(-5))).toEqual({ sign: "−", dollars: "0", cents: "05" });
  });
  it("speaks money for screen readers", () => {
    expect(formatMoneyForSpeech(usd(214530))).toBe("2,145 dollars and 30 cents");
    expect(formatMoneyForSpeech(usd(200))).toBe("2 dollars");
  });
});
