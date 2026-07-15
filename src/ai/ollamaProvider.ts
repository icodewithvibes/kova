/**
 * OllamaProvider — real local/cloud-hybrid provider over the Ollama HTTP API.
 *
 * - Talks ONLY to the user-configured base URL (default http://localhost:11434).
 * - Structured outputs: the request's `format` field carries a JSON Schema
 *   derived from the same zod schema the validation pipeline uses, so the
 *   decoder itself is constrained — and the response STILL goes through
 *   validateChatReply/validateNoteOrganization like every provider.
 * - Cloud models (names ending in "-cloud") execute on Ollama's servers via
 *   the local daemon after the user signs in with `ollama signin`. Kova sends
 *   the same structured summaries either way — never documents or images.
 * - This provider proposes; it never mutates. Approval + audit happen outside.
 */
import { z } from "zod";
import type { AIProvider, HealthStatus, ProviderCapabilities } from "./provider";
import { chatReplySchema, noteOrganizationSchema, type KovaContext } from "./schemas";
import { formatMoney } from "@/domain/money";

const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Ollama's grammar compiler (llama.cpp) accepts only a subset of JSON Schema:
 * `oneOf` (zod discriminated unions), string `pattern`, and string
 * `minLength`/`maxLength` all fail with "failed to parse grammar" (verified
 * against Ollama 0.32.0). The format schema only constrains DECODING shape;
 * the full zod schema still validates the response app-side, so dropping
 * those keywords here loses nothing.
 */
const UNSUPPORTED_KEYS = new Set(["$schema", "pattern", "minLength", "maxLength"]);

export function toOllamaFormat(schema: z.ZodType): unknown {
  const raw = z.toJSONSchema(schema);
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node !== null && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node)) {
        if (UNSUPPORTED_KEYS.has(key)) continue;
        out[key === "oneOf" ? "anyOf" : key] = walk(value);
      }
      return out;
    }
    return node;
  };
  return walk(raw);
}

function contextSummary(ctx: KovaContext): string {
  const lines: string[] = [`User's name: ${ctx.displayName}.`];
  if (ctx.plan) {
    lines.push(
      `Current paycheck plan: net pay ${formatMoney(ctx.plan.netPay)}, paid ${ctx.plan.payDate}, next payday ${ctx.plan.nextPayDate}.`,
      `Allocations: ${ctx.plan.allocations
        .map((a) => `${a.label} (${a.category}) funded ${formatMoney(a.funded)}`)
        .join("; ")}.`,
      `Flexible pool at plan time: ${formatMoney(ctx.plan.safeToSpend)}.`,
    );
  } else {
    lines.push("No confirmed paycheck plan exists yet.");
  }
  if (ctx.safeToSpend) {
    lines.push(
      `Safe to spend right now: ${formatMoney(ctx.safeToSpend.amount)} until ${ctx.safeToSpend.until} (flexible pool ${formatMoney(ctx.safeToSpend.flexiblePool)}, spent ${formatMoney(ctx.safeToSpend.flexibleSpent)}).`,
    );
  }
  for (const g of ctx.goals) {
    lines.push(
      `Goal "${g.name}" (id ${g.id}): price ${formatMoney(g.price)}, saved ${formatMoney(g.saved)}, ${formatMoney(g.perCheckContribution)}/check, priority ${g.priority}, state ${g.state}.`,
    );
  }
  if (ctx.recentExpenses.length > 0) {
    lines.push(
      `Expenses logged this period: ${ctx.recentExpenses
        .map((e) => `${e.label} ${formatMoney(e.amount)} on ${e.date}`)
        .join("; ")}.`,
    );
  } else {
    lines.push("No expenses logged this period.");
  }
  if (ctx.memories.length > 0) {
    lines.push(`Approved memories: ${ctx.memories.map((m) => `"${m.statement}"`).join(" ")}`);
  }
  if (ctx.payFrequency) lines.push(`Pay frequency: ${ctx.payFrequency}, anchor pay date ${ctx.anchorPayDate}.`);
  return lines.join("\n");
}

const CHAT_SYSTEM_PROMPT = `You are Kova, a calm, precise, nonjudgmental paycheck-planning assistant.

Hard rules:
- Use ONLY the figures in the context block. Never invent balances, transactions, or bank data — Kova only knows what the user logged.
- All money amounts in your JSON are INTEGER CENTS in USD (e.g. $80 = 8000).
- Dates are ISO YYYY-MM-DD.
- You may PROPOSE actions (log_expense, create_goal, adjust_goal, propose_memory) but nothing happens without the user's explicit approval, so phrase proposals as offers.
- Never claim tax figures are exact; they are planning estimates.
- No shame, no hype, no exclamation marks about money. Short, plain sentences.
- "basedOn" must list the exact context facts you used.
- If you cannot answer reliably from the context, say so plainly in "body" and offer no actions.`;

const NOTE_SYSTEM_PROMPT = `You organize a private note for Kova, a paycheck-planning app. Suggest a collection, up to 5 short tags, and linked concepts. If the note clearly describes wanting to buy something with a price, you may include a proposedGoal (amounts in integer cents, USD). relatedGoalId must be an id from the context's goals, if truly related. The user's raw note text is preserved no matter what; your suggestions are optional and require approval. Summary: 1-2 calm sentences.`;

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

export class OllamaProvider implements AIProvider {
  readonly kind = "ollama" as const;
  readonly label: string;
  readonly local: boolean;
  readonly modelName: string;
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    structuredOutput: true,
    intentClassification: true,
    noteOrganization: true,
    memoryProposal: true,
    embeddings: false,
    vision: false,
  };

  constructor(private config: OllamaConfig) {
    this.modelName = config.model;
    // "-cloud" models execute on Ollama's servers through the local daemon.
    this.local = !config.model.endsWith("-cloud");
    this.label = this.local ? "Private Local (Ollama)" : "Ollama Cloud (free tier)";
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(4_000),
      });
      if (!res.ok) return { ok: false, detail: `Ollama responded ${res.status}.` };
      const data = (await res.json()) as { models?: Array<{ name: string; model: string }> };
      const names = (data.models ?? []).map((m) => m.model ?? m.name);
      const havePulled = names.some((n) => n === this.config.model || n.startsWith(`${this.config.model}`));
      if (!havePulled && this.local) {
        return {
          ok: false,
          detail: `Ollama is running but "${this.config.model}" isn't pulled. Run: ollama pull ${this.config.model}`,
        };
      }
      return {
        ok: true,
        detail: this.local
          ? `Ollama running at ${this.config.baseUrl}; model ${this.config.model} available. Everything stays on this machine.`
          : `Ollama running; "${this.config.model}" executes on Ollama's cloud (free tier limits apply). Requires "ollama signin". Structured summaries only — never documents.`,
      };
    } catch {
      return { ok: false, detail: `Can't reach Ollama at ${this.config.baseUrl}. Is the service running?` };
    }
  }

  private async structured(system: string, user: string, schema: z.ZodType): Promise<unknown> {
    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model: this.config.model,
        stream: false,
        // Thinking off: faster on CPU, and the reply must be pure schema JSON.
        think: false,
        // Decoder-level schema enforcement (Ollama structured outputs).
        format: toOllamaFormat(schema),
        options: { temperature: 0.2 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ollama /api/chat failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content ?? "";
    try {
      return JSON.parse(content);
    } catch {
      // Malformed JSON → let the validation pipeline produce the safe fallback.
      return { malformed: content.slice(0, 100) };
    }
  }

  async chat(userText: string, ctx: KovaContext): Promise<unknown> {
    const user = `CONTEXT (the only facts you may use):\n${contextSummary(ctx)}\n\nUSER MESSAGE:\n${userText}`;
    return this.structured(CHAT_SYSTEM_PROMPT, user, chatReplySchema);
  }

  async organizeNote(noteBody: string, ctx: KovaContext): Promise<unknown> {
    const user = `CONTEXT:\n${contextSummary(ctx)}\n\nNOTE TO ORGANIZE (preserve as-is, only suggest):\n${noteBody}`;
    return this.structured(NOTE_SYSTEM_PROMPT, user, noteOrganizationSchema);
  }
}
