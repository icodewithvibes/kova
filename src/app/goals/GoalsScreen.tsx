import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Pause, Play, Plus, Zap, ShoppingBag } from "lucide-react";
import { formatMoney, normalizeMoneyInput, subtract, usd } from "@/domain/money";
import { fromIso, toIso } from "@/domain/payPeriod";
import { simulateExpenseImpact } from "@/domain/scenarios";
import { forecastGoalCompletion } from "@/domain/forecast";
import {
  selectCurrentPlan,
  selectSafeToSpend,
  toGoalInput,
  useAppStore,
} from "@/store/appStore";
import type { GoalRecord } from "@/data/schema";
import { AmountDisplay } from "@/components/AmountDisplay";
import { ProgressBar } from "@/components/ProgressBar";
import { Disclaimer } from "@/components/Disclaimer";
import { Sheet } from "@/components/Sheet";
import "./Goals.css";

export function GoalsScreen() {
  const state = useAppStore();
  const goals = state.goals.filter((g) => g.state !== "completed");
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="kv-screen">
      <header className="kv-screen__header">
        <h1 className="kv-title">Goals</h1>
        <button className="kv-btn kv-btn--secondary kv-btn--sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} aria-hidden="true" /> New goal
        </button>
      </header>

      {goals.length === 0 ? (
        <div className="kv-card">
          <p className="kv-heading">Nothing you're saving for yet</p>
          <p className="kv-caption" style={{ marginTop: 8 }}>
            A goal gives every paycheck a direction — Kova protects a slice of each check until
            you're there.
          </p>
          <button className="kv-btn kv-btn--primary" style={{ marginTop: 16 }} onClick={() => setAddOpen(true)}>
            Create your first goal
          </button>
        </div>
      ) : (
        goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)
      )}

      <Disclaimer />
      <AddGoalSheet open={addOpen} onClose={() => setAddOpen(false)} existingGoals={goals} />
    </div>
  );
}

function GoalCard({ goal }: { goal: GoalRecord }) {
  const state = useAppStore();
  const updateGoal = useAppStore((s) => s.updateGoal);
  const [accelerateOpen, setAccelerateOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const today = toIso(new Date());

  const forecast = useMemo(
    () =>
      state.paySchedule
        ? forecastGoalCompletion(
            toGoalInput(goal),
            state.paySchedule.frequency,
            state.paySchedule.anchorPayDate,
            today,
          )
        : null,
    [goal, state.paySchedule, today],
  );

  const remaining = usd(Math.max(0, goal.price.amount - goal.saved.amount));
  const paused = goal.state === "paused";

  return (
    <article className={`kv-card kv-goal ${paused ? "kv-goal--paused" : ""}`}>
      <div className="kv-goal__head">
        <h2 className="kv-goal__name">
          {goal.emoji ? `${goal.emoji} ` : ""}
          {goal.name}
        </h2>
        <span className={`kv-chip ${goal.priority === "high" ? "kv-chip--progress" : ""}`}>
          {goal.priority === "high" ? "Top priority" : goal.priority === "medium" ? "Medium" : "Low key"}
        </span>
      </div>

      <div className="kv-goal__amounts">
        <AmountDisplay amount={goal.saved} size={26} />
        <span className="kv-caption kv-num"> of {formatMoney(goal.price)}</span>
      </div>
      <ProgressBar
        fraction={goal.price.amount > 0 ? goal.saved.amount / goal.price.amount : 0}
        label={`${goal.name} progress`}
      />

      <dl className="kv-goal__facts">
        <div>
          <dt className="kv-micro">Remaining</dt>
          <dd className="kv-caption kv-num">{formatMoney(remaining)}</dd>
        </div>
        <div>
          <dt className="kv-micro">Per paycheck</dt>
          <dd className="kv-caption kv-num">{formatMoney(goal.perCheckContribution)}</dd>
        </div>
        {goal.targetDate && (
          <div>
            <dt className="kv-micro">Target</dt>
            <dd className="kv-caption kv-num">{format(fromIso(goal.targetDate), "MMM d, yyyy")}</dd>
          </div>
        )}
        <div>
          <dt className="kv-micro">Forecast</dt>
          <dd className="kv-caption kv-num">
            {paused
              ? "Paused"
              : forecast?.completionDate
                ? format(fromIso(forecast.completionDate), "MMM d, yyyy")
                : forecast?.reason === "irregular_income" && forecast.checksNeeded
                  ? `${forecast.checksNeeded} more checks`
                  : "Set a contribution"}
          </dd>
        </div>
      </dl>

      <div className="kv-goal__actions">
        <button className="kv-btn kv-btn--secondary kv-btn--sm" onClick={() => setAccelerateOpen(true)}>
          <Zap size={13} aria-hidden="true" /> Accelerate
        </button>
        <button className="kv-btn kv-btn--secondary kv-btn--sm" onClick={() => setBuyOpen(true)}>
          <ShoppingBag size={13} aria-hidden="true" /> What if I buy this?
        </button>
        <button
          className="kv-btn kv-btn--ghost kv-btn--sm"
          onClick={() => void updateGoal(goal.id, { state: paused ? "active" : "paused" })}
        >
          {paused ? (
            <>
              <Play size={13} aria-hidden="true" /> Resume
            </>
          ) : (
            <>
              <Pause size={13} aria-hidden="true" /> Pause
            </>
          )}
        </button>
      </div>

      <AccelerateSheet goal={goal} open={accelerateOpen} onClose={() => setAccelerateOpen(false)} />
      <BuySimulationSheet goal={goal} open={buyOpen} onClose={() => setBuyOpen(false)} />
    </article>
  );
}

function AccelerateSheet({ goal, open, onClose }: { goal: GoalRecord; open: boolean; onClose: () => void }) {
  const state = useAppStore();
  const updateGoal = useAppStore((s) => s.updateGoal);
  const [bump, setBump] = useState<number>(10_00);
  const today = toIso(new Date());

  const preview = useMemo(() => {
    if (!state.paySchedule) return null;
    const current = forecastGoalCompletion(
      toGoalInput(goal),
      state.paySchedule.frequency,
      state.paySchedule.anchorPayDate,
      today,
    );
    const faster = forecastGoalCompletion(
      { ...toGoalInput(goal), perCheckContribution: usd(goal.perCheckContribution.amount + bump) },
      state.paySchedule.frequency,
      state.paySchedule.anchorPayDate,
      today,
    );
    return { current, faster };
  }, [goal, bump, state.paySchedule, today]);

  const sts = selectSafeToSpend(state);
  const affordable = sts ? sts.amount.amount >= bump : true;

  return (
    <Sheet open={open} onClose={onClose} title={`Accelerate ${goal.name}`}>
      <p className="kv-caption">Add a little more from each paycheck. You approve; nothing changes silently.</p>
      <div className="kv-goal__bumps" role="radiogroup" aria-label="Extra per paycheck">
        {[10_00, 25_00, 50_00].map((cents) => (
          <button
            key={cents}
            role="radio"
            aria-checked={bump === cents}
            className={`kv-chip kv-chip--interactive ${bump === cents ? "kv-chip--progress" : ""}`}
            onClick={() => setBump(cents)}
          >
            +{formatMoney(usd(cents))} / check
          </button>
        ))}
      </div>
      {preview?.current?.completionDate && preview.faster?.completionDate && (
        <p className="kv-caption">
          {format(fromIso(preview.current.completionDate), "MMM d")} →{" "}
          <strong style={{ color: "var(--kova-progress)" }}>
            {format(fromIso(preview.faster.completionDate), "MMM d")}
          </strong>
          {" — "}
          {Math.max(
            0,
            Math.round(
              (fromIso(preview.current.completionDate).getTime() -
                fromIso(preview.faster.completionDate).getTime()) /
                86_400_000,
            ),
          )}{" "}
          days sooner.
        </p>
      )}
      {!affordable && (
        <p className="kv-caption" style={{ color: "var(--kova-attention)" }}>
          Heads up: that's more than today's flexible money — it will tighten future checks.
        </p>
      )}
      <button
        className="kv-btn kv-btn--primary"
        onClick={() => {
          void updateGoal(goal.id, {
            perCheckContribution: usd(goal.perCheckContribution.amount + bump),
          }).then(onClose);
        }}
      >
        Add {formatMoney(usd(bump))} per paycheck
      </button>
      <button className="kv-btn kv-btn--ghost" onClick={onClose}>
        Keep it as is
      </button>
    </Sheet>
  );
}

function BuySimulationSheet({ goal, open, onClose }: { goal: GoalRecord; open: boolean; onClose: () => void }) {
  const state = useAppStore();
  const plan = selectCurrentPlan(state);
  const remaining = usd(Math.max(0, goal.price.amount - goal.saved.amount));

  const impact = useMemo(() => {
    if (!plan) return null;
    return simulateExpenseImpact(
      {
        paycheckId: plan.paycheckId,
        netPay: plan.netPay,
        payDate: plan.payDate,
        nextPayDate: plan.nextPayDate,
        allocations: plan.allocations,
        safeToSpend: plan.safeToSpend,
        status: "approved",
      },
      state.expenses.map((e) => ({ id: e.id, amount: e.amount, date: e.date, label: e.label })),
      remaining,
    );
  }, [plan, state.expenses, remaining]);

  return (
    <Sheet open={open} onClose={onClose} title={`Buying ${goal.name} today`}>
      <div className="kv-row">
        <span className="kv-caption">Saved so far</span>
        <AmountDisplay amount={goal.saved} size={15} />
      </div>
      <div className="kv-row">
        <span className="kv-caption">Still needed</span>
        <AmountDisplay amount={remaining} size={15} />
      </div>
      {remaining.amount === 0 ? (
        <p className="kv-caption" style={{ color: "var(--kova-progress)" }}>
          You've fully saved this goal — buying it doesn't touch your plan at all.
        </p>
      ) : impact ? (
        <p className="kv-caption">
          {impact.fits
            ? `Covering the remaining ${formatMoney(remaining)} from flexible money leaves ${formatMoney(
                subtract(impact.safeToSpendBefore, remaining),
              )} safe to spend. Bills and other goals stay protected.`
            : `The remaining ${formatMoney(remaining)} is ${formatMoney(impact.exceedsBy)} more than today's flexible money. Buying now would dip into money set aside for other things — waiting ${
                goal.perCheckContribution.amount > 0
                  ? `${Math.ceil(remaining.amount / goal.perCheckContribution.amount)} more checks`
                  : "a bit longer"
              } keeps everything protected.`}
        </p>
      ) : (
        <p className="kv-caption">Add a paycheck first to simulate this purchase against a real plan.</p>
      )}
      <p className="kv-micro">A simulation only — nothing changes unless you log it.</p>
      <button className="kv-btn kv-btn--secondary" onClick={onClose}>
        Close
      </button>
    </Sheet>
  );
}

function AddGoalSheet({
  open,
  onClose,
  existingGoals,
}: {
  open: boolean;
  onClose: () => void;
  existingGoals: GoalRecord[];
}) {
  const addGoal = useAppStore((s) => s.addGoal);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [perCheck, setPerCheck] = useState("");
  const [relative, setRelative] = useState<"more" | "equal" | "less" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const topGoal = existingGoals.find((g) => g.priority === "high") ?? existingGoals[0];
  const needsComparison = existingGoals.length > 0;

  async function submit() {
    const parsedPrice = normalizeMoneyInput(price);
    if (!name.trim() || !parsedPrice.ok || !parsedPrice.money) {
      setError("A name and a valid price are needed.");
      return;
    }
    const parsedPerCheck = perCheck.trim() ? normalizeMoneyInput(perCheck) : null;
    if (perCheck.trim() && (!parsedPerCheck?.ok || !parsedPerCheck.money)) {
      setError("Per-paycheck amount doesn't look right.");
      return;
    }
    const priority =
      !needsComparison || relative === "more" ? "high" : relative === "equal" ? "medium" : "low";
    await addGoal({
      name: name.trim(),
      price: parsedPrice.money,
      saved: usd(0),
      perCheckContribution: parsedPerCheck?.money ?? usd(0),
      priority,
      state: "active",
      kind: "purchase",
    });
    setName("");
    setPrice("");
    setPerCheck("");
    setRelative(null);
    setError(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="New goal">
      <div className="kv-field">
        <label className="kv-label" htmlFor="goal-name">
          What are you saving for?
        </label>
        <input
          id="goal-name"
          className="kv-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Laptop, trip, emergency fund…"
        />
      </div>
      <div className="kv-field">
        <label className="kv-label" htmlFor="goal-price">
          Price
        </label>
        <input
          id="goal-price"
          className="kv-input"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="$600"
        />
      </div>
      <div className="kv-field">
        <label className="kv-label" htmlFor="goal-percheck">
          Per paycheck (optional)
        </label>
        <input
          id="goal-percheck"
          className="kv-input"
          inputMode="decimal"
          value={perCheck}
          onChange={(e) => setPerCheck(e.target.value)}
          placeholder="$25"
        />
      </div>
      {needsComparison && topGoal && (
        <div className="kv-field">
          <span className="kv-label" id="goal-relative-label">
            Is this more important, equally important, or lower priority than your {topGoal.name}?
          </span>
          <div className="kv-goal__bumps" role="radiogroup" aria-labelledby="goal-relative-label">
            {(
              [
                ["more", "More important"],
                ["equal", "Equally important"],
                ["less", "Lower priority"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={relative === value}
                className={`kv-chip kv-chip--interactive ${relative === value ? "kv-chip--progress" : ""}`}
                onClick={() => setRelative(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="kv-micro">
            Kova won't move money between goals on its own — this only sets the order it protects
            them in.
          </p>
        </div>
      )}
      {error && (
        <p className="kv-micro" style={{ color: "var(--kova-attention)" }} role="alert">
          {error}
        </p>
      )}
      <button
        className="kv-btn kv-btn--primary"
        onClick={() => void submit()}
        disabled={needsComparison && relative === null}
      >
        Create goal
      </button>
    </Sheet>
  );
}
