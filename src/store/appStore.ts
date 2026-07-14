/**
 * Central app store. In-memory source of truth hydrated from Dexie; every
 * mutation writes through to the database. Derived financial values are
 * computed via the deterministic domain engine — never stored stale, never
 * produced by AI.
 */
import { create } from "zustand";
import { generateAllocationPlan, validateAllocationPlan } from "@/domain/allocation";
import { usd, type Money } from "@/domain/money";
import { nextPayDate } from "@/domain/payPeriod";
import { calculateSafeToSpend, type SafeToSpendResult } from "@/domain/safeToSpend";
import { forecastGoalCompletion, type GoalForecast } from "@/domain/forecast";
import type { Allocation, GoalAllocationInput, IsoDate, PayFrequency } from "@/domain/types";
import { db, deleteAllData, newId, nowIso, OWNER_ID } from "@/data/db";
import { billOccurrences, seedDemoData } from "@/data/seed";
import type {
  AIActionAuditRecord,
  BudgetPlanRecord,
  ChatMessageRecord,
  ExpenseEntryRecord,
  GoalRecord,
  MemoryProposalRecord,
  MemoryRecord,
  MemorySource,
  NoteRecord,
  PaycheckRecord,
  PayScheduleRecord,
  ProviderConfigurationRecord,
  RecurringBillRecord,
  UserPreferencesRecord,
  UserRecord,
} from "@/data/schema";

export interface OnboardingAnswers {
  displayName: string;
  frequency: PayFrequency;
  focus: UserPreferencesRecord["focus"];
  protectedCategories: string[];
  goal?: { name: string; price: Money; targetDate?: IsoDate; priority: "high" | "medium" | "low" };
  region?: string;
  memoryConsent: boolean;
}

interface AppState {
  hydrated: boolean;
  user: UserRecord | null;
  preferences: UserPreferencesRecord | null;
  paySchedule: PayScheduleRecord | null;
  paychecks: PaycheckRecord[];
  plans: BudgetPlanRecord[];
  bills: RecurringBillRecord[];
  goals: GoalRecord[];
  expenses: ExpenseEntryRecord[];
  notes: NoteRecord[];
  memories: MemoryRecord[];
  memoryProposals: MemoryProposalRecord[];
  chatMessages: ChatMessageRecord[];
  auditLogs: AIActionAuditRecord[];
  providerConfig: ProviderConfigurationRecord | null;

  hydrate(): Promise<void>;
  seedDemo(): Promise<void>;
  completeOnboarding(answers: OnboardingAnswers): Promise<void>;
  confirmPaycheck(paycheck: PaycheckRecord): Promise<BudgetPlanRecord>;
  applyPlanUpdate(planId: Id, allocations: Allocation[], safeToSpend: Money, summary: string): Promise<void>;
  logExpense(label: string, amount: Money, date: IsoDate, viaAI?: boolean): Promise<void>;
  addGoal(goal: Omit<GoalRecord, "id" | "userId" | "createdAt">): Promise<GoalRecord>;
  updateGoal(id: Id, patch: Partial<GoalRecord>): Promise<void>;
  addBill(bill: Omit<RecurringBillRecord, "id" | "userId">): Promise<void>;
  addNote(body: string, collection?: NoteRecord["collection"]): Promise<NoteRecord>;
  updateNote(id: Id, patch: Partial<NoteRecord>): Promise<void>;
  deleteNote(id: Id): Promise<void>;
  proposeMemory(statement: string, source: MemorySource, reason: string): Promise<void>;
  resolveMemoryProposal(id: Id, accept: boolean): Promise<void>;
  updateMemory(id: Id, statement: string): Promise<void>;
  forgetMemory(id: Id): Promise<void>;
  appendChatMessage(msg: Omit<ChatMessageRecord, "id" | "userId" | "createdAt">): Promise<ChatMessageRecord>;
  markChatActionState(messageId: Id, actionId: Id, state: "approved" | "dismissed"): Promise<void>;
  logAudit(entry: Omit<AIActionAuditRecord, "id" | "userId" | "createdAt">): Promise<void>;
  setProvider(provider: ProviderConfigurationRecord["provider"]): Promise<void>;
  updatePreferences(patch: Partial<UserPreferencesRecord>): Promise<void>;
  eraseEverything(): Promise<void>;
}

type Id = string;

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  user: null,
  preferences: null,
  paySchedule: null,
  paychecks: [],
  plans: [],
  bills: [],
  goals: [],
  expenses: [],
  notes: [],
  memories: [],
  memoryProposals: [],
  chatMessages: [],
  auditLogs: [],
  providerConfig: null,

  async hydrate() {
    const [
      user,
      preferences,
      schedules,
      paychecks,
      plans,
      bills,
      goals,
      expenses,
      notes,
      memories,
      memoryProposals,
      chatMessages,
      auditLogs,
      providerConfig,
    ] = await Promise.all([
      db.users.get(OWNER_ID),
      db.preferences.get(OWNER_ID),
      db.paySchedules.where("userId").equals(OWNER_ID).toArray(),
      db.paychecks.where("userId").equals(OWNER_ID).toArray(),
      db.plans.where("userId").equals(OWNER_ID).toArray(),
      db.recurringBills.where("userId").equals(OWNER_ID).toArray(),
      db.goals.where("userId").equals(OWNER_ID).toArray(),
      db.expenses.where("userId").equals(OWNER_ID).toArray(),
      db.notes.where("userId").equals(OWNER_ID).toArray(),
      db.memories.where("userId").equals(OWNER_ID).toArray(),
      db.memoryProposals.where("userId").equals(OWNER_ID).toArray(),
      db.chatMessages.where("userId").equals(OWNER_ID).sortBy("createdAt"),
      db.auditLogs.where("userId").equals(OWNER_ID).sortBy("createdAt"),
      db.providerConfig.get(OWNER_ID),
    ]);
    set({
      hydrated: true,
      user: user ?? null,
      preferences: preferences ?? null,
      paySchedule: schedules[0] ?? null,
      paychecks,
      plans: plans.sort((a, b) => a.payDate.localeCompare(b.payDate)),
      bills: bills.filter((b) => !b.deletedAt),
      goals: goals.filter((g) => !g.deletedAt),
      expenses,
      notes: notes.filter((n) => !n.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      memories: memories.filter((m) => !m.deletedAt),
      memoryProposals,
      chatMessages,
      auditLogs,
      providerConfig: providerConfig ?? null,
    });
  },

  async seedDemo() {
    await seedDemoData();
    await get().hydrate();
  },

  async completeOnboarding(answers) {
    const now = nowIso();
    const today = now.slice(0, 10);
    const user: UserRecord = {
      id: OWNER_ID,
      displayName: answers.displayName,
      createdAt: now,
      onboardedAt: now,
    };
    const preferences: UserPreferencesRecord = {
      id: OWNER_ID,
      userId: OWNER_ID,
      ...(answers.focus ? { focus: answers.focus } : {}),
      ...(answers.region ? { region: answers.region } : {}),
      memoryConsent: answers.memoryConsent,
      bufferPercentOfNet: 5,
      bufferMinimumPerCheck: usd(10_00),
      futureFundPerCheck: answers.focus === "future_fund" ? usd(25_00) : usd(0),
    };
    const schedule: PayScheduleRecord = {
      id: newId("sched"),
      userId: OWNER_ID,
      frequency: answers.frequency,
      anchorPayDate: today,
    };
    await db.transaction("rw", db.tables, async () => {
      await db.users.put(user);
      await db.preferences.put(preferences);
      await db.paySchedules.put(schedule);
      await db.providerConfig.put({ id: OWNER_ID, userId: OWNER_ID, provider: "mock" });
      if (answers.goal) {
        await db.goals.put({
          id: newId("goal"),
          userId: OWNER_ID,
          name: answers.goal.name,
          price: answers.goal.price,
          saved: usd(0),
          perCheckContribution: usd(0),
          priority: answers.goal.priority,
          state: "active",
          kind: "purchase",
          ...(answers.goal.targetDate ? { targetDate: answers.goal.targetDate } : {}),
          createdAt: now,
        });
      }
      if (answers.memoryConsent) {
        const freqText: Record<PayFrequency, string> = {
          weekly: "You're paid weekly.",
          biweekly: "You're paid every two weeks.",
          semimonthly: "You're paid twice a month.",
          monthly: "You're paid monthly.",
          irregular: "Your pay schedule changes — Kova asks instead of assuming.",
        };
        const memories: MemoryRecord[] = [
          {
            id: newId("mem"),
            userId: OWNER_ID,
            statement: freqText[answers.frequency],
            source: "onboarding",
            createdAt: now,
            lastConfirmedAt: now,
            state: "active",
          },
        ];
        if (answers.goal) {
          memories.push({
            id: newId("mem"),
            userId: OWNER_ID,
            statement: `Saving for ${answers.goal.name} matters to you.`,
            source: "onboarding",
            createdAt: now,
            lastConfirmedAt: now,
            state: "active",
          });
        }
        if (answers.protectedCategories.length > 0) {
          memories.push({
            id: newId("mem"),
            userId: OWNER_ID,
            statement: `${answers.protectedCategories.join(", ")} must be protected first.`,
            source: "onboarding",
            createdAt: now,
            lastConfirmedAt: now,
            state: "active",
          });
        }
        await db.memories.bulkPut(memories);
      }
    });
    await get().hydrate();
  },

  async confirmPaycheck(paycheck) {
    const state = get();
    const prefs = state.preferences;
    const schedule = state.paySchedule;
    if (!prefs || !schedule) throw new Error("Cannot confirm a paycheck before onboarding");

    const payDate = paycheck.payDate.value;
    const next =
      nextPayDate(schedule.frequency, schedule.anchorPayDate, payDate) ??
      // Irregular income: protect a 14-day window and say so in the UI.
      addDaysIso(payDate, 14);

    const plan = generateAllocationPlan({
      paycheckId: paycheck.id,
      netPay: paycheck.net.value,
      payDate,
      nextPayDate: next,
      bills: billOccurrences(state.bills, payDate, next),
      bufferPolicy: {
        percentOfNet: prefs.bufferPercentOfNet,
        minimumPerCheck: prefs.bufferMinimumPerCheck,
      },
      goals: state.goals
        .filter((g) => g.state === "active")
        .map(toGoalInput),
      futureFundPerCheck: prefs.futureFundPerCheck,
    });

    const issues = validateAllocationPlan(plan);
    if (issues.some((i) => i.severity === "error")) {
      throw new Error(`Plan failed validation: ${issues.map((i) => i.message).join("; ")}`);
    }

    const confirmed: PaycheckRecord = { ...paycheck, status: "confirmed", confirmedAt: nowIso() };
    const record: BudgetPlanRecord = {
      id: newId("plan"),
      userId: OWNER_ID,
      paycheckId: paycheck.id,
      payDate: plan.payDate,
      nextPayDate: plan.nextPayDate,
      netPay: plan.netPay,
      allocations: [...plan.allocations],
      safeToSpend: plan.safeToSpend,
      status: plan.status === "needs_attention" ? "needs_attention" : "approved",
      ...(plan.shortfall ? { shortfall: plan.shortfall } : {}),
      approvedAt: nowIso(),
      createdAt: nowIso(),
    };

    const contributions = plan.allocations
      .filter((a) => a.category === "goal" && a.refId && a.funded.amount > 0)
      .map((a) => ({
        id: newId("gc"),
        userId: OWNER_ID,
        goalId: a.refId!,
        amount: a.funded,
        date: plan.payDate,
        source: "plan" as const,
      }));

    await db.transaction("rw", db.tables, async () => {
      await db.paychecks.put(confirmed);
      await db.plans.put(record);
      await db.goalContributions.bulkPut(contributions);
      for (const c of contributions) {
        const goal = await db.goals.get(c.goalId);
        if (goal) {
          await db.goals.put({ ...goal, saved: usd(goal.saved.amount + c.amount.amount) });
        }
      }
      await db.auditLogs.put({
        id: newId("audit"),
        userId: OWNER_ID,
        kind: "paycheck_confirmed",
        summary: `Paycheck ${payDate} confirmed; plan generated deterministically.`,
        payload: JSON.stringify({ paycheckId: paycheck.id, planId: record.id }),
        outcome: "approved",
        provider: "mock",
        createdAt: nowIso(),
      });
    });
    await get().hydrate();
    return record;
  },

  async applyPlanUpdate(planId, allocations, safeToSpend, summary) {
    const plan = get().plans.find((p) => p.id === planId);
    if (!plan) throw new Error("Plan not found");
    const updated: BudgetPlanRecord = {
      ...plan,
      allocations,
      safeToSpend,
      status: "approved",
      approvedAt: nowIso(),
    };
    await db.transaction("rw", [db.plans, db.auditLogs], async () => {
      await db.plans.put(updated);
      await db.auditLogs.put({
        id: newId("audit"),
        userId: OWNER_ID,
        kind: "plan_updated",
        summary,
        payload: JSON.stringify({ planId }),
        outcome: "approved",
        provider: "mock",
        createdAt: nowIso(),
      });
    });
    await get().hydrate();
  },

  async logExpense(label, amount, date, viaAI = false) {
    const entry: ExpenseEntryRecord = {
      id: newId("exp"),
      userId: OWNER_ID,
      amount,
      label,
      date,
      source: "user_entered",
      createdAt: nowIso(),
    };
    await db.transaction("rw", [db.expenses, db.auditLogs], async () => {
      await db.expenses.put(entry);
      if (viaAI) {
        await db.auditLogs.put({
          id: newId("audit"),
          userId: OWNER_ID,
          kind: "expense_logged_via_chat",
          summary: `Expense "${label}" approved by you in chat.`,
          payload: JSON.stringify(entry),
          outcome: "approved",
          provider: "mock",
          createdAt: nowIso(),
        });
      }
    });
    await get().hydrate();
  },

  async addGoal(goal) {
    const record: GoalRecord = { ...goal, id: newId("goal"), userId: OWNER_ID, createdAt: nowIso() };
    await db.goals.put(record);
    await get().hydrate();
    return record;
  },

  async updateGoal(id, patch) {
    const goal = get().goals.find((g) => g.id === id);
    if (!goal) throw new Error("Goal not found");
    await db.goals.put({ ...goal, ...patch });
    await get().hydrate();
  },

  async addBill(bill) {
    await db.recurringBills.put({ ...bill, id: newId("bill"), userId: OWNER_ID });
    await get().hydrate();
  },

  async addNote(body, collection = "inbox") {
    const now = nowIso();
    const note: NoteRecord = {
      id: newId("note"),
      userId: OWNER_ID,
      body,
      collection,
      tags: [],
      links: [],
      createdAt: now,
      updatedAt: now,
    };
    await db.notes.put(note);
    await get().hydrate();
    return note;
  },

  async updateNote(id, patch) {
    const note = get().notes.find((n) => n.id === id);
    if (!note) throw new Error("Note not found");
    await db.notes.put({ ...note, ...patch, updatedAt: nowIso() });
    await get().hydrate();
  },

  async deleteNote(id) {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    await db.notes.put({ ...note, deletedAt: nowIso() });
    await get().hydrate();
  },

  async proposeMemory(statement, source, reason) {
    await db.transaction("rw", [db.memoryProposals, db.auditLogs], async () => {
      await db.memoryProposals.put({
        id: newId("memprop"),
        userId: OWNER_ID,
        statement,
        source,
        reason,
        status: "pending",
        createdAt: nowIso(),
      });
      await db.auditLogs.put({
        id: newId("audit"),
        userId: OWNER_ID,
        kind: "memory_proposed",
        summary: `Kova proposed remembering: "${statement}"`,
        payload: JSON.stringify({ statement, source, reason }),
        outcome: "proposed",
        provider: "mock",
        createdAt: nowIso(),
      });
    });
    await get().hydrate();
  },

  async resolveMemoryProposal(id, accept) {
    const proposal = get().memoryProposals.find((p) => p.id === id);
    if (!proposal) return;
    await db.transaction("rw", [db.memoryProposals, db.memories, db.auditLogs], async () => {
      await db.memoryProposals.put({
        ...proposal,
        status: accept ? "accepted" : "declined",
        resolvedAt: nowIso(),
      });
      if (accept) {
        await db.memories.put({
          id: newId("mem"),
          userId: OWNER_ID,
          statement: proposal.statement,
          source: proposal.source,
          createdAt: nowIso(),
          lastConfirmedAt: nowIso(),
          state: "active",
        });
      }
      await db.auditLogs.put({
        id: newId("audit"),
        userId: OWNER_ID,
        kind: accept ? "memory_approved" : "memory_declined",
        summary: `You ${accept ? "approved" : "declined"}: "${proposal.statement}"`,
        payload: JSON.stringify({ proposalId: id }),
        outcome: accept ? "approved" : "declined",
        provider: "mock",
        createdAt: nowIso(),
      });
    });
    await get().hydrate();
  },

  async updateMemory(id, statement) {
    const memory = get().memories.find((m) => m.id === id);
    if (!memory) return;
    await db.memories.put({ ...memory, statement, lastConfirmedAt: nowIso() });
    await get().hydrate();
  },

  async forgetMemory(id) {
    const memory = get().memories.find((m) => m.id === id);
    if (!memory) return;
    await db.transaction("rw", [db.memories, db.auditLogs], async () => {
      await db.memories.put({ ...memory, deletedAt: nowIso() });
      await db.auditLogs.put({
        id: newId("audit"),
        userId: OWNER_ID,
        kind: "memory_forgotten",
        summary: `You asked Kova to forget: "${memory.statement}"`,
        payload: JSON.stringify({ memoryId: id }),
        outcome: "approved",
        provider: "mock",
        createdAt: nowIso(),
      });
    });
    await get().hydrate();
  },

  async appendChatMessage(msg) {
    const record: ChatMessageRecord = {
      ...msg,
      id: newId("msg"),
      userId: OWNER_ID,
      createdAt: nowIso(),
    };
    await db.chatMessages.put(record);
    set({ chatMessages: [...get().chatMessages, record] });
    return record;
  },

  async markChatActionState(messageId, actionId, state) {
    const msg = get().chatMessages.find((m) => m.id === messageId);
    if (!msg || !msg.actions) return;
    const updated: ChatMessageRecord = {
      ...msg,
      actions: msg.actions.map((a) => (a.id === actionId ? { ...a, state } : a)),
    };
    await db.chatMessages.put(updated);
    set({ chatMessages: get().chatMessages.map((m) => (m.id === messageId ? updated : m)) });
  },

  async logAudit(entry) {
    await db.auditLogs.put({ ...entry, id: newId("audit"), userId: OWNER_ID, createdAt: nowIso() });
    await get().hydrate();
  },

  async setProvider(provider) {
    await db.providerConfig.put({ id: OWNER_ID, userId: OWNER_ID, provider });
    await get().hydrate();
  },

  async updatePreferences(patch) {
    const prefs = get().preferences;
    if (!prefs) return;
    await db.preferences.put({ ...prefs, ...patch });
    await get().hydrate();
  },

  async eraseEverything() {
    await deleteAllData();
    set({
      hydrated: true,
      user: null,
      preferences: null,
      paySchedule: null,
      paychecks: [],
      plans: [],
      bills: [],
      goals: [],
      expenses: [],
      notes: [],
      memories: [],
      memoryProposals: [],
      chatMessages: [],
      auditLogs: [],
      providerConfig: null,
    });
  },
}));

function addDaysIso(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function toGoalInput(g: GoalRecord): GoalAllocationInput {
  return {
    id: g.id,
    name: g.name,
    price: g.price,
    saved: g.saved,
    perCheckContribution: g.perCheckContribution,
    priority: g.priority,
    paused: g.state === "paused",
    ...(g.targetDate ? { targetDate: g.targetDate } : {}),
  };
}

// ---------------------------------------------------------------------------
// Derived selectors — always computed through the domain engine.
// ---------------------------------------------------------------------------

export function selectCurrentPlan(state: {
  plans: BudgetPlanRecord[];
}): BudgetPlanRecord | null {
  return state.plans.length > 0 ? state.plans[state.plans.length - 1]! : null;
}

export function selectPreviousPlan(state: {
  plans: BudgetPlanRecord[];
}): BudgetPlanRecord | null {
  return state.plans.length > 1 ? state.plans[state.plans.length - 2]! : null;
}

export function selectSafeToSpend(state: {
  plans: BudgetPlanRecord[];
  expenses: ExpenseEntryRecord[];
}): SafeToSpendResult | null {
  const plan = selectCurrentPlan(state);
  if (!plan) return null;
  return calculateSafeToSpend(
    {
      paycheckId: plan.paycheckId,
      netPay: plan.netPay,
      payDate: plan.payDate,
      nextPayDate: plan.nextPayDate,
      allocations: plan.allocations,
      safeToSpend: plan.safeToSpend,
      status: "approved",
    },
    state.expenses.map((e) => ({ id: e.id, amount: e.amount, date: e.date, label: e.label })),
  );
}

export function selectGoalForecast(
  state: { paySchedule: PayScheduleRecord | null },
  goal: GoalRecord,
  fromDate: IsoDate,
): GoalForecast | null {
  if (!state.paySchedule) return null;
  return forecastGoalCompletion(
    toGoalInput(goal),
    state.paySchedule.frequency,
    state.paySchedule.anchorPayDate,
    fromDate,
  );
}

export function selectPrimaryGoal(state: { goals: GoalRecord[] }): GoalRecord | null {
  const order = { high: 0, medium: 1, low: 2 } as const;
  const active = state.goals.filter((g) => g.state === "active");
  if (active.length === 0) return null;
  return [...active].sort(
    (a, b) => order[a.priority] - order[b.priority] || a.name.localeCompare(b.name),
  )[0]!;
}

/** One useful, always-true insight derived from real stored data. */
export function selectInsight(state: {
  plans: BudgetPlanRecord[];
  expenses: ExpenseEntryRecord[];
}): string | null {
  const current = selectCurrentPlan(state);
  const previous = selectPreviousPlan(state);
  if (current && previous) {
    const delta = current.safeToSpend.amount - previous.safeToSpend.amount;
    if (delta !== 0) {
      const dollars = Math.abs(delta) / 100;
      const formatted = dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
      return delta > 0
        ? `You have ${formatted} more flexible money than last check.`
        : `This check has ${formatted} less flexible money — a heavier bill period.`;
    }
  }
  return null;
}
