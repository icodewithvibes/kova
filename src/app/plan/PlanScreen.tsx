import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { HelpCircle } from "lucide-react";
import { formatMoney, usd } from "@/domain/money";
import { fromIso, toIso, daysBetween } from "@/domain/payPeriod";
import { compareScenarios, type ScenarioKind, type ScenarioResult } from "@/domain/scenarios";
import type { AllocationPlanInput } from "@/domain/allocation";
import type { ReasonCode } from "@/domain/types";
import { billOccurrences } from "@/data/seed";
import {
  selectCurrentPlan,
  selectSafeToSpend,
  toGoalInput,
  useAppStore,
} from "@/store/appStore";
import { AmountDisplay } from "@/components/AmountDisplay";
import { AllocationLanes } from "@/components/AllocationLanes";
import { ProgressBar } from "@/components/ProgressBar";
import { Disclaimer } from "@/components/Disclaimer";
import { Sheet } from "@/components/Sheet";
import "./Plan.css";

const REASON_TEXT: Record<ReasonCode, string> = {
  bill_due_before_next_payday: "Due before your next payday",
  buffer_minimum: "Your minimum safety buffer",
  goal_minimum_contribution: "Your approved goal contribution",
  future_fund_user_setting: "Your future-fund setting",
  flexible_remainder: "Everything left is yours to spend",
  shortfall_bill_unfunded: "This check couldn't fully cover it",
  shortfall_buffer_reduced: "Reduced this check to cover bills",
  shortfall_goal_reduced: "Reduced this check to cover higher priorities",
  shortfall_future_fund_skipped: "Paused this check to cover higher priorities",
};

const SCENARIO_LABEL: Record<ScenarioKind, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  faster_goal: "Faster goal",
};

export function PlanScreen() {
  const navigate = useNavigate();
  const state = useAppStore();
  const plan = selectCurrentPlan(state);
  const sts = selectSafeToSpend(state);
  const [explainOpen, setExplainOpen] = useState(false);
  const [scenario, setScenario] = useState<ScenarioKind>("balanced");
  const [confirming, setConfirming] = useState<ScenarioResult | null>(null);

  const scenarioInput: AllocationPlanInput | null = useMemo(() => {
    if (!plan || !state.preferences) return null;
    return {
      paycheckId: plan.paycheckId,
      netPay: plan.netPay,
      payDate: plan.payDate,
      nextPayDate: plan.nextPayDate,
      bills: billOccurrences(state.bills, plan.payDate, plan.nextPayDate),
      bufferPolicy: {
        percentOfNet: state.preferences.bufferPercentOfNet,
        minimumPerCheck: state.preferences.bufferMinimumPerCheck,
      },
      goals: state.goals.filter((g) => g.state === "active").map(toGoalInput),
      futureFundPerCheck: state.preferences.futureFundPerCheck,
    };
  }, [plan, state.preferences, state.bills, state.goals]);

  const scenarios = useMemo(() => {
    if (!scenarioInput || !state.paySchedule) return null;
    return compareScenarios(scenarioInput, state.paySchedule.frequency, state.paySchedule.anchorPayDate);
  }, [scenarioInput, state.paySchedule]);

  if (!plan) {
    return (
      <div className="kv-screen">
        <h1 className="kv-title">Plan</h1>
        <div className="kv-card">
          <p className="kv-caption">
            No plan yet. Add a paycheck and Kova builds one with your bills and goals protected.
          </p>
          <button className="kv-btn kv-btn--primary" style={{ marginTop: 16 }} onClick={() => navigate("/scan")}>
            Add a paycheck
          </button>
        </div>
      </div>
    );
  }

  const today = toIso(new Date());
  const periodDays = Math.max(1, daysBetween(plan.payDate, plan.nextPayDate));
  const elapsed = Math.min(periodDays, Math.max(0, daysBetween(plan.payDate, today)));
  const selected = scenarios?.find((s) => s.kind === scenario) ?? null;
  const flexibleSpent = sts?.flexibleSpent ?? usd(0);

  return (
    <div className="kv-screen">
      <header className="kv-screen__header">
        <div>
          <h1 className="kv-title">Plan</h1>
          <p className="kv-micro">
            Net paycheck <span className="kv-num">{formatMoney(plan.netPay)}</span> · paid{" "}
            {format(fromIso(plan.payDate), "MMM d")}
          </p>
        </div>
        <button className="kv-btn kv-btn--ghost" onClick={() => setExplainOpen(true)}>
          <HelpCircle size={16} aria-hidden="true" /> Explain
        </button>
      </header>

      {plan.status === "needs_attention" && plan.shortfall && (
        <div className="kv-plan__attention" role="status">
          <p className="kv-caption" style={{ color: "var(--kova-attention)" }}>
            Plan needs attention — this check was {formatMoney(plan.shortfall.amount)} short of
            covering everything. Kova protected items in priority order.
          </p>
        </div>
      )}

      <section className="kv-card" aria-label="Pay period timeline">
        <div className="kv-plan__timeline-labels">
          <span className="kv-micro">{format(fromIso(plan.payDate), "MMM d")}</span>
          <span className="kv-micro">
            day {elapsed} of {periodDays}
          </span>
          <span className="kv-micro">{format(fromIso(plan.nextPayDate), "MMM d")}</span>
        </div>
        <ProgressBar fraction={elapsed / periodDays} label="Pay period progress" />
      </section>

      <section className="kv-card" aria-label="Allocations">
        <h2 className="kv-heading" style={{ marginBottom: 12 }}>
          Where this check goes
        </h2>
        <AllocationLanes allocations={plan.allocations} netPayCents={plan.netPay.amount} />
        <hr className="kv-divider" />
        <ul className="kv-plan__reasons">
          {plan.allocations
            .filter((a) => a.planned.amount > 0)
            .map((a) => (
              <li key={a.id} className="kv-plan__reason">
                <span className="kv-caption">{a.label}</span>
                <span className="kv-micro">{REASON_TEXT[a.reason]}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="kv-card" aria-label="Planned versus actual">
        <h2 className="kv-heading" style={{ marginBottom: 12 }}>
          Planned vs. actual
        </h2>
        <div className="kv-row">
          <span className="kv-caption">Flexible pool</span>
          <AmountDisplay amount={plan.safeToSpend} size={15} />
        </div>
        <div className="kv-row">
          <span className="kv-caption">Spent so far</span>
          <AmountDisplay amount={flexibleSpent} size={15} />
        </div>
        <div className="kv-row">
          <span className="kv-caption" style={{ fontWeight: 600, color: "var(--kova-text-primary)" }}>
            Still safe to spend
          </span>
          {sts && <AmountDisplay amount={sts.amount} size={18} />}
        </div>
      </section>

      {scenarios && selected && (
        <section className="kv-card" aria-label="Scenarios">
          <h2 className="kv-heading">Try another shape</h2>
          <p className="kv-micro" style={{ marginBottom: 12 }}>
            Browsing never changes your live plan — only "Use this plan" does.
          </p>
          <div className="kv-plan__scenario-tabs" role="tablist" aria-label="Scenario">
            {scenarios.map((s) => (
              <button
                key={s.kind}
                role="tab"
                aria-selected={scenario === s.kind}
                className={`kv-plan__scenario-tab ${scenario === s.kind ? "is-active" : ""}`}
                onClick={() => setScenario(s.kind)}
              >
                {SCENARIO_LABEL[s.kind]}
              </button>
            ))}
          </div>
          <div className="kv-plan__scenario-body" role="tabpanel">
            <div className="kv-row">
              <span className="kv-caption">Safe to spend</span>
              <AmountDisplay amount={selected.safeToSpend} size={15} />
            </div>
            <div className="kv-row">
              <span className="kv-caption">To goals</span>
              <AmountDisplay amount={selected.totalToGoals} size={15} />
            </div>
            <div className="kv-row">
              <span className="kv-caption">Buffer</span>
              <AmountDisplay amount={selected.totalToBuffer} size={15} />
            </div>
            {selected.primaryGoalForecast?.completionDate && (
              <div className="kv-row">
                <span className="kv-caption">Goal finish</span>
                <span className="kv-caption kv-num">
                  {format(fromIso(selected.primaryGoalForecast.completionDate), "MMM d, yyyy")}
                  {selected.goalDaysDelta !== null && selected.goalDaysDelta !== 0 && (
                    <span style={{ color: "var(--kova-progress)" }}>
                      {" "}
                      ({selected.goalDaysDelta > 0 ? `${selected.goalDaysDelta} days sooner` : `${-selected.goalDaysDelta} days later`})
                    </span>
                  )}
                </span>
              </div>
            )}
            <p className="kv-caption" style={{ marginTop: 8 }}>
              {selected.explanation}
            </p>
            {scenario !== "balanced" && (
              <button className="kv-btn kv-btn--secondary" style={{ marginTop: 12 }} onClick={() => setConfirming(selected)}>
                Use this plan
              </button>
            )}
          </div>
        </section>
      )}

      <Disclaimer />

      <Sheet open={explainOpen} onClose={() => setExplainOpen(false)} title="How this plan works">
        <p className="kv-caption">
          Kova plans each paycheck in a fixed, deterministic order — no guessing, no AI math:
        </p>
        <ol className="kv-plan__explain-list">
          <li>Bills due before your next payday</li>
          <li>Your minimum safety buffer</li>
          <li>Goal contributions you approved</li>
          <li>Your future fund, if set</li>
          <li>Everything left is flexible — that's your safe-to-spend number</li>
        </ol>
        <p className="kv-caption">
          If a check can't cover everything, Kova never pretends it did. Higher priorities are
          funded first and the gap is explained plainly.
        </p>
      </Sheet>

      <Sheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Apply this scenario?"
      >
        {confirming && (
          <>
            <p className="kv-caption">
              This updates your live plan for the current paycheck: safe to spend becomes{" "}
              <strong className="kv-num">{formatMoney(confirming.safeToSpend)}</strong>
              {confirming.goalDaysDelta !== null && confirming.goalDaysDelta !== 0 && (
                <>
                  {" "}
                  and your goal timeline moves{" "}
                  {confirming.goalDaysDelta > 0
                    ? `${confirming.goalDaysDelta} days sooner`
                    : `${-confirming.goalDaysDelta} days later`}
                </>
              )}
              .
            </p>
            <button
              className="kv-btn kv-btn--primary"
              onClick={() => {
                void useAppStore
                  .getState()
                  .applyPlanUpdate(
                    plan.id,
                    [...confirming.plan.allocations],
                    confirming.plan.safeToSpend,
                    `You applied the ${SCENARIO_LABEL[confirming.kind]} scenario.`,
                  )
                  .then(() => setConfirming(null));
              }}
            >
              Yes, update my plan
            </button>
            <button className="kv-btn kv-btn--ghost" onClick={() => setConfirming(null)}>
              Keep my current plan
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
}
