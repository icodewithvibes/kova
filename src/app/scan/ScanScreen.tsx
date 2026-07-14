import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Camera, FileUp, PencilLine, ShieldCheck } from "lucide-react";
import { normalizeMoneyInput, formatMoney, usd, type Money } from "@/domain/money";
import { nextPayDate, toIso, fromIso } from "@/domain/payPeriod";
import { reconcilePaycheck } from "@/domain/paycheck";
import type { IsoDate, SourcedValue } from "@/domain/types";
import type { PaycheckDeduction } from "@/domain/types";
import { addDays } from "date-fns";
import { MOCK_FIXTURES, MockPaystubExtractor } from "@/ocr/mockExtractor";
import type { ExtractedPaystub } from "@/ocr/extractor";
import { useAppStore, selectCurrentPlan } from "@/store/appStore";
import { newId } from "@/data/db";
import type { BudgetPlanRecord, PaycheckRecord } from "@/data/schema";
import { AmountDisplay } from "@/components/AmountDisplay";
import { SourceBadge } from "@/components/SourceBadge";
import { Disclaimer } from "@/components/Disclaimer";
import { AllocationLanes } from "@/components/AllocationLanes";
import "./Scan.css";

type Step = "choose" | "processing" | "review" | "confirmed";

interface ReviewField {
  key: string;
  label: string;
  kind: "text" | "date" | "money" | "number";
  raw: string;
  source: "paystub" | "user_entered";
  confidence?: number;
  rawLabel?: string;
  requiresReview: boolean;
  visited: boolean;
}

const MONEY_KEYS = [
  "hourlyRate",
  "tips",
  "gross",
  "federalWithholding",
  "stateWithholding",
  "socialSecurity",
  "medicare",
  "otherDeductions",
  "net",
] as const;

function moneyToRaw(m: Money): string {
  return (m.amount / 100).toFixed(2);
}

function extractedToFields(x: ExtractedPaystub): ReviewField[] {
  const f = <T,>(
    key: string,
    label: string,
    kind: ReviewField["kind"],
    ef: { value: T; confidence?: number; rawLabel?: string; requiresReview: boolean } | undefined,
    toRaw: (v: T) => string,
  ): ReviewField | null =>
    ef
      ? {
          key,
          label,
          kind,
          raw: toRaw(ef.value),
          source: "paystub",
          ...(ef.confidence !== undefined ? { confidence: ef.confidence } : {}),
          ...(ef.rawLabel !== undefined ? { rawLabel: ef.rawLabel } : {}),
          requiresReview: ef.requiresReview,
          visited: !ef.requiresReview,
        }
      : null;

  return [
    f("employer", "Employer", "text", x.employer, String),
    f("payDate", "Pay date", "date", x.payDate, String),
    f("periodStart", "Pay period start", "date", x.periodStart, String),
    f("periodEnd", "Pay period end", "date", x.periodEnd, String),
    f("hours", "Hours", "number", x.hours, (v) => String(v)),
    f("hourlyRate", "Hourly rate", "money", x.hourlyRate, moneyToRaw),
    f("tips", "Tips", "money", x.tips, moneyToRaw),
    f("gross", "Gross pay", "money", x.gross, moneyToRaw),
    f("federalWithholding", "Federal withholding", "money", x.federalWithholding, moneyToRaw),
    f("stateWithholding", "State withholding", "money", x.stateWithholding, moneyToRaw),
    f("socialSecurity", "Social Security", "money", x.socialSecurity, moneyToRaw),
    f("medicare", "Medicare", "money", x.medicare, moneyToRaw),
    f("otherDeductions", "Other deductions", "money", x.otherDeductions, moneyToRaw),
    f("net", "Net pay", "money", x.net, moneyToRaw),
  ].filter((v): v is ReviewField => v !== null);
}

function manualFields(payDate: IsoDate, periodStart: IsoDate, periodEnd: IsoDate): ReviewField[] {
  const mk = (key: string, label: string, kind: ReviewField["kind"], raw = ""): ReviewField => ({
    key,
    label,
    kind,
    raw,
    source: "user_entered",
    requiresReview: false,
    visited: true,
  });
  return [
    mk("employer", "Employer", "text"),
    mk("payDate", "Pay date", "date", payDate),
    mk("periodStart", "Pay period start", "date", periodStart),
    mk("periodEnd", "Pay period end", "date", periodEnd),
    mk("hours", "Hours", "number"),
    mk("hourlyRate", "Hourly rate", "money"),
    mk("tips", "Tips", "money"),
    mk("gross", "Gross pay", "money"),
    mk("federalWithholding", "Federal withholding", "money"),
    mk("stateWithholding", "State withholding", "money"),
    mk("socialSecurity", "Social Security", "money"),
    mk("medicare", "Medicare", "money"),
    mk("otherDeductions", "Other deductions", "money"),
    mk("net", "Net pay", "money"),
  ];
}

export function ScanScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reduced = useReducedMotion();
  const paySchedule = useAppStore((s) => s.paySchedule);
  const confirmPaycheck = useAppStore((s) => s.confirmPaycheck);
  const plans = useAppStore((s) => s.plans);
  const expenses = useAppStore((s) => s.expenses);

  const [step, setStep] = useState<Step>("choose");
  const [fields, setFields] = useState<ReviewField[]>([]);
  const [isManual, setIsManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedPlan, setConfirmedPlan] = useState<BudgetPlanRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const dates = useMemo(() => {
    const today = toIso(new Date());
    const lastPlan = selectCurrentPlan({ plans });
    const anchor = paySchedule?.anchorPayDate ?? today;
    const after = lastPlan ? lastPlan.payDate : today;
    const payDate =
      (paySchedule ? nextPayDate(paySchedule.frequency, anchor, after) : null) ?? today;
    const periodEnd = toIso(addDays(fromIso(payDate), -6));
    const periodStart = toIso(addDays(fromIso(payDate), -19));
    return { payDate, periodStart, periodEnd };
  }, [paySchedule, plans]);

  useEffect(() => {
    if (params.get("mode") === "manual") startManual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startScan(fixtureKey: string) {
    setStep("processing");
    setIsManual(false);
    const extractor = new MockPaystubExtractor(dates);
    const extracted = await extractor.extract({ fixtureKey });
    setFields(extractedToFields(extracted));
    setStep("review");
  }

  function startManual() {
    setIsManual(true);
    setFields(manualFields(dates.payDate, dates.periodStart, dates.periodEnd));
    setStep("review");
  }

  function updateField(key: string, raw: string) {
    setFields((cur) =>
      cur.map((f) =>
        f.key === key
          ? { ...f, raw, source: "user_entered", requiresReview: false, visited: true }
          : f,
      ),
    );
  }

  function markVisited(key: string) {
    setFields((cur) => cur.map((f) => (f.key === key ? { ...f, visited: true } : f)));
  }

  const parsedMoney = useMemo(() => {
    const out: Partial<Record<(typeof MONEY_KEYS)[number], Money>> = {};
    for (const key of MONEY_KEYS) {
      const f = fields.find((x) => x.key === key);
      if (!f || f.raw.trim() === "") continue;
      const r = normalizeMoneyInput(f.raw);
      if (r.ok && r.money) out[key] = r.money;
    }
    return out;
  }, [fields]);

  const reconciliation = useMemo(() => {
    const { gross, net } = parsedMoney;
    if (!gross || !net) return null;
    const deductions: PaycheckDeduction[] = [];
    for (const [key, kind] of [
      ["federalWithholding", "federal_withholding"],
      ["stateWithholding", "state_withholding"],
      ["socialSecurity", "social_security"],
      ["medicare", "medicare"],
      ["otherDeductions", "other"],
    ] as const) {
      const m = parsedMoney[key];
      if (m) deductions.push({ label: key, amount: m, kind });
    }
    return reconcilePaycheck(gross, deductions, net);
  }, [parsedMoney]);

  const netMissing = !parsedMoney.net;
  const unvisited = fields.filter((f) => f.requiresReview && !f.visited);
  const mismatch = reconciliation !== null && !reconciliation.reconciles;
  const canConfirm = !netMissing && unvisited.length === 0 && !mismatch && !busy;

  async function onConfirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const get = (key: string) => fields.find((f) => f.key === key);
      const sv = <T,>(f: ReviewField | undefined, value: T): SourcedValue<T> => ({
        value,
        source: f?.source === "paystub" ? "paystub" : "user_entered",
        ...(f?.source === "paystub" && f.confidence !== undefined
          ? { confidence: f.confidence }
          : {}),
        needsReview: false,
        ...(f?.rawLabel ? { rawLabel: f.rawLabel } : {}),
      });

      const employer = get("employer");
      const payDateF = get("payDate");
      const hoursF = get("hours");
      const record: PaycheckRecord = {
        id: newId("pc"),
        userId: "local-owner",
        status: "draft",
        employer: sv(employer, employer?.raw.trim() || "Unknown employer"),
        payDate: sv(payDateF, (payDateF?.raw as IsoDate) || dates.payDate),
        periodStart: sv(get("periodStart"), (get("periodStart")?.raw as IsoDate) || dates.periodStart),
        periodEnd: sv(get("periodEnd"), (get("periodEnd")?.raw as IsoDate) || dates.periodEnd),
        ...(hoursF && hoursF.raw.trim() !== ""
          ? { hours: sv(hoursF, Number(hoursF.raw)) }
          : {}),
        ...(parsedMoney.hourlyRate ? { hourlyRate: sv(get("hourlyRate"), parsedMoney.hourlyRate) } : {}),
        ...(parsedMoney.tips ? { tips: sv(get("tips"), parsedMoney.tips) } : {}),
        gross: sv(get("gross"), parsedMoney.gross ?? parsedMoney.net ?? usd(0)),
        net: sv(get("net"), parsedMoney.net!),
        lineItems: (
          [
            ["tips", "Tips", "tips"],
            ["federalWithholding", "Federal withholding", "federal_withholding"],
            ["stateWithholding", "State withholding", "state_withholding"],
            ["socialSecurity", "Social Security", "social_security"],
            ["medicare", "Medicare", "medicare"],
            ["otherDeductions", "Other deductions", "other_deduction"],
          ] as const
        )
          .filter(([key]) => parsedMoney[key] !== undefined && parsedMoney[key]!.amount > 0)
          .map(([key, label, kind]) => ({
            label,
            amount: sv(get(key), parsedMoney[key]!),
            kind,
          })),
        createdAt: new Date().toISOString(),
      };

      const plan = await confirmPaycheck(record);
      setConfirmedPlan(plan);
      setStep("confirmed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — nothing was saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kv-screen">
      {step === "choose" && (
        <>
          <header className="kv-screen__header">
            <h1 className="kv-title">Add a paycheck</h1>
          </header>
          <p className="kv-caption">
            <ShieldCheck size={14} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Demo mode
            uses synthetic paystubs only. Nothing is saved until you confirm the review screen.
          </p>
          <div className="kv-scan__options">
            {MOCK_FIXTURES.map((fixture) => (
              <button
                key={fixture.key}
                className="kv-card kv-scan__option"
                onClick={() => void startScan(fixture.key)}
              >
                <span className="kv-scan__option-icon">
                  {fixture.key === "clean-scan" ? (
                    <Camera size={20} aria-hidden="true" />
                  ) : (
                    <FileUp size={20} aria-hidden="true" />
                  )}
                </span>
                <span>
                  <span className="kv-scan__option-title">{fixture.title}</span>
                  <span className="kv-caption">{fixture.description}</span>
                </span>
              </button>
            ))}
            <button className="kv-card kv-scan__option" onClick={startManual}>
              <span className="kv-scan__option-icon">
                <PencilLine size={20} aria-hidden="true" />
              </span>
              <span>
                <span className="kv-scan__option-title">Enter it myself</span>
                <span className="kv-caption">Type your pay details — just as trusted as a scan.</span>
              </span>
            </button>
          </div>
          <Disclaimer />
        </>
      )}

      {step === "processing" && (
        <div className="kv-scan__processing" aria-live="polite">
          <div className="kv-scan__doc">
            <motion.div
              className="kv-scan__doc-line"
              animate={reduced ? {} : { top: ["8%", "88%", "8%"] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <p className="kv-caption">Reading your paystub…</p>
          <p className="kv-micro">Each value gets a confidence score. You review everything before it counts.</p>
        </div>
      )}

      {step === "review" && (
        <>
          <header className="kv-screen__header">
            <div>
              <h1 className="kv-title">We found this</h1>
              <p className="kv-caption">
                {isManual
                  ? "Enter what you know. Net pay is the only required amount."
                  : "Check anything marked for review, then confirm. Nothing is saved yet."}
              </p>
            </div>
          </header>

          {mismatch && reconciliation && (
            <div className="kv-scan__banner" role="alert">
              <p>
                Some numbers don't fully match. Gross minus deductions comes to{" "}
                <strong className="kv-num">{formatMoney(reconciliation.computedNet)}</strong>, but
                net pay reads{" "}
                <strong className="kv-num">{formatMoney(reconciliation.statedNet)}</strong>. Please
                review before using this paycheck.
              </p>
            </div>
          )}

          <div className="kv-card kv-scan__fields">
            {fields.map((f) => (
              <div key={f.key} className="kv-scan__field">
                <div className="kv-scan__field-head">
                  <label className="kv-label" htmlFor={`fld-${f.key}`}>
                    {f.label}
                    {f.rawLabel && f.source === "paystub" && (
                      <span className="kv-micro"> · seen as "{f.rawLabel}"</span>
                    )}
                  </label>
                  <SourceBadge
                    source={f.source === "paystub" ? "paystub" : "user_entered"}
                    needsReview={f.requiresReview && !f.visited}
                  />
                </div>
                <div className="kv-scan__field-input">
                  {f.kind === "money" && <span className="kv-scan__prefix">$</span>}
                  <input
                    id={`fld-${f.key}`}
                    className={`kv-input ${f.requiresReview && !f.visited ? "kv-input--attention" : ""}`}
                    type={f.kind === "date" ? "date" : "text"}
                    inputMode={f.kind === "money" || f.kind === "number" ? "decimal" : undefined}
                    value={f.raw}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    onFocus={() => markVisited(f.key)}
                    aria-describedby={
                      f.confidence !== undefined && f.confidence < 0.9
                        ? `conf-${f.key}`
                        : undefined
                    }
                  />
                </div>
                {f.source === "paystub" && f.confidence !== undefined && f.confidence < 0.9 && (
                  <p id={`conf-${f.key}`} className="kv-micro">
                    Read with {Math.round(f.confidence * 100)}% confidence — a quick look helps.
                  </p>
                )}
              </div>
            ))}
          </div>

          {netMissing && <p className="kv-caption">Add net pay to continue — it anchors your plan.</p>}
          {unvisited.length > 0 && (
            <p className="kv-caption">
              {unvisited.length} field{unvisited.length > 1 ? "s" : ""} marked "Needs review" — tap
              each to check or correct it.
            </p>
          )}
          {error && (
            <p className="kv-caption" style={{ color: "var(--kova-critical)" }} role="alert">
              {error}
            </p>
          )}

          <button className="kv-btn kv-btn--primary" onClick={() => void onConfirm()} disabled={!canConfirm}>
            {busy ? "Building your plan…" : "Confirm paycheck"}
          </button>
          <button className="kv-btn kv-btn--ghost" onClick={() => navigate(-1)}>
            Cancel — save nothing
          </button>
          <Disclaimer />
        </>
      )}

      {step === "confirmed" && confirmedPlan && (
        <ConfirmedReveal plan={confirmedPlan} spentCents={sumInPeriod(expenses, confirmedPlan)} onDone={() => navigate("/today")} />
      )}
    </div>
  );
}

function sumInPeriod(
  expenses: { amount: Money; date: string }[],
  plan: BudgetPlanRecord,
): number {
  return expenses
    .filter((e) => e.date >= plan.payDate && e.date <= plan.nextPayDate)
    .reduce((acc, e) => acc + e.amount.amount, 0);
}

function ConfirmedReveal({
  plan,
  spentCents,
  onDone,
}: {
  plan: BudgetPlanRecord;
  spentCents: number;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  const needsAttention = plan.status === "needs_attention";
  const remaining = usd(Math.max(0, plan.safeToSpend.amount - spentCents));
  return (
    <div className="kv-scan__reveal">
      <motion.h1
        className="kv-title"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        {needsAttention ? "Plan needs attention" : "Your plan is ready."}
      </motion.h1>

      {needsAttention && plan.shortfall && (
        <div className="kv-scan__banner" role="status">
          <p>
            This check couldn't cover everything — no shame, it happens. Kova protected things in
            priority order:
          </p>
          <ul className="kv-caption" style={{ paddingLeft: 18 }}>
            {plan.shortfall.explanations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <motion.div
        className="kv-card kv-card--hero"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: reduced ? 0 : 0.15, duration: 0.28 }}
      >
        <p className="kv-caption">Safe to spend until {plan.nextPayDate}</p>
        <AmountDisplay amount={remaining} size={44} />
        <p className="kv-caption">Bills, buffer, and goals are already set aside.</p>
      </motion.div>

      <div className="kv-card">
        <h2 className="kv-heading" style={{ marginBottom: 12 }}>
          Where this paycheck went
        </h2>
        <AllocationLanes allocations={plan.allocations} netPayCents={plan.netPay.amount} animateIn />
      </div>

      <button className="kv-btn kv-btn--primary" onClick={onDone}>
        Go to Today
      </button>
      <Disclaimer />
    </div>
  );
}
