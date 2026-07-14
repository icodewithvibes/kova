import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Brain, Download, ShieldCheck, Trash2 } from "lucide-react";
import { allProviders, getProvider } from "@/ai/registry";
import type { HealthStatus, ProviderKind } from "@/ai/provider";
import { exportAllData } from "@/data/db";
import { useAppStore } from "@/store/appStore";
import { Sheet } from "@/components/Sheet";
import "./Settings.css";

export function SettingsScreen() {
  const navigate = useNavigate();
  const state = useAppStore();
  const setProvider = useAppStore((s) => s.setProvider);
  const updatePreferences = useAppStore((s) => s.updatePreferences);
  const eraseEverything = useAppStore((s) => s.eraseEverything);
  const activeKind = state.providerConfig?.provider ?? "mock";
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getProvider(activeKind)
      .healthCheck()
      .then((h) => {
        if (!cancelled) setHealth(h);
      });
    return () => {
      cancelled = true;
    };
  }, [activeKind]);

  async function exportData() {
    const dump = await exportAllData();
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kova-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="kv-screen">
      <header className="kv-screen__header">
        <h1 className="kv-title">Settings</h1>
      </header>

      <section className="kv-card" aria-label="Intelligence">
        <h2 className="kv-heading">Intelligence</h2>
        <p className="kv-micro" style={{ marginBottom: 12 }}>
          Which brain answers your questions. Financial math is always deterministic and on-device —
          providers only explain, classify, and propose.
        </p>
        <div className="kv-settings__providers" role="radiogroup" aria-label="AI provider">
          {allProviders().map((p) => (
            <button
              key={p.kind}
              role="radio"
              aria-checked={activeKind === p.kind}
              className={`kv-settings__provider ${activeKind === p.kind ? "is-active" : ""}`}
              onClick={() => void setProvider(p.kind as ProviderKind)}
            >
              <span className="kv-settings__provider-name">{p.label}</span>
              <span className="kv-micro">
                {p.local ? "Runs locally" : "Cloud"} · model: {p.modelName}
              </span>
            </button>
          ))}
        </div>
        <div className="kv-settings__health">
          <span className={`kv-chip ${health?.ok ? "kv-chip--progress" : "kv-chip--attention"}`}>
            {health === null ? "Checking…" : health.ok ? "Connected" : "Unavailable"}
          </span>
          <p className="kv-micro">{health?.detail}</p>
        </div>
        <hr className="kv-divider" />
        <p className="kv-micro">
          <ShieldCheck size={12} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Do images
          leave this device? <strong>No.</strong> Demo mode processes nothing externally. If you
          later enable a cloud provider, Kova sends structured summaries (net pay, dates, goals) —
          never your paystub images — and tells you before anything is sent. If a provider is
          unreachable, Kova says so and falls back to Demo Mode; it never switches silently.
        </p>
      </section>

      <section className="kv-card" aria-label="Memory">
        <div className="kv-row">
          <div>
            <p style={{ fontWeight: 600 }}>
              <Brain size={14} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Memory
            </p>
            <p className="kv-micro">Kova asks before remembering anything.</p>
          </div>
          <label className="kv-settings__toggle">
            <input
              type="checkbox"
              checked={state.preferences?.memoryConsent ?? false}
              onChange={(e) => void updatePreferences({ memoryConsent: e.target.checked })}
            />
            <span>{state.preferences?.memoryConsent ? "On" : "Off"}</span>
          </label>
        </div>
        <Link to="/memory" className="kv-btn kv-btn--secondary kv-btn--sm">
          Open Memory Center
        </Link>
      </section>

      <section className="kv-card" aria-label="Audit trail">
        <div className="kv-row">
          <div>
            <p style={{ fontWeight: 600 }}>Audit trail</p>
            <p className="kv-micro">
              Every AI suggestion, approval, and plan change — {state.auditLogs.length} entries.
            </p>
          </div>
          <button className="kv-btn kv-btn--secondary kv-btn--sm" onClick={() => setAuditOpen(true)}>
            View
          </button>
        </div>
      </section>

      <section className="kv-card" aria-label="Your data">
        <h2 className="kv-heading">Your data</h2>
        <p className="kv-micro" style={{ marginBottom: 12 }}>
          Everything lives in this browser's storage on this device. This demo build uses synthetic
          data only.
        </p>
        <div className="kv-settings__data-actions">
          <button className="kv-btn kv-btn--secondary kv-btn--sm" onClick={() => void exportData()}>
            <Download size={13} aria-hidden="true" /> Export everything (JSON)
          </button>
          <button className="kv-btn kv-btn--danger kv-btn--sm" onClick={() => setConfirmErase(true)}>
            <Trash2 size={13} aria-hidden="true" /> Delete everything
          </button>
        </div>
      </section>

      <p className="kv-disclaimer">
        For planning only. Verify important payroll and tax information with your paystub, employer,
        or qualified professional. Tax figures in Kova are illustrative estimates, not advice.
      </p>

      <Sheet open={auditOpen} onClose={() => setAuditOpen(false)} title="Audit trail">
        {state.auditLogs.length === 0 ? (
          <p className="kv-caption">No entries yet.</p>
        ) : (
          [...state.auditLogs]
            .reverse()
            .slice(0, 50)
            .map((log) => (
              <div key={log.id} className="kv-settings__audit-entry">
                <p className="kv-caption">{log.summary}</p>
                <p className="kv-micro">
                  {format(new Date(log.createdAt), "MMM d, yyyy HH:mm")} · {log.kind} · {log.outcome}
                </p>
              </div>
            ))
        )}
      </Sheet>

      <Sheet open={confirmErase} onClose={() => setConfirmErase(false)} title="Delete everything?">
        <p className="kv-caption">
          This permanently removes all Kova data on this device: paychecks, plans, goals, notes,
          memories, chat, and the audit trail. There is no undo.
        </p>
        <button
          className="kv-btn kv-btn--danger"
          onClick={() => {
            void eraseEverything().then(() => navigate("/onboarding"));
          }}
        >
          Delete all my data
        </button>
        <button className="kv-btn kv-btn--ghost" onClick={() => setConfirmErase(false)}>
          Keep my data
        </button>
      </Sheet>
    </div>
  );
}
