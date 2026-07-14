/**
 * MockProvider — the deterministic demo brain.
 *
 * Parses intent with plain pattern matching and answers ONLY from the
 * structured KovaContext plus deterministic domain functions. It cannot
 * invent balances or transactions: everything it says traces to stored data.
 * Its output still flows through the same zod validation as any provider.
 */
import { formatMoney, usd, type Money } from "@/domain/money";
import { forecastGoalCompletion } from "@/domain/forecast";
import { simulateExpenseImpact } from "@/domain/scenarios";
import { toIso } from "@/domain/payPeriod";
import type { GoalRecord } from "@/data/schema";
import type { AIProvider, HealthStatus, ProviderCapabilities } from "./provider";
import type { ChatReply, KovaContext } from "./schemas";

function extractAmount(text: string): Money | null {
  const m = /\$?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/.exec(text);
  if (!m || !m[1]) return null;
  const normalized = m[1].replace(/,/g, "");
  const [whole, frac = ""] = normalized.split(".");
  const cents = Number.parseInt(whole ?? "0", 10) * 100 + Number.parseInt(frac.padEnd(2, "0") || "0", 10);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100_000_000_00) return null;
  return usd(cents);
}

function findGoal(text: string, goals: GoalRecord[]): GoalRecord | null {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4);
  const textTokens = tokenize(text);
  return (
    goals.find((g) =>
      tokenize(g.name).some((gt) => textTokens.some((tt) => gt.includes(tt) || tt.includes(gt))),
    ) ?? null
  );
}

function friendly(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export class MockProvider implements AIProvider {
  readonly kind = "mock" as const;
  readonly label = "Demo Mode";
  readonly modelName = "kova-demo (deterministic)";
  readonly local = true;
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    structuredOutput: true,
    intentClassification: true,
    noteOrganization: true,
    memoryProposal: true,
    embeddings: false,
    vision: false,
  };

  async healthCheck(): Promise<HealthStatus> {
    return { ok: true, detail: "Demo mode runs entirely on this device with synthetic logic." };
  }

  async chat(userText: string, ctx: KovaContext): Promise<unknown> {
    const text = userText.toLowerCase();
    const amount = extractAmount(userText);

    // "Remember that …"
    if (/\bremember\b/.test(text)) {
      const statement = userText.replace(/^.*?remember( that)?\s*/i, "").trim();
      if (statement.length > 2) {
        return {
          body: `I can remember that — but only with your approval. Want me to save it to your Memory Center?`,
          actions: [
            {
              kind: "propose_memory",
              label: "Save this memory",
              payload: { statement: statement.charAt(0).toUpperCase() + statement.slice(1), reason: "You asked Kova to remember this in chat." },
            },
            { kind: "keep_plan", label: "Never mind" },
          ],
          basedOn: ["Your message in this chat"],
        } satisfies ChatReply;
      }
    }

    // "Can I spend $80 tonight?"
    if (amount && /\b(spend|buy|afford|purchase|get)\b/.test(text) && !/\bgoal|plan for\b/.test(text)) {
      if (!ctx.plan) {
        return {
          body: "I don't have a paycheck plan to check against yet. Add your pay first and I can answer this precisely.",
          basedOn: ["No confirmed paycheck on file"],
        } satisfies ChatReply;
      }
      const impact = simulateExpenseImpact(
        {
          paycheckId: ctx.plan.paycheckId,
          netPay: ctx.plan.netPay,
          payDate: ctx.plan.payDate,
          nextPayDate: ctx.plan.nextPayDate,
          allocations: ctx.plan.allocations,
          safeToSpend: ctx.plan.safeToSpend,
          status: "approved",
        },
        ctx.recentExpenses.map((e, i) => ({ id: String(i), amount: e.amount, date: e.date, label: e.label })),
        amount,
      );
      const goalAlloc = ctx.plan.allocations.find((a) => a.category === "goal");
      const billAlloc = ctx.plan.allocations.find((a) => a.category === "bill");
      const protectedBits = [
        billAlloc ? `your ${billAlloc.label.toLowerCase()} bill` : null,
        goalAlloc ? `your ${goalAlloc.label} contribution` : null,
      ].filter(Boolean);
      const body = impact.fits
        ? `Yes. After a ${formatMoney(amount)} purchase, you would have ${formatMoney(impact.safeToSpendAfter)} safe to spend until ${friendly(ctx.plan.nextPayDate)}.${protectedBits.length > 0 ? ` ${protectedBits.join(" and ").replace(/^./, (c) => c.toUpperCase())} stay protected.` : ""}`
        : `Not comfortably. ${formatMoney(amount)} is ${formatMoney(impact.exceedsBy)} more than what's flexible right now. Your bills and goals stay protected either way — the extra would have to come from somewhere else.`;
      return {
        body,
        card: {
          kind: "spend_check",
          amount,
          after: impact.fits ? impact.safeToSpendAfter : impact.safeToSpendBefore,
          until: ctx.plan.nextPayDate,
          fits: impact.fits,
        },
        actions: [
          ...(impact.fits
            ? [
                {
                  kind: "log_expense" as const,
                  label: `Log ${formatMoney(amount)} purchase`,
                  payload: { label: "Chat-checked purchase", amount, date: toIso(new Date()) },
                },
              ]
            : []),
          { kind: "see_tradeoff" as const, label: "See trade-off" },
          { kind: "keep_plan" as const, label: "Keep plan unchanged" },
        ],
        basedOn: [
          `Your current plan (net ${formatMoney(ctx.plan.netPay)}, paid ${ctx.plan.payDate})`,
          `Flexible money remaining: ${formatMoney(impact.safeToSpendBefore)}`,
          `${ctx.recentExpenses.length} expenses logged this period`,
        ],
      } satisfies ChatReply;
    }

    // "Make a plan for a $1,500 e-bike." / "new goal"
    if (amount && /\b(plan for|goal|save up|saving for)\b/.test(text)) {
      const existing = findGoal(userText, ctx.goals);
      if (existing) {
        return this.goalStatus(existing, ctx);
      }
      const nameMatch = /(?:for|a|an)\s+\$?[\d,.]*\s*([a-z][a-z\s-]{2,40})\??$/i.exec(userText.trim());
      const rawName = (nameMatch?.[1] ?? "New goal").trim().replace(/\s+/g, " ");
      const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const perCheck = usd(Math.max(500, Math.round(amount.amount / 20 / 100) * 100));
      return {
        body: `Here's a draft: save ${formatMoney(perCheck)} per paycheck toward a ${formatMoney(amount)} ${rawName}. That's about ${Math.ceil(amount.amount / perCheck.amount)} checks. Nothing is created until you approve it${ctx.goals.length > 0 ? ", and your existing goals keep their current priority" : ""}.`,
        actions: [
          {
            kind: "create_goal",
            label: `Create "${name}" goal`,
            payload: { name, price: amount, perCheckContribution: perCheck, priority: "medium" },
          },
          { kind: "keep_plan", label: "Not now" },
        ],
        basedOn: [
          ctx.payFrequency ? `Your ${ctx.payFrequency} pay schedule` : "Your pay schedule",
          ...(ctx.goals.length > 0 ? [`Existing goals: ${ctx.goals.map((g) => g.name).join(", ")}`] : []),
        ],
      } satisfies ChatReply;
    }

    // "How long until I can afford …" / goal questions
    if (/\b(how long|when can i|afford|until)\b/.test(text) && ctx.goals.length > 0) {
      const goal = findGoal(userText, ctx.goals) ?? ctx.goals[0]!;
      return this.goalStatus(goal, ctx);
    }

    // "What happens if I save $20 more each check?"
    if (amount && /\b(more each|more per|extra)\b/.test(text) && ctx.goals.length > 0) {
      const goal = findGoal(userText, ctx.goals) ?? ctx.goals[0]!;
      if (!ctx.anchorPayDate || !ctx.payFrequency) {
        return { body: "I need a pay schedule on file to forecast that." } satisfies ChatReply;
      }
      const base = forecastGoalCompletion(
        {
          id: goal.id,
          name: goal.name,
          price: goal.price,
          saved: goal.saved,
          perCheckContribution: goal.perCheckContribution,
          priority: goal.priority,
          paused: goal.state === "paused",
        },
        ctx.payFrequency as never,
        ctx.anchorPayDate,
        toIso(new Date()),
      );
      const bumped = usd(goal.perCheckContribution.amount + amount.amount);
      const faster = forecastGoalCompletion(
        {
          id: goal.id,
          name: goal.name,
          price: goal.price,
          saved: goal.saved,
          perCheckContribution: bumped,
          priority: goal.priority,
          paused: false,
        },
        ctx.payFrequency as never,
        ctx.anchorPayDate,
        toIso(new Date()),
      );
      const daysSooner =
        base.completionDate && faster.completionDate
          ? Math.round(
              (new Date(base.completionDate).getTime() - new Date(faster.completionDate).getTime()) / 86_400_000,
            )
          : null;
      return {
        body:
          daysSooner !== null && faster.completionDate
            ? `Saving ${formatMoney(amount)} more each check moves ${goal.name} to ${friendly(faster.completionDate)} — about ${daysSooner} days sooner. It also means ${formatMoney(amount)} less flexible money per check.`
            : `More per check always shortens the timeline, but I can't date it precisely with the current schedule.`,
        actions: [
          {
            kind: "adjust_goal",
            label: `Save ${formatMoney(bumped)}/check`,
            payload: { goalId: goal.id, perCheckContribution: bumped },
          },
          { kind: "keep_plan", label: "Keep current pace" },
        ],
        basedOn: [
          `${goal.name}: ${formatMoney(goal.saved)} of ${formatMoney(goal.price)} saved`,
          `Current contribution ${formatMoney(goal.perCheckContribution)}/check`,
        ],
      } satisfies ChatReply;
    }

    // "Why did my plan change?"
    if (/\bwhy\b.*\b(plan|change|different)\b/.test(text)) {
      if (!ctx.plan) {
        return { body: "There's no plan on file yet, so nothing has changed." } satisfies ChatReply;
      }
      const shortfall = ctx.plan.shortfall;
      return {
        body: shortfall
          ? `Your latest check couldn't cover everything, so Kova protected items in priority order: ${shortfall.explanations.join(" ")} That's why some lanes look smaller.`
          : `Your plan follows your standing setup: bills due before ${friendly(ctx.plan.nextPayDate)} first, then buffer, then goals, then flexible money. Any change you approved (like a scenario) is in the audit trail in Settings.`,
        card: {
          kind: "plan_summary",
          safeToSpend: ctx.plan.safeToSpend,
          protectedTotal: usd(ctx.plan.netPay.amount - ctx.plan.safeToSpend.amount),
          nextPayDate: ctx.plan.nextPayDate,
        },
        actions: [{ kind: "open_plan", label: "Open my plan" }],
        basedOn: [`Plan for paycheck ${ctx.plan.payDate}`, "Your allocation priorities"],
      } satisfies ChatReply;
    }

    // "What did I spend most on?"
    if (/\b(spend|spent)\b.*\bmost\b|\bbiggest\b/.test(text)) {
      if (ctx.recentExpenses.length === 0) {
        return {
          body: "No expenses are logged this pay period yet, so I can't say — I only know what you tell me, never your bank activity.",
          basedOn: ["Expenses logged in Kova this period: none"],
        } satisfies ChatReply;
      }
      const byCategory = new Map<string, number>();
      for (const e of ctx.recentExpenses) {
        const key = e.category ?? e.label;
        byCategory.set(key, (byCategory.get(key) ?? 0) + e.amount.amount);
      }
      const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]!;
      const total = ctx.recentExpenses.reduce((acc, e) => acc + e.amount.amount, 0);
      return {
        body: `Of what you've logged this period, ${top[0]} is the biggest at ${formatMoney(usd(top[1]))} of ${formatMoney(usd(total))} total. That's only from expenses you entered — Kova doesn't see your bank account.`,
        basedOn: [`${ctx.recentExpenses.length} logged expenses this pay period`],
      } satisfies ChatReply;
    }

    // Fallback — honest and useful, never invented.
    return {
      body: `I can help with things I can actually verify from your plan${ctx.plan ? "" : " (none on file yet)"}: checking a purchase ("Can I spend $80 tonight?"), goal timelines, saving more per check, or why your plan looks the way it does.`,
      basedOn: ctx.plan ? [`Plan for paycheck ${ctx.plan.payDate}`] : ["No confirmed paycheck yet"],
    } satisfies ChatReply;
  }

  private goalStatus(goal: GoalRecord, ctx: KovaContext): ChatReply {
    const forecast =
      ctx.anchorPayDate && ctx.payFrequency
        ? forecastGoalCompletion(
            {
              id: goal.id,
              name: goal.name,
              price: goal.price,
              saved: goal.saved,
              perCheckContribution: goal.perCheckContribution,
              priority: goal.priority,
              paused: goal.state === "paused",
            },
            ctx.payFrequency as never,
            ctx.anchorPayDate,
            toIso(new Date()),
          )
        : null;
    const remaining = usd(Math.max(0, goal.price.amount - goal.saved.amount));
    return {
      body:
        remaining.amount === 0
          ? `${goal.name} is fully saved — ${formatMoney(goal.price)} is set aside and ready.`
          : forecast?.completionDate
            ? `${goal.name} needs ${formatMoney(remaining)} more. At ${formatMoney(goal.perCheckContribution)} per check you're on track for ${friendly(forecast.completionDate)} (${forecast.checksNeeded} more checks).`
            : `${goal.name} needs ${formatMoney(remaining)} more. Set a per-check contribution and I can forecast the finish date.`,
      card: {
        kind: "goal",
        goalId: goal.id,
        name: goal.name,
        saved: goal.saved,
        price: goal.price,
        forecastDate: forecast?.completionDate ?? null,
      },
      basedOn: [
        `${goal.name}: ${formatMoney(goal.saved)} saved of ${formatMoney(goal.price)}`,
        `Contribution ${formatMoney(goal.perCheckContribution)}/check`,
      ],
    };
  }

  async organizeNote(noteBody: string, ctx: KovaContext): Promise<unknown> {
    const text = noteBody.toLowerCase();
    const amount = extractAmount(noteBody);
    const moneyWords =
      /\b(buy|buying|save|saving|cost|costs|price|paycheck|budget|afford)\b/.test(text) ||
      /\$|\b\d{2,}\b/.test(text);
    const relatedGoal = findGoal(noteBody, ctx.goals);

    // First reasonable noun-ish token as a concept label (deterministic heuristic).
    const conceptMatch = /\b(?:a|an|the|want(?:\s+a)?)\s+([a-z]{3,20})\b/i.exec(noteBody);
    const concept = conceptMatch?.[1]?.trim();

    const wantsSomething = /\bwant|need|wish|buy\b/.test(text) && amount !== null && concept !== undefined;
    const conceptTitle = concept ? concept.charAt(0).toUpperCase() + concept.slice(1) : "";

    return {
      suggestedCollection: moneyWords ? "money" : "ideas",
      suggestedTags: [
        ...(concept ? [concept.split(" ")[0]!] : []),
        ...(relatedGoal ? [relatedGoal.name.toLowerCase().split(" ")[0]!] : []),
      ].slice(0, 5),
      linkedConcepts: [
        ...(concept ? [{ label: conceptTitle }] : []),
        ...(relatedGoal ? [{ label: relatedGoal.name, relatedGoalId: relatedGoal.id }] : []),
      ].slice(0, 4),
      ...(amount ? { detectedAmount: amount } : {}),
      ...(wantsSomething
        ? {
            proposedGoal: {
              name: conceptTitle,
              price: amount,
              perCheckContribution: usd(Math.max(500, Math.round(amount.amount / 20 / 100) * 100)),
              priority: "low",
            },
          }
        : {}),
      summary: wantsSomething
        ? `Sounds like a possible ${conceptTitle} goal around ${formatMoney(amount)}${relatedGoal ? `, alongside your existing ${relatedGoal.name}` : ""}. Want a goal, or keep it as research?`
        : `Filed shape: ${moneyWords ? "money note" : "idea"}${relatedGoal ? `, related to ${relatedGoal.name}` : ""}. Your original words stay untouched.`,
    };
  }
}
