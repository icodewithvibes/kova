import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Link2, Search, Sparkles } from "lucide-react";
import { formatMoney, usd } from "@/domain/money";
import { validateNoteOrganization } from "@/ai/actions";
import { resolveActiveProvider } from "@/ai/registry";
import type { KovaContext, NoteOrganization } from "@/ai/schemas";
import { selectCurrentPlan, selectSafeToSpend, useAppStore } from "@/store/appStore";
import type { NoteCollection, NoteRecord } from "@/data/schema";
import { Sheet } from "@/components/Sheet";
import "./Space.css";

const COLLECTIONS: Array<{ key: NoteCollection | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "inbox", label: "Inbox" },
  { key: "money", label: "Money" },
  { key: "ideas", label: "Ideas" },
  { key: "school", label: "School" },
  { key: "work", label: "Work" },
  { key: "projects", label: "Projects" },
];

export function SpaceScreen() {
  const [params, setParams] = useSearchParams();
  const notes = useAppStore((s) => s.notes);
  const addNote = useAppStore((s) => s.addNote);
  const [capture, setCapture] = useState("");
  const [collection, setCollection] = useState<NoteCollection | "all">("all");
  const [query, setQuery] = useState("");
  const [openNote, setOpenNote] = useState<NoteRecord | null>(null);
  const captureRef = useRef<HTMLTextAreaElement>(null);

  // Quick capture: cold open → typing instantly when ?capture=1.
  useEffect(() => {
    if (params.get("capture") === "1") {
      captureRef.current?.focus();
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  async function saveCapture() {
    const body = capture.trim();
    if (!body) return;
    setCapture("");
    await addNote(body);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter(
      (n) =>
        (collection === "all" || n.collection === collection) &&
        (q === "" ||
          n.body.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [notes, collection, query]);

  return (
    <div className="kv-screen">
      <header className="kv-screen__header">
        <div>
          <h1 className="kv-title">Space</h1>
          <p className="kv-micro">Your private notebook. Raw words stay raw — organizing is optional.</p>
        </div>
      </header>

      <div className="kv-card kv-space__capture">
        <label className="sr-only" htmlFor="space-capture">
          Quick capture
        </label>
        <textarea
          id="space-capture"
          ref={captureRef}
          className="kv-input"
          placeholder="Capture a thought — saved the moment you tap Save."
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void saveCapture();
          }}
        />
        <button className="kv-btn kv-btn--primary kv-btn--sm" onClick={() => void saveCapture()} disabled={!capture.trim()}>
          Save
        </button>
      </div>

      <div className="kv-space__filters">
        <div className="kv-space__collections" role="tablist" aria-label="Collections">
          {COLLECTIONS.map((c) => (
            <button
              key={c.key}
              role="tab"
              aria-selected={collection === c.key}
              className={`kv-chip kv-chip--interactive ${collection === c.key ? "kv-chip--progress" : ""}`}
              onClick={() => setCollection(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="kv-space__search">
          <Search size={14} aria-hidden="true" />
          <input
            className="kv-input"
            placeholder="Search notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search notes"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="kv-card kv-space__empty">
          <p className="kv-caption">
            {notes.length === 0
              ? "An open notebook, ready for a first note."
              : "Nothing matches — try another collection or search."}
          </p>
        </div>
      ) : (
        <ul className="kv-space__list">
          {filtered.map((note) => (
            <li key={note.id}>
              <button className="kv-card kv-space__note" onClick={() => setOpenNote(note)}>
                <p className="kv-space__note-body">{note.body}</p>
                <div className="kv-space__note-meta">
                  <span className="kv-chip">{note.collection}</span>
                  {note.tags.map((t) => (
                    <span key={t} className="kv-micro">
                      #{t}
                    </span>
                  ))}
                  {note.links.filter((l) => l.accepted).length > 0 && (
                    <span className="kv-micro">
                      <Link2 size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} />{" "}
                      {note.links.filter((l) => l.accepted).length}
                    </span>
                  )}
                  <span className="kv-micro">{format(new Date(note.updatedAt), "MMM d")}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openNote && <NoteSheet note={openNote} onClose={() => setOpenNote(null)} />}
    </div>
  );
}

function NoteSheet({ note, onClose }: { note: NoteRecord; onClose: () => void }) {
  const state = useAppStore();
  const updateNote = useAppStore((s) => s.updateNote);
  const deleteNote = useAppStore((s) => s.deleteNote);
  const [body, setBody] = useState(note.body);
  const [suggestion, setSuggestion] = useState<NoteOrganization | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmGoal, setConfirmGoal] = useState(false);

  const dirty = body !== note.body;

  const context: KovaContext = useMemo(
    () => ({
      displayName: state.user?.displayName ?? "there",
      plan: selectCurrentPlan(state),
      safeToSpend: selectSafeToSpend(state),
      goals: state.goals.filter((g) => g.state !== "completed"),
      memories: state.memories.filter((m) => m.state === "active"),
      recentExpenses: [],
      payFrequency: state.paySchedule?.frequency ?? null,
      anchorPayDate: state.paySchedule?.anchorPayDate ?? null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.goals, state.memories, state.plans, state.paySchedule, state.user],
  );

  async function organize() {
    setBusy(true);
    setSuggestionError(null);
    const preferred = state.providerConfig?.provider ?? "mock";
    const { provider } = await resolveActiveProvider(preferred);
    const raw = await provider.organizeNote(body, context);
    const outcome = validateNoteOrganization(raw);
    if (outcome.ok && outcome.value) {
      setSuggestion(outcome.value);
    } else {
      setSuggestionError(outcome.error ?? "No suggestion available.");
      await useAppStore.getState().logAudit({
        kind: "note_organization_rejected",
        summary: "A note-organization suggestion failed validation and was discarded.",
        payload: "{}",
        outcome: "rejected_invalid",
        provider: provider.kind,
      });
    }
    setBusy(false);
  }

  async function applyOrganization() {
    if (!suggestion) return;
    await updateNote(note.id, {
      body,
      collection: suggestion.suggestedCollection,
      tags: [...new Set([...note.tags, ...suggestion.suggestedTags])],
      links: [
        ...note.links,
        ...suggestion.linkedConcepts.map((c) => ({
          label: c.label,
          ...(c.relatedGoalId ? { targetGoalId: c.relatedGoalId } : {}),
          proposedByAI: true,
          accepted: true,
        })),
      ],
    });
    await useAppStore.getState().logAudit({
      kind: "note_organized",
      summary: `You approved organizing a note into "${suggestion.suggestedCollection}".`,
      payload: JSON.stringify({ noteId: note.id }),
      outcome: "approved",
      provider: "mock",
    });
    setSuggestion(null);
    onClose();
  }

  async function turnIntoPlan() {
    if (!suggestion?.proposedGoal) return;
    const g = suggestion.proposedGoal;
    const created = await useAppStore.getState().addGoal({
      name: g.name,
      price: usd(g.price.amount),
      saved: usd(0),
      perCheckContribution: usd(g.perCheckContribution.amount),
      priority: g.priority,
      state: "active",
      kind: "purchase",
    });
    await updateNote(note.id, {
      links: [...note.links, { label: g.name, targetGoalId: created.id, proposedByAI: true, accepted: true }],
    });
    await useAppStore.getState().logAudit({
      kind: "note_turned_into_goal",
      summary: `You approved creating the "${g.name}" goal from a note.`,
      payload: JSON.stringify({ noteId: note.id, goalId: created.id }),
      outcome: "approved",
      provider: "mock",
    });
    setConfirmGoal(false);
    setSuggestion(null);
    onClose();
  }

  const linkedGoal = suggestion?.linkedConcepts.find((c) => c.relatedGoalId);
  const relatedGoal = linkedGoal
    ? state.goals.find((g) => g.id === linkedGoal.relatedGoalId)
    : null;

  return (
    <Sheet open onClose={onClose} title="Note">
      <label className="sr-only" htmlFor="note-body">
        Note text
      </label>
      <textarea
        id="note-body"
        className="kv-input"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
      />
      <div className="kv-space__note-actions">
        <button className="kv-btn kv-btn--secondary kv-btn--sm" onClick={onClose}>
          Keep raw
        </button>
        <button className="kv-btn kv-btn--secondary kv-btn--sm" onClick={() => void organize()} disabled={busy}>
          <Sparkles size={13} aria-hidden="true" /> {busy ? "Looking…" : "Organize"}
        </button>
        {dirty && (
          <button className="kv-btn kv-btn--primary kv-btn--sm" onClick={() => void updateNote(note.id, { body }).then(onClose)}>
            Save changes
          </button>
        )}
        <button className="kv-btn kv-btn--ghost kv-btn--sm" onClick={() => void deleteNote(note.id).then(onClose)}>
          Delete
        </button>
      </div>

      {suggestionError && <p className="kv-caption">{suggestionError}</p>}

      {suggestion && (
        <div className="kv-card kv-card--raised kv-space__suggestion">
          <p className="kv-caption">{suggestion.summary}</p>
          <div className="kv-space__suggestion-chips">
            <span className="kv-chip">→ {suggestion.suggestedCollection}</span>
            {suggestion.suggestedTags.map((t) => (
              <span key={t} className="kv-chip">
                #{t}
              </span>
            ))}
            {suggestion.linkedConcepts.map((c) => (
              <span key={c.label} className="kv-chip kv-chip--progress">
                <Link2 size={11} aria-hidden="true" /> {c.label}
              </span>
            ))}
          </div>
          {relatedGoal && (
            <p className="kv-micro">
              Existing goal: {relatedGoal.name} — {formatMoney(relatedGoal.saved)} of{" "}
              {formatMoney(relatedGoal.price)} saved. Your budget is untouched unless you approve a
              change.
            </p>
          )}
          <div className="kv-space__note-actions">
            <button className="kv-btn kv-btn--primary kv-btn--sm" onClick={() => void applyOrganization()}>
              Apply organization
            </button>
            {suggestion.proposedGoal && (
              <button className="kv-btn kv-btn--secondary kv-btn--sm" onClick={() => setConfirmGoal(true)}>
                Turn into a plan
              </button>
            )}
            <button className="kv-btn kv-btn--ghost kv-btn--sm" onClick={() => setSuggestion(null)}>
              Keep raw
            </button>
          </div>
        </div>
      )}

      <Sheet open={confirmGoal} onClose={() => setConfirmGoal(false)} title="Create this goal?">
        {suggestion?.proposedGoal && (
          <>
            <p className="kv-caption">
              "{suggestion.proposedGoal.name}" — {formatMoney(usd(suggestion.proposedGoal.price.amount))}, saving{" "}
              {formatMoney(usd(suggestion.proposedGoal.perCheckContribution.amount))} per paycheck at{" "}
              {suggestion.proposedGoal.priority} priority. Your note stays exactly as written.
            </p>
            <button className="kv-btn kv-btn--primary" onClick={() => void turnIntoPlan()}>
              Create goal
            </button>
            <button className="kv-btn kv-btn--ghost" onClick={() => setConfirmGoal(false)}>
              Just research for now
            </button>
          </>
        )}
      </Sheet>
    </Sheet>
  );
}
