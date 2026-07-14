/**
 * Synthetic demo data — fictional person, fictional employer, invented amounts.
 * NO real financial data, ever. Numbers are crafted so every figure the UI
 * shows reconciles exactly through the deterministic engine:
 *
 *   net $985.00 − bills $445.00 − buffer $49.25 − e-bike $65.00 − future $25.00
 *     = flexible $400.75
 *   flexible $400.75 − logged expenses $226.55 = safe to spend $174.20
 */
import { generateAllocationPlan } from "@/domain/allocation";
import { usd, type Money } from "@/domain/money";
import { billsDueInPeriod } from "@/domain/payPeriod";
import type { BillDue, IsoDate, SourcedValue } from "@/domain/types";
import { db, newId, nowIso, OWNER_ID } from "./db";
import type {
  BudgetPlanRecord,
  RecurringBillRecord,
  UserPreferencesRecord,
} from "./schema";

const fromPaystub = <T>(value: T, confidence: number): SourcedValue<T> => ({
  value,
  source: "paystub",
  confidence,
  needsReview: false,
});

/** Bill due dates for a given period, derived from recurring day-of-month. */
export function billOccurrences(
  bills: readonly RecurringBillRecord[],
  periodStart: IsoDate,
  periodEnd: IsoDate,
): BillDue[] {
  const occurrences: BillDue[] = [];
  const startMonth = periodStart.slice(0, 7);
  const endMonth = periodEnd.slice(0, 7);
  const months = startMonth === endMonth ? [startMonth] : [startMonth, endMonth];
  for (const bill of bills.filter((b) => b.active && !b.deletedAt)) {
    for (const month of months) {
      occurrences.push({
        id: bill.id,
        name: bill.name,
        amount: bill.amount,
        dueDate: `${month}-${String(bill.dueDayOfMonth).padStart(2, "0")}`,
        category: bill.category,
      });
    }
  }
  return billsDueInPeriod(dedupe(occurrences), periodStart, periodEnd);
}

function dedupe(bills: BillDue[]): BillDue[] {
  const seen = new Set<string>();
  return bills.filter((b) => {
    const key = `${b.id}:${b.dueDate}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function isSeeded(): Promise<boolean> {
  return (await db.users.get(OWNER_ID)) !== undefined;
}

export interface SeedOptions {
  displayName?: string;
}

/** Full demo persona: rich, coherent data across every screen. */
export async function seedDemoData(options: SeedOptions = {}): Promise<void> {
  const displayName = options.displayName ?? "Yuriel";
  const now = nowIso();

  const goalEbikeId = newId("goal");
  const paycheckId = newId("pc");
  const prevPaycheckId = newId("pc");
  const threadId = "thread_main";

  const bills: RecurringBillRecord[] = [
    {
      id: newId("bill"),
      userId: OWNER_ID,
      name: "Phone",
      amount: usd(45_00),
      category: "phone",
      dueDayOfMonth: 15,
      active: true,
    },
    {
      id: newId("bill"),
      userId: OWNER_ID,
      name: "Rent share",
      amount: usd(400_00),
      category: "housing",
      dueDayOfMonth: 20,
      active: true,
    },
    {
      id: newId("bill"),
      userId: OWNER_ID,
      name: "Streaming",
      amount: usd(11_99),
      category: "subscriptions",
      dueDayOfMonth: 3,
      active: true,
    },
    {
      id: newId("bill"),
      userId: OWNER_ID,
      name: "Transit pass",
      amount: usd(65_00),
      category: "transport",
      dueDayOfMonth: 28,
      active: true,
    },
    {
      id: newId("bill"),
      userId: OWNER_ID,
      name: "Auto insurance",
      amount: usd(343_26),
      category: "insurance",
      dueDayOfMonth: 29,
      active: true,
    },
  ];

  const preferences: UserPreferencesRecord = {
    id: OWNER_ID,
    userId: OWNER_ID,
    focus: "goal",
    memoryConsent: true,
    bufferPercentOfNet: 5,
    bufferMinimumPerCheck: usd(10_00),
    futureFundPerCheck: usd(25_00),
  };

  const goals = [
    {
      id: goalEbikeId,
      userId: OWNER_ID,
      name: "E-bike Fund",
      emoji: "🚲",
      price: usd(1_500_00),
      saved: usd(850_00),
      perCheckContribution: usd(65_00),
      priority: "high" as const,
      state: "active" as const,
      kind: "purchase" as const,
      createdAt: now,
    },
  ];

  const goalInputs = goals.map((g) => ({
    id: g.id,
    name: g.name,
    price: g.price,
    saved: g.saved,
    perCheckContribution: g.perCheckContribution,
    priority: g.priority,
    paused: false,
  }));

  const bufferPolicy = {
    percentOfNet: preferences.bufferPercentOfNet,
    minimumPerCheck: preferences.bufferMinimumPerCheck,
  };

  // Current check: paid 2026-07-10, next payday 2026-07-24.
  const currentPlanInput = {
    paycheckId,
    netPay: usd(985_00),
    payDate: "2026-07-10",
    nextPayDate: "2026-07-24",
    bills: billOccurrences(bills, "2026-07-10", "2026-07-24"),
    bufferPolicy,
    goals: goalInputs,
    futureFundPerCheck: preferences.futureFundPerCheck,
  };
  const currentPlan = generateAllocationPlan(currentPlanInput);

  // Previous check: paid 2026-06-26 (includes the auto-insurance hit).
  const prevPlanInput = {
    paycheckId: prevPaycheckId,
    netPay: usd(940_00),
    payDate: "2026-06-26",
    nextPayDate: "2026-07-10",
    bills: billOccurrences(bills, "2026-06-26", "2026-07-10"),
    bufferPolicy,
    goals: goalInputs.map((g) => ({ ...g, saved: usd(785_00) })),
    futureFundPerCheck: preferences.futureFundPerCheck,
  };
  const prevPlan = generateAllocationPlan(prevPlanInput);

  const mkPlanRecord = (
    plan: ReturnType<typeof generateAllocationPlan>,
    approvedAt: string,
  ): BudgetPlanRecord => ({
    id: newId("plan"),
    userId: OWNER_ID,
    paycheckId: plan.paycheckId,
    payDate: plan.payDate,
    nextPayDate: plan.nextPayDate,
    netPay: plan.netPay,
    allocations: [...plan.allocations],
    safeToSpend: plan.safeToSpend,
    status: "approved",
    ...(plan.shortfall ? { shortfall: plan.shortfall } : {}),
    approvedAt,
    createdAt: approvedAt,
  });

  const money = (m: Money, confidence: number) => fromPaystub(m, confidence);

  await db.transaction(
    "rw",
    db.tables,
    async () => {
      await db.users.put({ id: OWNER_ID, displayName, createdAt: now, onboardedAt: now });
      await db.preferences.put(preferences);
      await db.paySchedules.put({
        id: newId("sched"),
        userId: OWNER_ID,
        frequency: "biweekly",
        anchorPayDate: "2026-07-10",
        employer: "Harborline Café",
        typicalNet: usd(985_00),
      });
      await db.recurringBills.bulkPut(bills);
      await db.goals.bulkPut(goals);

      await db.paychecks.bulkPut([
        {
          id: paycheckId,
          userId: OWNER_ID,
          status: "confirmed",
          employer: fromPaystub("Harborline Café", 0.98),
          payDate: fromPaystub<IsoDate>("2026-07-10", 0.99),
          periodStart: fromPaystub<IsoDate>("2026-06-21", 0.97),
          periodEnd: fromPaystub<IsoDate>("2026-07-04", 0.97),
          hours: fromPaystub(68.5, 0.95),
          hourlyRate: money(usd(14_00), 0.96),
          tips: money(usd(281_00), 0.94),
          gross: money(usd(1_240_00), 0.97),
          net: money(usd(985_00), 0.96),
          lineItems: [
            { label: "Regular earnings", amount: money(usd(959_00), 0.97), kind: "earnings" },
            { label: "Tips", amount: money(usd(281_00), 0.94), kind: "tips" },
            { label: "Federal withholding", amount: money(usd(128_14), 0.95), kind: "federal_withholding" },
            { label: "State withholding", amount: money(usd(32_00), 0.93), kind: "state_withholding" },
            { label: "Social Security", amount: money(usd(76_88), 0.96), kind: "social_security" },
            { label: "Medicare", amount: money(usd(17_98), 0.96), kind: "medicare" },
          ],
          confirmedAt: "2026-07-10T14:03:00.000Z",
          createdAt: "2026-07-10T14:00:00.000Z",
        },
        {
          id: prevPaycheckId,
          userId: OWNER_ID,
          status: "confirmed",
          employer: fromPaystub("Harborline Café", 0.98),
          payDate: fromPaystub<IsoDate>("2026-06-26", 0.99),
          periodStart: fromPaystub<IsoDate>("2026-06-07", 0.97),
          periodEnd: fromPaystub<IsoDate>("2026-06-20", 0.97),
          hours: fromPaystub(64.0, 0.95),
          hourlyRate: money(usd(14_00), 0.96),
          tips: money(usd(262_00), 0.93),
          gross: money(usd(1_158_00), 0.97),
          net: money(usd(940_00), 0.96),
          lineItems: [
            { label: "Regular earnings", amount: money(usd(896_00), 0.97), kind: "earnings" },
            { label: "Tips", amount: money(usd(262_00), 0.93), kind: "tips" },
            { label: "Federal withholding", amount: money(usd(119_00), 0.95), kind: "federal_withholding" },
            { label: "State withholding", amount: money(usd(29_50), 0.93), kind: "state_withholding" },
            { label: "Social Security", amount: money(usd(71_80), 0.96), kind: "social_security" },
            { label: "Medicare", amount: money(usd(16_79), 0.96), kind: "medicare" },
          ],
          confirmedAt: "2026-06-26T13:40:00.000Z",
          createdAt: "2026-06-26T13:36:00.000Z",
        },
      ]);

      await db.plans.bulkPut([
        mkPlanRecord(currentPlan, "2026-07-10T14:03:30.000Z"),
        mkPlanRecord(prevPlan, "2026-06-26T13:40:30.000Z"),
      ]);

      await db.goalContributions.bulkPut([
        {
          id: newId("gc"),
          userId: OWNER_ID,
          goalId: goalEbikeId,
          amount: usd(65_00),
          date: "2026-07-10",
          source: "plan",
        },
        {
          id: newId("gc"),
          userId: OWNER_ID,
          goalId: goalEbikeId,
          amount: usd(65_00),
          date: "2026-06-26",
          source: "plan",
        },
      ]);

      await db.expenses.bulkPut([
        {
          id: newId("exp"),
          userId: OWNER_ID,
          amount: usd(86_40),
          label: "Groceries",
          date: "2026-07-11",
          category: "food",
          source: "user_entered",
          createdAt: "2026-07-11T18:20:00.000Z",
        },
        {
          id: newId("exp"),
          userId: OWNER_ID,
          amount: usd(38_15),
          label: "Gas",
          date: "2026-07-12",
          category: "transport",
          source: "user_entered",
          createdAt: "2026-07-12T10:05:00.000Z",
        },
        {
          id: newId("exp"),
          userId: OWNER_ID,
          amount: usd(102_00),
          label: "Dinner with friends",
          date: "2026-07-12",
          category: "food",
          source: "user_entered",
          createdAt: "2026-07-12T21:44:00.000Z",
        },
      ]);

      await db.memories.bulkPut([
        {
          id: newId("mem"),
          userId: OWNER_ID,
          statement: "You're paid every two weeks, usually on Fridays.",
          source: "onboarding",
          createdAt: "2026-06-20T10:00:00.000Z",
          lastConfirmedAt: "2026-07-10T14:03:00.000Z",
          state: "active",
        },
        {
          id: newId("mem"),
          userId: OWNER_ID,
          statement: "Saving for a $1,500 e-bike is your top goal right now.",
          source: "onboarding",
          createdAt: "2026-06-20T10:01:00.000Z",
          lastConfirmedAt: "2026-06-20T10:01:00.000Z",
          state: "active",
        },
        {
          id: newId("mem"),
          userId: OWNER_ID,
          statement: "Phone and rent share must always be protected first.",
          source: "onboarding",
          createdAt: "2026-06-20T10:02:00.000Z",
          lastConfirmedAt: "2026-06-26T13:40:00.000Z",
          state: "active",
        },
      ]);

      await db.notes.bulkPut([
        {
          id: newId("note"),
          userId: OWNER_ID,
          body: "want a macbook for coding maybe used around 600 but still saving for bike",
          collection: "inbox",
          tags: [],
          links: [],
          createdAt: "2026-07-12T22:10:00.000Z",
          updatedAt: "2026-07-12T22:10:00.000Z",
        },
        {
          id: newId("note"),
          userId: OWNER_ID,
          body: "Picked up two extra closing shifts next week — tips are usually better on Fridays.",
          collection: "work",
          tags: ["shifts"],
          links: [],
          createdAt: "2026-07-09T09:15:00.000Z",
          updatedAt: "2026-07-09T09:15:00.000Z",
        },
        {
          id: newId("note"),
          userId: OWNER_ID,
          body: "Bike shop on 9th has last year's model — worth asking about a discount once I'm close.",
          collection: "money",
          tags: ["e-bike"],
          links: [],
          createdAt: "2026-07-05T16:30:00.000Z",
          updatedAt: "2026-07-05T16:30:00.000Z",
        },
      ]);

      await db.chatMessages.put({
        id: newId("msg"),
        userId: OWNER_ID,
        threadId,
        role: "kova",
        body: "Hi — I'm here when you want to check a purchase, understand your plan, or think through a goal. Everything I suggest waits for your approval.",
        createdAt: now,
      });

      await db.providerConfig.put({ id: OWNER_ID, userId: OWNER_ID, provider: "mock" });
    },
  );
}
