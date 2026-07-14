import { describe, expect, it } from "vitest";
import { generateAllocationPlan } from "./allocation";
import { DEFAULT_BUFFER_POLICY } from "./bills";
import { usd } from "./money";
import { calculateAvailableCash, calculateSafeToSpend, type ExpenseEntry } from "./safeToSpend";

const plan = generateAllocationPlan({
  paycheckId: "pc-1",
  netPay: usd(100_000),
  payDate: "2026-07-10",
  nextPayDate: "2026-07-24",
  bills: [{ id: "b1", name: "Phone", amount: usd(5_000), dueDate: "2026-07-15", category: "phone" }],
  bufferPolicy: DEFAULT_BUFFER_POLICY,
  goals: [],
  futureFundPerCheck: usd(0),
});
// flexible = 100000 − 5000 − 5000(buffer) = 90000

const expense = (id: string, amountCents: number, date: string): ExpenseEntry => ({
  id,
  amount: usd(amountCents),
  date,
  label: "test",
});

describe("calculateSafeToSpend", () => {
  it("returns the flexible pool with no expenses", () => {
    const r = calculateSafeToSpend(plan, []);
    expect(r.amount.amount).toBe(90_000);
    expect(r.overspent).toBe(false);
    expect(r.until).toBe("2026-07-24");
  });

  it("subtracts in-period flexible expenses", () => {
    const r = calculateSafeToSpend(plan, [expense("e1", 8_000, "2026-07-12")]);
    expect(r.amount.amount).toBe(82_000);
    expect(r.flexibleSpent.amount).toBe(8_000);
  });

  it("ignores expenses outside the pay period", () => {
    const r = calculateSafeToSpend(plan, [
      expense("e1", 8_000, "2026-07-09"),
      expense("e2", 8_000, "2026-07-25"),
    ]);
    expect(r.amount.amount).toBe(90_000);
  });

  it("floors display at zero and reports overspend honestly", () => {
    const r = calculateSafeToSpend(plan, [expense("e1", 95_000, "2026-07-12")]);
    expect(r.amount.amount).toBe(0);
    expect(r.overspent).toBe(true);
    expect(r.overspendAmount.amount).toBe(5_000);
    expect(r.rawRemainder.amount).toBe(-5_000);
  });
});

describe("calculateAvailableCash", () => {
  it("subtracts protected amounts, floored at zero", () => {
    expect(calculateAvailableCash(usd(1000), [usd(300), usd(200)]).amount).toBe(500);
    expect(calculateAvailableCash(usd(400), [usd(300), usd(200)]).amount).toBe(0);
  });
});
