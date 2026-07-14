import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { generateAllocationPlan, planTotals, validateAllocationPlan } from "./allocation";
import type { AllocationPlanInput } from "./allocation";
import { DEFAULT_BUFFER_POLICY } from "./bills";
import { sum, usd } from "./money";
import type { BillDue, GoalAllocationInput } from "./types";

const bill = (id: string, name: string, amountCents: number, dueDate: string): BillDue => ({
  id,
  name,
  amount: usd(amountCents),
  dueDate,
  category: "other",
});

const goal = (
  id: string,
  name: string,
  overrides: Partial<GoalAllocationInput> = {},
): GoalAllocationInput => ({
  id,
  name,
  price: usd(150_000),
  saved: usd(20_000),
  perCheckContribution: usd(6_500),
  priority: "high",
  paused: false,
  ...overrides,
});

const baseInput = (overrides: Partial<AllocationPlanInput> = {}): AllocationPlanInput => ({
  paycheckId: "pc-1",
  netPay: usd(98_500), // $985.00
  payDate: "2026-07-10",
  nextPayDate: "2026-07-24",
  bills: [
    bill("b1", "Phone", 4_500, "2026-07-15"),
    bill("b2", "Rent share", 40_000, "2026-07-20"),
    bill("b3", "Gym (after payday)", 3_000, "2026-08-01"), // outside period — excluded
  ],
  bufferPolicy: DEFAULT_BUFFER_POLICY,
  goals: [goal("g1", "E-bike Fund")],
  futureFundPerCheck: usd(2_500),
  ...overrides,
});

describe("generateAllocationPlan — happy path", () => {
  const plan = generateAllocationPlan(baseInput());

  it("funds every category and leaves a flexible remainder", () => {
    // bills 44500 + buffer max(5% of 98500 = 4925, 1000) + goal 6500 + future 2500 = 58425
    const totals = planTotals(plan);
    expect(totals["bill"]!.amount).toBe(44_500);
    expect(totals["buffer"]!.amount).toBe(4_925);
    expect(totals["goal"]!.amount).toBe(6_500);
    expect(totals["future_fund"]!.amount).toBe(2_500);
    expect(totals["flexible"]!.amount).toBe(98_500 - 58_425);
    expect(plan.safeToSpend.amount).toBe(40_075);
  });

  it("excludes bills due after the next payday", () => {
    expect(plan.allocations.find((a) => a.refId === "b3")).toBeUndefined();
  });

  it("is proposed (not auto-approved) and has no shortfall", () => {
    expect(plan.status).toBe("proposed");
    expect(plan.shortfall).toBeUndefined();
  });

  it("passes validation", () => {
    expect(validateAllocationPlan(plan)).toEqual([]);
  });

  it("orders bills before buffer before goals before future fund before flexible", () => {
    const cats = plan.allocations.map((a) => a.category);
    expect(cats).toEqual(["bill", "bill", "buffer", "goal", "future_fund", "flexible"]);
  });
});

describe("generateAllocationPlan — shortfall behavior", () => {
  it("never over-allocates when net pay cannot cover bills", () => {
    const plan = generateAllocationPlan(baseInput({ netPay: usd(30_000) }));
    expect(plan.status).toBe("needs_attention");
    expect(plan.shortfall).toBeDefined();
    expect(plan.safeToSpend.amount).toBe(0);
    expect(validateAllocationPlan(plan)).toEqual([]);
    // Funded totals never exceed net pay.
    const funded = sum(plan.allocations.map((a) => a.funded));
    expect(funded.amount).toBe(30_000);
  });

  it("funds bills by due date order when partially covered", () => {
    const plan = generateAllocationPlan(baseInput({ netPay: usd(10_000) }));
    const phone = plan.allocations.find((a) => a.refId === "b1")!;
    const rent = plan.allocations.find((a) => a.refId === "b2")!;
    expect(phone.funded.amount).toBe(4_500); // earlier due date fully funded first
    expect(rent.funded.amount).toBe(5_500);
    expect(rent.reason).toBe("shortfall_bill_unfunded");
  });

  it("explains the shortfall in plain, shame-free language", () => {
    const plan = generateAllocationPlan(baseInput({ netPay: usd(30_000) }));
    expect(plan.shortfall!.explanations.length).toBeGreaterThan(0);
    for (const line of plan.shortfall!.explanations) {
      expect(line).not.toMatch(/fail|overspend|blame|should have/i);
    }
  });

  it("zero net pay produces an all-zero funded plan that validates", () => {
    const plan = generateAllocationPlan(baseInput({ netPay: usd(0) }));
    expect(plan.safeToSpend.amount).toBe(0);
    expect(validateAllocationPlan(plan)).toEqual([]);
  });
});

describe("generateAllocationPlan — goal handling", () => {
  it("skips paused goals", () => {
    const plan = generateAllocationPlan(
      baseInput({ goals: [goal("g1", "E-bike Fund", { paused: true })] }),
    );
    expect(plan.allocations.find((a) => a.category === "goal")).toBeUndefined();
  });

  it("caps contribution at the goal's remaining need", () => {
    const plan = generateAllocationPlan(
      baseInput({
        goals: [goal("g1", "Nearly done", { price: usd(10_000), saved: usd(9_000) })],
      }),
    );
    const g = plan.allocations.find((a) => a.category === "goal")!;
    expect(g.funded.amount).toBe(1_000);
  });

  it("orders goals by priority then name", () => {
    const plan = generateAllocationPlan(
      baseInput({
        goals: [
          goal("g2", "Laptop", { priority: "low", perCheckContribution: usd(2_000) }),
          goal("g1", "E-bike", { priority: "high" }),
          goal("g3", "Course", { priority: "high", perCheckContribution: usd(1_000) }),
        ],
      }),
    );
    const goalLabels = plan.allocations.filter((a) => a.category === "goal").map((a) => a.label);
    expect(goalLabels).toEqual(["Course", "E-bike", "Laptop"]);
  });
});

describe("allocation invariants (property tests)", () => {
  const arbInput = fc
    .record({
      net: fc.integer({ min: 0, max: 500_000 }),
      billAmounts: fc.array(fc.integer({ min: 1, max: 150_000 }), { maxLength: 5 }),
      goalContribs: fc.array(fc.integer({ min: 1, max: 30_000 }), { maxLength: 3 }),
      future: fc.integer({ min: 0, max: 20_000 }),
    })
    .map(({ net, billAmounts, goalContribs, future }) =>
      baseInput({
        netPay: usd(net),
        bills: billAmounts.map((amt, i) => bill(`b${i}`, `Bill ${i}`, amt, "2026-07-15")),
        goals: goalContribs.map((c, i) =>
          goal(`g${i}`, `Goal ${i}`, { perCheckContribution: usd(c) }),
        ),
        futureFundPerCheck: usd(future),
      }),
    );

  it("funded allocations always sum exactly to net pay and validation passes", () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const plan = generateAllocationPlan(input);
        expect(validateAllocationPlan(plan)).toEqual([]);
        const funded = sum(plan.allocations.map((a) => a.funded));
        expect(funded.amount).toBe(input.netPay.amount);
        for (const a of plan.allocations) {
          expect(a.funded.amount).toBeGreaterThanOrEqual(0);
          expect(a.funded.amount).toBeLessThanOrEqual(a.planned.amount);
        }
      }),
    );
  });

  it("higher-priority allocations are never shorted while lower priorities are funded", () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const plan = generateAllocationPlan(input);
        const nonFlexible = plan.allocations.filter((a) => a.category !== "flexible");
        let seenShortfall = false;
        for (const a of nonFlexible) {
          const short = a.planned.amount - a.funded.amount;
          if (seenShortfall) {
            expect(a.funded.amount).toBe(0);
          }
          if (short > 0) seenShortfall = true;
        }
      }),
    );
  });
});
