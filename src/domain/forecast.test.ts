import { describe, expect, it } from "vitest";
import { forecastGoalCompletion } from "./forecast";
import { usd } from "./money";
import type { GoalAllocationInput } from "./types";

const goal = (overrides: Partial<GoalAllocationInput> = {}): GoalAllocationInput => ({
  id: "g1",
  name: "E-bike Fund",
  price: usd(150_000),
  saved: usd(85_000),
  perCheckContribution: usd(6_500),
  priority: "high",
  paused: false,
  ...overrides,
});

describe("forecastGoalCompletion", () => {
  it("counts checks and dates the completion", () => {
    // remaining 65000 / 6500 = 10 checks, biweekly from 2026-07-10
    const f = forecastGoalCompletion(goal(), "biweekly", "2026-07-10", "2026-07-10");
    expect(f.checksNeeded).toBe(10);
    expect(f.completionDate).toBe("2026-11-27"); // 10 × 14 days after 07-10
    expect(f.reason).toBe("on_track");
  });

  it("rounds up partial checks", () => {
    const f = forecastGoalCompletion(
      goal({ saved: usd(86_000) }), // remaining 64000 / 6500 = 9.85 → 10
      "biweekly",
      "2026-07-10",
      "2026-07-10",
    );
    expect(f.checksNeeded).toBe(10);
  });

  it("already complete", () => {
    const f = forecastGoalCompletion(
      goal({ saved: usd(150_000) }),
      "biweekly",
      "2026-07-10",
      "2026-07-10",
    );
    expect(f.checksNeeded).toBe(0);
    expect(f.reason).toBe("already_complete");
  });

  it("paused goals do not forecast", () => {
    const f = forecastGoalCompletion(goal({ paused: true }), "biweekly", "2026-07-10", "2026-07-10");
    expect(f.completionDate).toBeNull();
    expect(f.reason).toBe("paused");
  });

  it("zero contribution does not forecast", () => {
    const f = forecastGoalCompletion(
      goal({ perCheckContribution: usd(0) }),
      "biweekly",
      "2026-07-10",
      "2026-07-10",
    );
    expect(f.completionDate).toBeNull();
    expect(f.reason).toBe("no_contribution");
  });

  it("irregular income counts checks but refuses to date them", () => {
    const f = forecastGoalCompletion(goal(), "irregular", "2026-07-10", "2026-07-10");
    expect(f.checksNeeded).toBe(10);
    expect(f.completionDate).toBeNull();
    expect(f.reason).toBe("irregular_income");
  });
});
