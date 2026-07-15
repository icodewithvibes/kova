import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, Send } from "lucide-react";
import { format } from "date-fns";
import { formatMoney, usd } from "@/domain/money";
import { fromIso } from "@/domain/payPeriod";
import { validateChatReply } from "@/ai/actions";
import { resolveActiveProvider } from "@/ai/registry";
import type { KovaContext } from "@/ai/schemas";
import { selectCurrentPlan, selectSafeToSpend, useAppStore } from "@/store/appStore";
import type { ChatMessageRecord } from "@/data/schema";
import { AmountDisplay } from "@/components/AmountDisplay";
import { ProgressBar } from "@/components/ProgressBar";
import { Disclaimer } from "@/components/Disclaimer";
import { Sheet } from "@/components/Sheet";
import "./Chat.css";

const SUGGESTED = [
  "Can I spend $80 tonight?",
  "Why did my plan change?",
  "How long until I can afford it?",
  "What happens if I save $20 more each check?",
  "Make a plan for a $1,500 e-bike.",
  "What did I spend most on?",
];

const THREAD_ID = "thread_main";

export function ChatScreen() {
  const state = useAppStore();
  const appendChatMessage = useAppStore((s) => s.appendChatMessage);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const messages = state.chatMessages.filter((m) => m.threadId === THREAD_ID);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }, [messages.length, reduced]);

  const context: KovaContext = useMemo(() => {
    const plan = selectCurrentPlan(state);
    return {
      displayName: state.user?.displayName ?? "there",
      plan,
      safeToSpend: selectSafeToSpend(state),
      goals: state.goals.filter((g) => g.state !== "completed"),
      memories: state.memories.filter((m) => m.state === "active"),
      recentExpenses: plan
        ? state.expenses
            .filter((e) => e.date >= plan.payDate && e.date <= plan.nextPayDate)
            .map((e) => ({
              label: e.label,
              amount: e.amount,
              date: e.date,
              ...(e.category ? { category: e.category } : {}),
            }))
        : [],
      payFrequency: state.paySchedule?.frequency ?? null,
      anchorPayDate: state.paySchedule?.anchorPayDate ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.plans, state.goals, state.memories, state.expenses, state.paySchedule, state.user]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setInput("");
    try {
      await appendChatMessage({ threadId: THREAD_ID, role: "user", body: trimmed });

      const preferred = state.providerConfig?.provider ?? "mock";
      const { provider, fallbackNotice: notice } = await resolveActiveProvider(preferred);
      setFallbackNotice(notice);

      let raw: unknown;
      try {
        raw = await provider.chat(trimmed, context);
      } catch (e) {
        // Provider failure is a fact the user should see, never a frozen UI.
        setFallbackNotice(
          `${provider.label} couldn't answer (${e instanceof Error ? e.message.slice(0, 120) : "request failed"}). Your plan is unchanged.`,
        );
        raw = null; // validateChatReply turns this into the safe fallback reply.
      }
      const { reply, valid } = validateChatReply(raw);
      if (!valid) {
        await useAppStore.getState().logAudit({
          kind: "chat_reply_rejected",
          summary: "A chat reply failed or didn't validate; a safe fallback was shown instead.",
          payload: "{}",
          outcome: "rejected_invalid",
          provider: provider.kind,
        });
      }

      const outgoing: Omit<ChatMessageRecord, "id" | "userId" | "createdAt"> = {
        threadId: THREAD_ID,
        role: "kova",
        body: reply.body,
      };
      // Validated by chatReplySchema (bounded integer cents), so the brand cast is sound.
      if (reply.card) outgoing.card = reply.card as NonNullable<ChatMessageRecord["card"]>;
      if (reply.actions) {
        outgoing.actions = reply.actions.map((a, i) => ({
          id: `act_${Date.now()}_${i}`,
          label: a.label,
          kind: a.kind,
          ...("payload" in a ? { payload: a.payload } : {}),
          state: "offered" as const,
        }));
      }
      if (reply.basedOn) outgoing.basedOn = reply.basedOn;
      await appendChatMessage(outgoing);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kv-screen kv-chat">
      <header className="kv-screen__header">
        <div>
          <h1 className="kv-title">Ask Kova</h1>
          <p className="kv-micro">
            Answers come from your plan and the numbers you've logged — never from data Kova doesn't
            have.
          </p>
        </div>
      </header>

      {fallbackNotice && (
        <p className="kv-chip kv-chip--attention" role="status">
          {fallbackNotice}
        </p>
      )}

      <div className="kv-chat__scroll" aria-live="polite">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} />
        ))}
        {busy && (
          <div className="kv-chat__bubble kv-chat__bubble--kova">
            <div
              className="kv-skeleton"
              style={{ width: 160, height: 14 }}
              aria-label="Kova is thinking"
            />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.filter((m) => m.role === "user").length === 0 && (
        <div className="kv-chat__suggestions" aria-label="Suggested questions">
          {SUGGESTED.map((s) => (
            <button key={s} className="kv-chip kv-chip--interactive" onClick={() => void send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="kv-chat__composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          className="kv-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about spending, goals, or your plan…"
          aria-label="Message Kova"
        />
        <button
          className="kv-btn kv-btn--primary"
          type="submit"
          disabled={busy || input.trim() === ""}
          aria-label="Send"
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
      <Disclaimer />
    </div>
  );
}

function ChatBubble({ msg }: { msg: ChatMessageRecord }) {
  const reduced = useReducedMotion();
  const [basedOnOpen, setBasedOnOpen] = useState(false);
  return (
    <motion.div
      className={`kv-chat__bubble ${msg.role === "user" ? "kv-chat__bubble--user" : "kv-chat__bubble--kova"}`}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <p className="kv-chat__body">{msg.body}</p>
      {msg.card && <ChatCardView card={msg.card} />}
      {msg.actions && msg.actions.length > 0 && (
        <ChatActions messageId={msg.id} actions={msg.actions} />
      )}
      {msg.basedOn && msg.basedOn.length > 0 && (
        <div className="kv-chat__basedon">
          <button
            className="kv-btn kv-btn--ghost kv-btn--sm"
            aria-expanded={basedOnOpen}
            onClick={() => setBasedOnOpen((v) => !v)}
          >
            <ChevronDown
              size={13}
              aria-hidden="true"
              style={{
                transform: basedOnOpen ? "rotate(180deg)" : undefined,
                transition: "transform 180ms",
              }}
            />
            Based on
          </button>
          {basedOnOpen && (
            <ul className="kv-chat__basedon-list">
              {msg.basedOn.map((item) => (
                <li key={item} className="kv-micro">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </motion.div>
  );
}

function ChatCardView({ card }: { card: NonNullable<ChatMessageRecord["card"]> }) {
  if (card.kind === "spend_check") {
    return (
      <div className="kv-card kv-card--raised kv-chat__card">
        <div className="kv-row">
          <span className="kv-caption">Purchase</span>
          <AmountDisplay amount={card.amount} size={15} />
        </div>
        <div className="kv-row">
          <span className="kv-caption">
            {card.fits ? "Safe to spend after" : "Flexible money available"}
          </span>
          <AmountDisplay amount={card.after} size={15} />
        </div>
        <p className="kv-micro">Until {format(fromIso(card.until), "EEEE, MMMM d")}</p>
      </div>
    );
  }
  if (card.kind === "goal") {
    const fraction = card.price.amount > 0 ? card.saved.amount / card.price.amount : 0;
    return (
      <div className="kv-card kv-card--raised kv-chat__card">
        <div className="kv-row">
          <span className="kv-caption">{card.name}</span>
          <span className="kv-caption kv-num">
            {formatMoney(card.saved)} / {formatMoney(card.price)}
          </span>
        </div>
        <ProgressBar fraction={fraction} label={`${card.name} progress`} />
        {card.forecastDate && (
          <p className="kv-micro">
            On track for {format(fromIso(card.forecastDate), "MMMM d, yyyy")}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="kv-card kv-card--raised kv-chat__card">
      <div className="kv-row">
        <span className="kv-caption">Safe to spend</span>
        <AmountDisplay amount={card.safeToSpend} size={15} />
      </div>
      <div className="kv-row">
        <span className="kv-caption">Protected</span>
        <AmountDisplay amount={card.protectedTotal} size={15} />
      </div>
      <p className="kv-micro">Next payday {format(fromIso(card.nextPayDate), "EEEE, MMMM d")}</p>
    </div>
  );
}

function ChatActions({
  messageId,
  actions,
}: {
  messageId: string;
  actions: NonNullable<ChatMessageRecord["actions"]>;
}) {
  const navigate = useNavigate();
  const store = useAppStore;
  const [confirming, setConfirming] = useState<(typeof actions)[number] | null>(null);

  async function run(action: (typeof actions)[number]) {
    const s = store.getState();
    switch (action.kind) {
      case "log_expense": {
        const p = action.payload as {
          label: string;
          amount: { amount: number; currency: "USD" };
          date: string;
        };
        await s.logExpense(p.label, usd(p.amount.amount), p.date, true);
        break;
      }
      case "create_goal": {
        const p = action.payload as {
          name: string;
          price: { amount: number; currency: "USD" };
          perCheckContribution: { amount: number; currency: "USD" };
          priority: "high" | "medium" | "low";
        };
        await s.addGoal({
          name: p.name,
          price: usd(p.price.amount),
          saved: usd(0),
          perCheckContribution: usd(p.perCheckContribution.amount),
          priority: p.priority,
          state: "active",
          kind: "purchase",
        });
        await s.logAudit({
          kind: "goal_created_via_chat",
          summary: `You approved creating the "${p.name}" goal from chat.`,
          payload: JSON.stringify(p),
          outcome: "approved",
          provider: "mock",
        });
        break;
      }
      case "adjust_goal": {
        const p = action.payload as {
          goalId: string;
          perCheckContribution: { amount: number; currency: "USD" };
        };
        await s.updateGoal(p.goalId, {
          perCheckContribution: usd(p.perCheckContribution.amount),
        });
        await s.logAudit({
          kind: "goal_adjusted_via_chat",
          summary: "You approved a goal contribution change from chat.",
          payload: JSON.stringify(p),
          outcome: "approved",
          provider: "mock",
        });
        break;
      }
      case "propose_memory": {
        const p = action.payload as { statement: string; reason: string };
        await s.proposeMemory(p.statement, "chat", p.reason);
        navigate("/memory");
        break;
      }
      case "open_plan":
        navigate("/plan");
        break;
      case "see_tradeoff":
        navigate("/plan");
        break;
      case "keep_plan":
        break;
    }
    await s.markChatActionState(
      messageId,
      action.id,
      action.kind === "keep_plan" ? "dismissed" : "approved",
    );
    setConfirming(null);
  }

  const mutating = (kind: string) => ["log_expense", "create_goal", "adjust_goal"].includes(kind);

  return (
    <>
      <div className="kv-chat__actions">
        {actions.map((a) => (
          <button
            key={a.id}
            className={`kv-btn kv-btn--sm ${a.state === "approved" ? "kv-btn--ghost" : "kv-btn--secondary"}`}
            disabled={a.state !== "offered"}
            onClick={() => (mutating(a.kind) ? setConfirming(a) : void run(a))}
          >
            {a.state === "approved" ? `✓ ${a.label}` : a.label}
          </button>
        ))}
      </div>
      <Sheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Confirm this change?"
      >
        {confirming && (
          <>
            <p className="kv-caption">
              "{confirming.label}" updates your records. Kova never changes anything without this
              step — it goes into your audit trail.
            </p>
            <button className="kv-btn kv-btn--primary" onClick={() => void run(confirming)}>
              Yes, do it
            </button>
            <button className="kv-btn kv-btn--ghost" onClick={() => setConfirming(null)}>
              Cancel
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
