/**
 * Kova local database — Dexie over IndexedDB.
 *
 * MVP privacy note (documented in docs/security-and-privacy.md): IndexedDB is
 * not encrypted at rest the way SQLCipher is. This MVP holds ONLY synthetic
 * data. The production path is RN/Expo + SQLCipher or OPFS + encryption.
 */
import Dexie, { type EntityTable } from "dexie";
import type {
  AIActionAuditRecord,
  BudgetPlanRecord,
  ChatMessageRecord,
  ExpenseEntryRecord,
  GoalContributionRecord,
  GoalRecord,
  MemoryProposalRecord,
  MemoryRecord,
  NoteRecord,
  PaycheckDocumentRecord,
  PaycheckRecord,
  PayScheduleRecord,
  ProviderConfigurationRecord,
  RecurringBillRecord,
  UserPreferencesRecord,
  UserRecord,
} from "./schema";

/** Single local owner id for the MVP. */
export const OWNER_ID = "local-owner";

export class KovaDb extends Dexie {
  users!: EntityTable<UserRecord, "id">;
  preferences!: EntityTable<UserPreferencesRecord, "id">;
  paySchedules!: EntityTable<PayScheduleRecord, "id">;
  paychecks!: EntityTable<PaycheckRecord, "id">;
  paycheckDocuments!: EntityTable<PaycheckDocumentRecord, "id">;
  recurringBills!: EntityTable<RecurringBillRecord, "id">;
  plans!: EntityTable<BudgetPlanRecord, "id">;
  goals!: EntityTable<GoalRecord, "id">;
  goalContributions!: EntityTable<GoalContributionRecord, "id">;
  expenses!: EntityTable<ExpenseEntryRecord, "id">;
  notes!: EntityTable<NoteRecord, "id">;
  memories!: EntityTable<MemoryRecord, "id">;
  memoryProposals!: EntityTable<MemoryProposalRecord, "id">;
  chatMessages!: EntityTable<ChatMessageRecord, "id">;
  auditLogs!: EntityTable<AIActionAuditRecord, "id">;
  providerConfig!: EntityTable<ProviderConfigurationRecord, "id">;

  constructor() {
    super("kova");
    this.version(1).stores({
      users: "id",
      preferences: "id, userId",
      paySchedules: "id, userId",
      paychecks: "id, userId, status, createdAt",
      paycheckDocuments: "id, userId, paycheckId",
      recurringBills: "id, userId, active",
      plans: "id, userId, paycheckId, payDate",
      goals: "id, userId, state",
      goalContributions: "id, userId, goalId, date",
      expenses: "id, userId, date",
      notes: "id, userId, collection, updatedAt",
      memories: "id, userId, state",
      memoryProposals: "id, userId, status",
      chatMessages: "id, userId, threadId, createdAt",
      auditLogs: "id, userId, createdAt",
      providerConfig: "id, userId",
    });
  }
}

export const db = new KovaDb();

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Wipe every owner-scoped record — the "delete everything" foundation. */
export async function deleteAllData(): Promise<void> {
  await db.delete();
  await db.open();
}

/** Export all data as a JSON-serializable object (account export foundation). */
export async function exportAllData(): Promise<Record<string, unknown[]>> {
  const dump: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    dump[table.name] = await table.toArray();
  }
  return dump;
}
