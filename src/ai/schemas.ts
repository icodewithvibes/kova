/**
 * Strict schemas for every AI output that could touch the UI or data.
 * Unknown fields are rejected; money is validated as bounded integer cents.
 * Model output — even from the deterministic mock — is treated as untrusted.
 */
import { z } from "zod";
import type { Money } from "@/domain/money";
import type { IsoDate } from "@/domain/types";
import type { BudgetPlanRecord, GoalRecord, MemoryRecord } from "@/data/schema";
import type { SafeToSpendResult } from "@/domain/safeToSpend";

/** Read-only context handed to providers. Structured summaries only — never documents. */
export interface KovaContext {
  displayName: string;
  plan: BudgetPlanRecord | null;
  safeToSpend: SafeToSpendResult | null;
  goals: GoalRecord[];
  memories: MemoryRecord[];
  recentExpenses: Array<{ label: string; amount: Money; date: IsoDate; category?: string }>;
  payFrequency: string | null;
  anchorPayDate: IsoDate | null;
}

const MAX_CENTS = 100_000_000_00;

export const moneySchema = z
  .object({
    amount: z.number().int().min(0).max(MAX_CENTS),
    currency: z.literal("USD"),
  })
  .strict();

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date required");

export const chatCardSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("spend_check"),
      amount: moneySchema,
      after: moneySchema,
      until: isoDateSchema,
      fits: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("goal"),
      goalId: z.string().min(1),
      name: z.string().min(1).max(120),
      saved: moneySchema,
      price: moneySchema,
      forecastDate: isoDateSchema.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("plan_summary"),
      safeToSpend: moneySchema,
      protectedTotal: moneySchema,
      nextPayDate: isoDateSchema,
    })
    .strict(),
]);

export const logExpensePayloadSchema = z
  .object({
    label: z.string().min(1).max(120),
    amount: moneySchema,
    date: isoDateSchema,
  })
  .strict();

export const createGoalPayloadSchema = z
  .object({
    name: z.string().min(1).max(120),
    price: moneySchema,
    perCheckContribution: moneySchema,
    priority: z.enum(["high", "medium", "low"]),
  })
  .strict();

export const adjustGoalPayloadSchema = z
  .object({
    goalId: z.string().min(1),
    perCheckContribution: moneySchema,
  })
  .strict();

export const proposeMemoryPayloadSchema = z
  .object({
    statement: z.string().min(1).max(280),
    reason: z.string().min(1).max(280),
  })
  .strict();

export const chatActionSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("log_expense"), label: z.string().min(1).max(60), payload: logExpensePayloadSchema })
    .strict(),
  z
    .object({ kind: z.literal("create_goal"), label: z.string().min(1).max(60), payload: createGoalPayloadSchema })
    .strict(),
  z
    .object({ kind: z.literal("adjust_goal"), label: z.string().min(1).max(60), payload: adjustGoalPayloadSchema })
    .strict(),
  z
    .object({
      kind: z.literal("propose_memory"),
      label: z.string().min(1).max(60),
      payload: proposeMemoryPayloadSchema,
    })
    .strict(),
  z.object({ kind: z.literal("see_tradeoff"), label: z.string().min(1).max(60) }).strict(),
  z.object({ kind: z.literal("keep_plan"), label: z.string().min(1).max(60) }).strict(),
  z.object({ kind: z.literal("open_plan"), label: z.string().min(1).max(60) }).strict(),
]);

export const chatReplySchema = z
  .object({
    body: z.string().min(1).max(2000),
    card: chatCardSchema.optional(),
    actions: z.array(chatActionSchema).max(4).optional(),
    basedOn: z.array(z.string().max(200)).max(8).optional(),
  })
  .strict();

export type ChatReply = z.infer<typeof chatReplySchema>;
export type ValidatedChatAction = z.infer<typeof chatActionSchema>;

export const noteOrganizationSchema = z
  .object({
    suggestedCollection: z.enum(["money", "ideas", "school", "work", "projects", "inbox"]),
    suggestedTags: z.array(z.string().min(1).max(40)).max(5),
    linkedConcepts: z
      .array(
        z
          .object({
            label: z.string().min(1).max(80),
            relatedGoalId: z.string().optional(),
          })
          .strict(),
      )
      .max(4),
    detectedAmount: moneySchema.optional(),
    proposedGoal: createGoalPayloadSchema.optional(),
    summary: z.string().min(1).max(300),
  })
  .strict();

export type NoteOrganization = z.infer<typeof noteOrganizationSchema>;
