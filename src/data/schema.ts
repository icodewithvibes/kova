/**
 * Persistence schema — production-minded, owner-scoped records.
 *
 * Every record carries `userId` and every repository query filters by it
 * (single local owner in MVP; row-level security shape for any future backend).
 * Money is stored as domain Money objects (integer cents + currency).
 *
 * MVP embedding decisions (documented in docs/data-model.md):
 * - paycheck line items are embedded in PaycheckRecord
 * - plan allocations are embedded in BudgetPlanRecord
 * - note links are embedded in NoteRecord
 */
import type { Money } from "@/domain/money";
import type {
  Allocation,
  BillCategory,
  DataSource,
  GoalPriority,
  IsoDate,
  PayFrequency,
  PlanStatus,
  Shortfall,
  SourcedValue,
} from "@/domain/types";

export type Id = string;

/** The single local owner in MVP. */
export interface UserRecord {
  id: Id;
  displayName: string;
  createdAt: string;
  onboardedAt?: string;
}

export interface UserPreferencesRecord {
  id: Id; // same as userId — 1:1
  userId: Id;
  focus?: "spending" | "savings" | "bills" | "goal" | "future_fund";
  /** Region is optional and used only for illustrative tax context. */
  region?: string;
  memoryConsent: boolean;
  bufferPercentOfNet: number;
  bufferMinimumPerCheck: Money;
  futureFundPerCheck: Money;
  reducedMotionOverride?: boolean;
}

export interface PayScheduleRecord {
  id: Id;
  userId: Id;
  frequency: PayFrequency;
  /** A real pay date anchoring the cycle. */
  anchorPayDate: IsoDate;
  employer?: string;
  typicalNet?: Money;
}

export interface PaycheckLineItem {
  label: string;
  amount: SourcedValue<Money>;
  kind:
    | "earnings"
    | "tips"
    | "federal_withholding"
    | "state_withholding"
    | "social_security"
    | "medicare"
    | "other_deduction";
}

export interface PaycheckRecord {
  id: Id;
  userId: Id;
  status: "draft" | "confirmed";
  employer: SourcedValue<string>;
  payDate: SourcedValue<IsoDate>;
  periodStart: SourcedValue<IsoDate>;
  periodEnd: SourcedValue<IsoDate>;
  hours?: SourcedValue<number>;
  hourlyRate?: SourcedValue<Money>;
  tips?: SourcedValue<Money>;
  gross: SourcedValue<Money>;
  net: SourcedValue<Money>;
  lineItems: PaycheckLineItem[];
  /** Reference to the (non-retained by default) source document. */
  documentId?: Id;
  confirmedAt?: string;
  createdAt: string;
}

/** Source images live apart from normalized records; not retained by default. */
export interface PaycheckDocumentRecord {
  id: Id;
  userId: Id;
  paycheckId?: Id;
  kind: "synthetic_fixture" | "upload";
  /** MVP stores only fixture references, never real documents. */
  fixtureKey?: string;
  retained: boolean;
  createdAt: string;
}

export interface RecurringBillRecord {
  id: Id;
  userId: Id;
  name: string;
  amount: Money;
  category: BillCategory;
  /** Day of month the bill is due (1–28 for determinism). */
  dueDayOfMonth: number;
  active: boolean;
  deletedAt?: string;
}

export interface BudgetPlanRecord {
  id: Id;
  userId: Id;
  paycheckId: Id;
  payDate: IsoDate;
  nextPayDate: IsoDate;
  netPay: Money;
  allocations: Allocation[];
  safeToSpend: Money;
  status: PlanStatus;
  shortfall?: Shortfall;
  approvedAt?: string;
  createdAt: string;
}

export interface GoalRecord {
  id: Id;
  userId: Id;
  name: string;
  emoji?: string;
  price: Money;
  saved: Money;
  perCheckContribution: Money;
  priority: GoalPriority;
  state: "active" | "paused" | "completed";
  targetDate?: IsoDate;
  kind: "purchase" | "emergency" | "future_fund" | "custom";
  createdAt: string;
  deletedAt?: string;
}

export interface GoalContributionRecord {
  id: Id;
  userId: Id;
  goalId: Id;
  amount: Money;
  date: IsoDate;
  source: "plan" | "manual" | "extra";
}

export interface ExpenseEntryRecord {
  id: Id;
  userId: Id;
  amount: Money;
  label: string;
  date: IsoDate;
  category?: string;
  source: DataSource;
  createdAt: string;
}

export type NoteCollection = "money" | "ideas" | "school" | "work" | "projects" | "inbox";

export interface NoteLink {
  targetNoteId?: Id;
  targetGoalId?: Id;
  label: string;
  proposedByAI: boolean;
  accepted: boolean;
}

export interface NoteRecord {
  id: Id;
  userId: Id;
  body: string;
  collection: NoteCollection;
  tags: string[];
  links: NoteLink[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type MemorySource = "onboarding" | "chat" | "paycheck" | "note" | "manual";

export interface MemoryRecord {
  id: Id;
  userId: Id;
  statement: string;
  source: MemorySource;
  createdAt: string;
  lastConfirmedAt: string;
  state: "active" | "archived";
  deletedAt?: string;
}

export interface MemoryProposalRecord {
  id: Id;
  userId: Id;
  statement: string;
  source: MemorySource;
  reason: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  resolvedAt?: string;
}

export interface ChatMessageRecord {
  id: Id;
  userId: Id;
  threadId: Id;
  role: "user" | "kova";
  body: string;
  /** Structured extras rendered as inline cards / actions / provenance. */
  card?: ChatCard;
  actions?: ChatAction[];
  basedOn?: string[];
  createdAt: string;
}

export type ChatCard =
  | { kind: "spend_check"; amount: Money; after: Money; until: IsoDate; fits: boolean }
  | { kind: "goal"; goalId: Id; name: string; saved: Money; price: Money; forecastDate: IsoDate | null }
  | { kind: "plan_summary"; safeToSpend: Money; protectedTotal: Money; nextPayDate: IsoDate };

export interface ChatAction {
  id: Id;
  label: string;
  kind:
    | "log_expense"
    | "see_tradeoff"
    | "keep_plan"
    | "create_goal"
    | "adjust_goal"
    | "open_plan"
    | "propose_memory";
  /** Validated payload; executed ONLY after explicit user tap + confirmation. */
  payload?: unknown;
  state: "offered" | "approved" | "dismissed";
}

export interface AIActionAuditRecord {
  id: Id;
  userId: Id;
  kind: string;
  summary: string;
  /** JSON snapshot of the validated proposal. */
  payload: string;
  outcome: "proposed" | "approved" | "declined" | "rejected_invalid";
  provider: "mock" | "cloud" | "ollama";
  createdAt: string;
}

export interface ProviderConfigurationRecord {
  id: Id; // userId — 1:1
  userId: Id;
  provider: "mock" | "cloud" | "ollama";
  cloudBaseUrl?: string;
  ollamaBaseUrl?: string;
}
