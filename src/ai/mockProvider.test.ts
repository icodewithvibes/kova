import { describe, expect, it } from "vitest";
import { usd } from "@/domain/money";
import { validateChatReply, validateNoteOrganization } from "./actions";
import { MockProvider } from "./mockProvider";
import type { KovaContext } from "./schemas";

const goal = {
  id: "g1",
  userId: "local-owner",
  name: "E-bike Fund",
  price: usd(150_000),
  saved: usd(85_000),
  perCheckContribution: usd(6_500),
  priority: "high" as const,
  state: "active" as const,
  kind: "purchase" as const,
  createdAt: "2026-06-20T00:00:00.000Z",
};

const ctx: KovaContext = {
  displayName: "Test",
  plan: {
    id: "plan1",
    userId: "local-owner",
    paycheckId: "pc1",
    payDate: "2026-07-10",
    nextPayDate: "2026-07-24",
    netPay: usd(98_500),
    allocations: [
      {
        id: "a1",
        category: "bill",
        refId: "b1",
        label: "Phone",
        planned: usd(4_500),
        funded: usd(4_500),
        priorityRank: 0,
        reason: "bill_due_before_next_payday",
      },
      {
        id: "a2",
        category: "goal",
        refId: "g1",
        label: "E-bike Fund",
        planned: usd(6_500),
        funded: usd(6_500),
        priorityRank: 1,
        reason: "goal_minimum_contribution",
      },
      {
        id: "a3",
        category: "flexible",
        label: "Flexible spending",
        planned: usd(40_075),
        funded: usd(40_075),
        priorityRank: 2,
        reason: "flexible_remainder",
      },
    ],
    safeToSpend: usd(40_075),
    status: "approved",
    createdAt: "2026-07-10T00:00:00.000Z",
  },
  safeToSpend: null,
  goals: [goal],
  memories: [],
  recentExpenses: [{ label: "Groceries", amount: usd(22_655), date: "2026-07-11", category: "food" }],
  payFrequency: "biweekly",
  anchorPayDate: "2026-07-10",
};

const provider = new MockProvider();

describe("MockProvider chat — every reply passes the strict schema", () => {
  const prompts = [
    "Can I spend $80 tonight?",
    "Why did my plan change?",
    "How long until I can afford the e-bike?",
    "What happens if I save $20 more each check?",
    "Make a plan for a $600 laptop",
    "What did I spend most on?",
    "remember that fridays are heavy tip nights",
    "asdf qwerty nonsense",
  ];

  for (const prompt of prompts) {
    it(`"${prompt}" → valid schema`, async () => {
      const raw = await provider.chat(prompt, ctx);
      const { valid } = validateChatReply(raw);
      expect(valid).toBe(true);
    });
  }

  it("spend check computes deterministically: $80 against $174.20 remaining", async () => {
    const raw = (await provider.chat("Can I spend $80 tonight?", ctx)) as {
      body: string;
      card: { after: { amount: number } };
    };
    // 40075 flexible − 22655 spent = 17420 remaining; 17420 − 8000 = 9420
    expect(raw.card.after.amount).toBe(9_420);
    expect(raw.body).toContain("$94.20");
  });

  it("never claims bank knowledge when no expenses exist", async () => {
    const raw = (await provider.chat("What did I spend most on?", { ...ctx, recentExpenses: [] })) as {
      body: string;
    };
    expect(raw.body.toLowerCase()).toContain("i only know what you tell me");
  });
});

describe("MockProvider organizeNote — MacBook demo scenario", () => {
  it("preserves raw note, links the existing goal, proposes without mutating", async () => {
    const raw = await provider.organizeNote(
      "want a macbook for coding maybe used around 600 but still saving for bike",
      ctx,
    );
    const outcome = validateNoteOrganization(raw);
    expect(outcome.ok).toBe(true);
    const org = outcome.value!;
    expect(org.suggestedCollection).toBe("money");
    expect(org.detectedAmount?.amount).toBe(60_000);
    expect(org.proposedGoal?.price.amount).toBe(60_000);
    // Links the existing e-bike goal rather than touching it.
    expect(org.linkedConcepts.some((c) => c.relatedGoalId === "g1")).toBe(true);
  });
});
