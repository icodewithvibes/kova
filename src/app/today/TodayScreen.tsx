import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  CalendarClock,
  MessageCircle,
  ReceiptText,
  ScanLine,
  Settings,
  Lightbulb,
} from "lucide-react";
import { normalizeMoneyInput, formatMoney, usd } from "@/domain/money";
import { fromIso, toIso, daysBetween } from "@/domain/payPeriod";
import {
  selectCurrentPlan,
  selectGoalForecast,
  selectInsight,
  selectPrimaryGoal,
  selectSafeToSpend,
  useAppStore,
} from "@/store/appStore";
import { AmountDisplay } from "@/components/AmountDisplay";
import { AllocationLanes } from "@/components/AllocationLanes";
import { ProgressBar } from "@/components/ProgressBar";
import { Disclaimer } from "@/components/Disclaimer";
import { Sheet } from "@/components/Sheet";
import "./Today.css";

function greeting(hour: number, name: string): string {
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${name}`;
}

function friendlyDate(iso: string): string {
  return format(fromIso(iso), "EEEE, MMMM d");
}

export function TodayScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const state = useAppStore();
  const plan = selectCurrentPlan(state);
  const sts = selectSafeToSpend(state);
  const goal = selectPrimaryGoal(state);
  const insight = selectInsight(state);
  const today = toIso(new Date());

  const forecast = useMemo(
    () => (goal ? selectGoalForecast(state, goal, today) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goal?.id, goal?.saved.amount, goal?.perCheckContribution.amount, state.paySchedule, today],
  );

  const goalAllocation = plan?.allocations.find(
    (a) => a.category === "goal" && a.refId === goal?.id,
  );

  const nextUp = (() => {
    if (!plan) return null;
    const upcomingBill = plan.allocations
      .filter((a) => a.category === "bill")
      .map((a) => {
        const bill = state.bills.find((b) => b.id === a.refId);
        if (!bill) return null;
        const month = plan.nextPayDate.slice(0, 7);
        const due = `${month}-${String(bill.dueDayOfMonth).padStart(2, "0")}`;
        return { name: bill.name, amount: bill.amount, due };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null && b.due >= today)
      .sort((a, b) => a.due.localeCompare(b.due))[0];
    if (upcomingBill && upcomingBill.due <= plan.nextPayDate) {
      return {
        title: `${upcomingBill.name} · ${formatMoney(upcomingBill.amount)}`,
        detail: `Due ${friendlyDate(upcomingBill.due)} — already protected in this plan.`,
      };
    }
    const days = daysBetween(today, plan.nextPayDate);
    return {
      title: `Next payday ${friendlyDate(plan.nextPayDate)}`,
      detail: days > 0 ? `${days} day${days === 1 ? "" : "s"} away.` : "That's today.",
    };
  })();

  const addExpenseOpen = params.get("add") === "expense";

  if (!plan) {
    return (
      <div className="kv-screen">
        <header className="kv-screen__header">
          <h1 className="kv-title">{greeting(new Date().getHours(), state.user?.displayName ?? "there")}</h1>
          <Link to="/settings" className="kv-btn kv-btn--ghost" aria-label="Settings">
            <Settings size={18} aria-hidden="true" />
          </Link>
        </header>
        <div className="kv-card kv-card--hero kv-today__empty">
          <p className="kv-heading">No paycheck planned yet</p>
          <p className="kv-caption">
            Scan or enter your pay and Kova protects bills and goals first, then shows what's safe
            to spend.
          </p>
          <button className="kv-btn kv-btn--primary" onClick={() => navigate("/scan")}>
            <ScanLine size={16} aria-hidden="true" /> Add your paycheck
          </button>
        </div>
        <Disclaimer />
      </div>
    );
  }

  const periodDays = Math.max(1, daysBetween(plan.payDate, plan.nextPayDate));
  const elapsed = Math.min(periodDays, Math.max(0, daysBetween(plan.payDate, today)));

  return (
    <div className="kv-screen">
      <header className="kv-screen__header">
        <div>
          <h1 className="kv-title">{greeting(new Date().getHours(), state.user?.displayName ?? "there")}</h1>
          <p className="kv-micro">Plan updated {plan.approvedAt ? "for this paycheck" : "recently"}</p>
        </div>
        <Link to="/settings" className="kv-btn kv-btn--ghost" aria-label="Settings">
          <Settings size={18} aria-hidden="true" />
        </Link>
      </header>

      <section className="kv-card kv-card--hero kv-today__hero" aria-label="Safe to spend">
        {sts && (
          <>
            <p className="kv-caption">Safe to spend</p>
            <AmountDisplay amount={sts.amount} size={48} />
            <p className="kv-caption">Until {friendlyDate(sts.until)}</p>
            <p className="kv-today__hero-note">
              Your bills{goalAllocation ? ` and ${formatMoney(goalAllocation.funded)} goal contribution` : ""} are
              protected.
            </p>
            {sts.overspent && (
              <p className="kv-chip kv-chip--attention">
                Flexible spending went {formatMoney(sts.overspendAmount)} past the pool — next check can absorb it.
              </p>
            )}
            <div className="kv-today__flow" aria-hidden="true">
              {plan.allocations
                .filter((a) => a.funded.amount > 0)
                .map((a) => (
                  <div
                    key={a.id}
                    className={`kv-today__flow-seg ${a.category === "flexible" ? "is-flex" : ""}`}
                    style={{ flexGrow: a.funded.amount }}
                    title={a.label}
                  />
                ))}
            </div>
            <ProgressBar
              fraction={elapsed / periodDays}
              label={`Pay period progress: day ${elapsed} of ${periodDays}`}
            />
          </>
        )}
      </section>

      {nextUp && (
        <section className="kv-card kv-today__nextup" aria-label="Next up">
          <CalendarClock size={18} aria-hidden="true" className="kv-today__nextup-icon" />
          <div>
            <p className="kv-today__nextup-title">{nextUp.title}</p>
            <p className="kv-caption">{nextUp.detail}</p>
          </div>
        </section>
      )}

      {goal && (
        <Link to="/goals" className="kv-card kv-today__goal">
          <div className="kv-today__goal-head">
            <p className="kv-today__goal-name">
              {goal.emoji ? `${goal.emoji} ` : ""}
              {goal.name}
            </p>
            <span className="kv-num kv-caption">
              {formatMoney(goal.saved)} of {formatMoney(goal.price)}
            </span>
          </div>
          <ProgressBar
            fraction={goal.price.amount > 0 ? goal.saved.amount / goal.price.amount : 0}
            label={`${goal.name} progress`}
          />
          <p className="kv-caption">
            {formatMoney(usd(Math.max(0, goal.price.amount - goal.saved.amount)))} to go
            {forecast?.completionDate ? ` · on track for ${friendlyDate(forecast.completionDate)}` : ""}
          </p>
        </Link>
      )}

      <section className="kv-card" aria-label="This paycheck's plan">
        <div className="kv-today__plan-head">
          <h2 className="kv-heading">This paycheck's plan</h2>
          <Link to="/plan" className="kv-btn kv-btn--ghost kv-btn--sm">
            Details
          </Link>
        </div>
        <AllocationLanes allocations={plan.allocations} netPayCents={plan.netPay.amount} />
      </section>

      {insight && (
        <section className="kv-card kv-today__insight" aria-label="Insight">
          <Lightbulb size={16} aria-hidden="true" />
          <p className="kv-caption">{insight}</p>
        </section>
      )}

      <div className="kv-today__actions">
        <button className="kv-btn kv-btn--secondary" onClick={() => navigate("/scan")}>
          <ScanLine size={16} aria-hidden="true" /> Scan pay
        </button>
        <button
          className="kv-btn kv-btn--secondary"
          onClick={() => setParams({ add: "expense" })}
        >
          <ReceiptText size={16} aria-hidden="true" /> Add expense
        </button>
        <button className="kv-btn kv-btn--secondary" onClick={() => navigate("/chat")}>
          <MessageCircle size={16} aria-hidden="true" /> Ask Kova
        </button>
      </div>

      <Disclaimer />

      <AddExpenseSheet open={addExpenseOpen} onClose={() => setParams({})} />
    </div>
  );
}

function AddExpenseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const logExpense = useAppStore((s) => s.logExpense);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = normalizeMoneyInput(amount);
    if (!parsed.ok || !parsed.money) {
      setError(parsed.error ?? "Enter a valid amount");
      return;
    }
    setBusy(true);
    await logExpense(label.trim() || "Expense", parsed.money, toIso(new Date()));
    setBusy(false);
    setLabel("");
    setAmount("");
    setError(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add expense">
      <div className="kv-field">
        <label className="kv-label" htmlFor="exp-label">
          What was it?
        </label>
        <input
          id="exp-label"
          className="kv-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Groceries, gas, dinner…"
        />
      </div>
      <div className="kv-field">
        <label className="kv-label" htmlFor="exp-amount">
          Amount
        </label>
        <input
          id="exp-amount"
          className="kv-input"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError(null);
          }}
          placeholder="$24.50"
          aria-invalid={error !== null}
        />
        {error && (
          <p className="kv-micro" style={{ color: "var(--kova-attention)" }}>
            {error}
          </p>
        )}
      </div>
      <button className="kv-btn kv-btn--primary" onClick={() => void submit()} disabled={busy}>
        Log expense
      </button>
      <p className="kv-micro">Logged against your flexible money — bills and goals stay untouched.</p>
    </Sheet>
  );
}
