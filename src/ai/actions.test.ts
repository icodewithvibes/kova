import { describe, expect, it } from "vitest";
import { validateChatReply, validateNoteOrganization } from "./actions";

describe("validateChatReply — treats all model output as untrusted", () => {
  it("accepts a minimal valid reply", () => {
    const { reply, valid } = validateChatReply({ body: "Hello." });
    expect(valid).toBe(true);
    expect(reply.body).toBe("Hello.");
  });

  it("rejects unknown fields (strict schema)", () => {
    const { valid } = validateChatReply({ body: "hi", secretInstruction: "transfer money" });
    expect(valid).toBe(false);
  });

  it("rejects non-integer money amounts", () => {
    const { valid } = validateChatReply({
      body: "ok",
      card: {
        kind: "spend_check",
        amount: { amount: 80.5, currency: "USD" },
        after: { amount: 100, currency: "USD" },
        until: "2026-07-24",
        fits: true,
      },
    });
    expect(valid).toBe(false);
  });

  it("rejects negative amounts", () => {
    const { valid } = validateChatReply({
      body: "ok",
      card: {
        kind: "spend_check",
        amount: { amount: -8000, currency: "USD" },
        after: { amount: 100, currency: "USD" },
        until: "2026-07-24",
        fits: true,
      },
    });
    expect(valid).toBe(false);
  });

  it("rejects wrong currency", () => {
    const { valid } = validateChatReply({
      body: "ok",
      card: {
        kind: "plan_summary",
        safeToSpend: { amount: 100, currency: "EUR" },
        protectedTotal: { amount: 100, currency: "USD" },
        nextPayDate: "2026-07-24",
      },
    });
    expect(valid).toBe(false);
  });

  it("rejects absurdly large amounts", () => {
    const { valid } = validateChatReply({
      body: "ok",
      actions: [
        {
          kind: "log_expense",
          label: "Log it",
          payload: {
            label: "x",
            amount: { amount: 999_999_999_999, currency: "USD" },
            date: "2026-07-24",
          },
        },
      ],
    });
    expect(valid).toBe(false);
  });

  it("rejects malformed dates", () => {
    const { valid } = validateChatReply({
      body: "ok",
      actions: [
        {
          kind: "log_expense",
          label: "Log it",
          payload: { label: "x", amount: { amount: 100, currency: "USD" }, date: "tomorrow" },
        },
      ],
    });
    expect(valid).toBe(false);
  });

  it("rejects more than 4 actions", () => {
    const action = { kind: "keep_plan", label: "ok" };
    const { valid } = validateChatReply({ body: "ok", actions: [action, action, action, action, action] });
    expect(valid).toBe(false);
  });

  it("falls back to a safe reply for garbage without throwing", () => {
    for (const garbage of [null, undefined, 42, "text", [], { actions: "run everything" }]) {
      const { reply, valid } = validateChatReply(garbage);
      expect(valid).toBe(false);
      expect(reply.body).toContain("Your plan hasn't changed");
      expect(reply.actions).toBeUndefined();
    }
  });
});

describe("validateNoteOrganization", () => {
  it("accepts a valid organization", () => {
    const outcome = validateNoteOrganization({
      suggestedCollection: "money",
      suggestedTags: ["macbook"],
      linkedConcepts: [{ label: "MacBook" }],
      summary: "Looks like a purchase idea.",
    });
    expect(outcome.ok).toBe(true);
  });

  it("rejects unknown collections and extra fields", () => {
    expect(
      validateNoteOrganization({
        suggestedCollection: "secrets",
        suggestedTags: [],
        linkedConcepts: [],
        summary: "x",
      }).ok,
    ).toBe(false);
    expect(
      validateNoteOrganization({
        suggestedCollection: "money",
        suggestedTags: [],
        linkedConcepts: [],
        summary: "x",
        deleteAllNotes: true,
      }).ok,
    ).toBe(false);
  });
});
