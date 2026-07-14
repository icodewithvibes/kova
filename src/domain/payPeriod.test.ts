import { describe, expect, it } from "vitest";
import { billsDueInPeriod, daysBetween, nextPayDate, upcomingPayDates } from "./payPeriod";

describe("nextPayDate", () => {
  it("weekly steps 7 days from anchor", () => {
    expect(nextPayDate("weekly", "2026-07-10", "2026-07-10")).toBe("2026-07-17");
    expect(nextPayDate("weekly", "2026-07-10", "2026-07-16")).toBe("2026-07-17");
    expect(nextPayDate("weekly", "2026-07-10", "2026-07-17")).toBe("2026-07-24");
  });

  it("biweekly steps 14 days from anchor", () => {
    expect(nextPayDate("biweekly", "2026-07-10", "2026-07-10")).toBe("2026-07-24");
    expect(nextPayDate("biweekly", "2026-07-10", "2026-08-01")).toBe("2026-08-07");
  });

  it("semimonthly pays on 1st and 15th", () => {
    expect(nextPayDate("semimonthly", "2026-07-01", "2026-07-01")).toBe("2026-07-15");
    expect(nextPayDate("semimonthly", "2026-07-01", "2026-07-15")).toBe("2026-08-01");
    expect(nextPayDate("semimonthly", "2026-07-01", "2026-07-20")).toBe("2026-08-01");
  });

  it("monthly clamps to end of shorter months", () => {
    expect(nextPayDate("monthly", "2026-01-31", "2026-01-31")).toBe("2026-02-28");
    expect(nextPayDate("monthly", "2026-01-31", "2026-02-28")).toBe("2026-03-31");
  });

  it("irregular cannot be predicted", () => {
    expect(nextPayDate("irregular", "2026-07-10")).toBeNull();
  });
});

describe("upcomingPayDates", () => {
  it("produces a sequence", () => {
    expect(upcomingPayDates("biweekly", "2026-07-10", "2026-07-10", 3)).toEqual([
      "2026-07-24",
      "2026-08-07",
      "2026-08-21",
    ]);
  });
  it("empty for irregular", () => {
    expect(upcomingPayDates("irregular", "2026-07-10", "2026-07-10", 3)).toEqual([]);
  });
});

describe("billsDueInPeriod", () => {
  const bills = [
    { id: "a", dueDate: "2026-07-10" }, // on pay date — previous check's job
    { id: "b", dueDate: "2026-07-15" },
    { id: "c", dueDate: "2026-07-24" }, // on next payday — this check's job
    { id: "d", dueDate: "2026-07-25" }, // next check's job
  ];
  it("includes (payDate, nextPayDate] only", () => {
    expect(billsDueInPeriod(bills, "2026-07-10", "2026-07-24").map((b) => b.id)).toEqual([
      "b",
      "c",
    ]);
  });
});

describe("daysBetween", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-07-10", "2026-07-24")).toBe(14);
    expect(daysBetween("2026-07-24", "2026-07-10")).toBe(-14);
  });
});
