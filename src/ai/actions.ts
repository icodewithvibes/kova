/**
 * The AI action pipeline: schema parse → business-rule validation → safe
 * fallback. Execution (store mutation + audit) happens ONLY from an explicit
 * user tap in the UI — never from inside this module.
 */
import { chatReplySchema, noteOrganizationSchema, type ChatReply, type NoteOrganization } from "./schemas";

export interface ValidationOutcome<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

const FALLBACK_REPLY: ChatReply = {
  body: "I couldn't put together a reliable answer for that. Your plan hasn't changed. Try asking about spending an amount, a goal, or your plan.",
};

/** Parse + validate an untrusted chat reply. Falls back safely, never throws. */
export function validateChatReply(raw: unknown): { reply: ChatReply; valid: boolean } {
  const parsed = chatReplySchema.safeParse(raw);
  if (!parsed.success) {
    return { reply: FALLBACK_REPLY, valid: false };
  }
  // Business rules beyond the schema: amounts already bounded by moneySchema;
  // enforce action count and non-empty labels are handled by zod. Extra rule:
  // a spend card must never report a negative "after" value.
  if (parsed.data.card?.kind === "spend_check" && parsed.data.card.after.amount < 0) {
    return { reply: FALLBACK_REPLY, valid: false };
  }
  return { reply: parsed.data, valid: true };
}

export function validateNoteOrganization(raw: unknown): ValidationOutcome<NoteOrganization> {
  const parsed = noteOrganizationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Suggestion didn't validate — keeping your note exactly as written." };
  }
  return { ok: true, value: parsed.data };
}
