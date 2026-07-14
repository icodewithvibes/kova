import { useState } from "react";
import { format } from "date-fns";
import { Brain, Check, Pencil, Trash2, X } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import type { MemoryRecord } from "@/data/schema";
import { Sheet } from "@/components/Sheet";
import "./Memory.css";

const SOURCE_LABEL: Record<MemoryRecord["source"], string> = {
  onboarding: "From onboarding",
  chat: "From a chat you approved",
  paycheck: "From a paycheck you confirmed",
  note: "From a note you approved",
  manual: "Added by you",
};

export function MemoryScreen() {
  const memories = useAppStore((s) => s.memories.filter((m) => m.state === "active"));
  const proposals = useAppStore((s) => s.memoryProposals.filter((p) => p.status === "pending"));
  const resolveMemoryProposal = useAppStore((s) => s.resolveMemoryProposal);
  const memoryConsent = useAppStore((s) => s.preferences?.memoryConsent ?? false);

  return (
    <div className="kv-screen">
      <header className="kv-screen__header">
        <div>
          <h1 className="kv-title">Memory Center</h1>
          <p className="kv-micro">
            Everything Kova remembers, in your words. Edit or forget anything, any time.
          </p>
        </div>
      </header>

      {!memoryConsent && (
        <div className="kv-card">
          <p className="kv-caption">
            Memory is off — you chose to manage things manually. Kova still never saves anything
            without asking. You can turn memory on in Settings.
          </p>
        </div>
      )}

      {proposals.length > 0 && (
        <section aria-label="Waiting for your approval">
          <h2 className="kv-heading" style={{ marginBottom: 12 }}>
            Waiting for your approval
          </h2>
          {proposals.map((p) => (
            <div key={p.id} className="kv-card kv-memory__proposal">
              <p className="kv-memory__statement">"{p.statement}"</p>
              <p className="kv-micro">{p.reason}</p>
              <div className="kv-memory__actions">
                <button className="kv-btn kv-btn--primary kv-btn--sm" onClick={() => void resolveMemoryProposal(p.id, true)}>
                  <Check size={13} aria-hidden="true" /> Remember this
                </button>
                <button className="kv-btn kv-btn--secondary kv-btn--sm" onClick={() => void resolveMemoryProposal(p.id, false)}>
                  <X size={13} aria-hidden="true" /> Don't
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {memories.length === 0 && proposals.length === 0 ? (
        <div className="kv-card kv-memory__empty">
          <Brain size={22} aria-hidden="true" />
          <p className="kv-caption">
            Nothing remembered yet. When Kova wants to remember something — a priority, a
            preference — it asks first and it shows up here.
          </p>
        </div>
      ) : (
        memories.map((m) => <MemoryCard key={m.id} memory={m} />)
      )}
    </div>
  );
}

function MemoryCard({ memory }: { memory: MemoryRecord }) {
  const updateMemory = useAppStore((s) => s.updateMemory);
  const forgetMemory = useAppStore((s) => s.forgetMemory);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.statement);
  const [confirmForget, setConfirmForget] = useState(false);

  return (
    <article className="kv-card kv-memory__card">
      {editing ? (
        <div className="kv-field">
          <label className="kv-label" htmlFor={`mem-${memory.id}`}>
            Edit memory
          </label>
          <textarea
            id={`mem-${memory.id}`}
            className="kv-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
          />
          <div className="kv-memory__actions">
            <button
              className="kv-btn kv-btn--primary kv-btn--sm"
              onClick={() => {
                void updateMemory(memory.id, draft.trim() || memory.statement).then(() => setEditing(false));
              }}
            >
              Save
            </button>
            <button className="kv-btn kv-btn--ghost kv-btn--sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="kv-memory__statement">"{memory.statement}"</p>
          <div className="kv-memory__meta">
            <span className="kv-chip">{SOURCE_LABEL[memory.source]}</span>
            <span className="kv-micro">
              Saved {format(new Date(memory.createdAt), "MMM d, yyyy")} · last confirmed{" "}
              {format(new Date(memory.lastConfirmedAt), "MMM d, yyyy")}
            </span>
          </div>
          <div className="kv-memory__actions">
            <button className="kv-btn kv-btn--ghost kv-btn--sm" onClick={() => setEditing(true)}>
              <Pencil size={13} aria-hidden="true" /> Edit
            </button>
            <button className="kv-btn kv-btn--ghost kv-btn--sm" onClick={() => setConfirmForget(true)}>
              <Trash2 size={13} aria-hidden="true" /> Forget
            </button>
          </div>
        </>
      )}

      <Sheet open={confirmForget} onClose={() => setConfirmForget(false)} title="Forget this?">
        <p className="kv-caption">"{memory.statement}"</p>
        <p className="kv-micro">Kova will stop using this immediately. The deletion is logged in your audit trail.</p>
        <button
          className="kv-btn kv-btn--danger"
          onClick={() => void forgetMemory(memory.id).then(() => setConfirmForget(false))}
        >
          Forget it
        </button>
        <button className="kv-btn kv-btn--ghost" onClick={() => setConfirmForget(false)}>
          Keep it
        </button>
      </Sheet>
    </article>
  );
}
