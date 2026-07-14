import { describe, expect, it } from "vitest";
import { generateAllocationPlan, type AllocationPlanInput } from "./allocation";
import { DEFAULT_BUFFER_POLICY } from "./bills";
import { usd } from "./money";
import { compareScenarios, simulateExpenseImpact } from "./scenarios";

const input: AllocationPlanInput = {
  paycheckId: "pc-1",
  netPay: usd(98_500),
  payDate: "2026-07-10",
  nextPayDate: "2026-07-24",
  bills: [{ id: "b1", name: "Phone", amount: usd(4_500), dueDate: "2026-07-15", category: "phone" }],
  bufferPolicy: DEFAULT_BUFFER_POLICY,
  goals: [
    {
      id: "g1",
      name: "E-bike Fund",
      price: usd(150_000),
      saved: usd(85_000),
      perCheckContribution: usd(6_500),
      priority: "high",
      paused: false,
    },
  ],
  futureFundPerCheck: usd(2_500),
};

describe("compareScenarios", () => {
  const results = compareScenarios(input, "biweekly", "2026-07-10");
  const byKind = Object.fromEntries(results.map((r) => [r.kind, r]));

  it("returns all three presets", () => {
    expect(results.map((r) => r.kind)).toEqual(["conservative", "balanced", "faster_goal"]);
  });

  it("faster_goal sends more to goals and less to flexible than balanced", () => {
    expect(byKind["faster_goal"]!.totalToGoals.amount).toBeGreaterThan(
      byKind["balanced"]!.totalToGoals.amount,
    );
    expect(byKind["faster_goal"]!.safeToSpend.amount).toBeLessThan(
      byKind["balanced"]!.safeToSpend.amount,
    );
  });

  it("conservative keeps a larger buffer", () => {
    expect(byKind["conservative"]!.totalToBuffer.amount).toBeGreaterThan(
      byKind["balanced"]!.totalToBuffer.amount,
    );
  });

  it("faster_goal completes the goal sooner (positive day delta)", () => {
    expect(byKind["faster_goal"]!.goalDaysDelta).toBeGreaterThan(0);
  });

  it("never mutates the caller's input", () => {
    expect(input.goals[0]!.perCheckContribution.amount).toBe(6_500);
    expect(input.bufferPolicy.percentOfNet).toBe(DEFAULT_BUFFER_POLICY.percentOfNet);
  });

  it("each scenario carries a plain-language explanation", () => {
    for (const r of results) expect(r.explanation.length).toBeGreaterThan(10);
  });
});

describe("simulateExpenseImpact", () => {
  const plan = generateAllocationPlan(input);

  it("fits: reports the new safe-to-spend and protection intact", () => {
    const impact = simulateExpenseImpact(plan, [], usd(8_000));
    expect(impact.fits).toBe(true);
    expect(impact.safeToSpendAfter.amount).toBe(plan.safeToSpend.amount - 8_000);
    expect(impact.explanation).toContain("stay protected");
  });

  it("does not fit: quantifies the excess without shame language", () => {
    const impact = simulateExpenseImpact(plan, [], usd(plan.safeToSpend.amount + 10_000));
    expect(impact.fits).toBe(false);
    expect(impact.exceedsBy.amount).toBe(10_000);
    expect(impact.explanation).not.toMatch(/can't afford|irresponsible|fail/i);
  });

  it("accounts for already-logged expenses", () => {
    const impact = simulateExpenseImpact(
      plan,
      [{ id: "e1", amount: usd(10_000), date: "2026-07-11", label: "groceries" }],
      usd(5_000),
    );
    expect(impact.safeToSpendBefore.amount).toBe(plan.safeToSpend.amount - 10_000);
  });

  it("is pure — repeated calls give identical results", () => {
    const a = simulateExpenseImpact(plan, [], usd(8_000));
    const b = simulateExpenseImpact(plan, [], usd(8_000));
    expect(a).toEqual(b);
  });
});
