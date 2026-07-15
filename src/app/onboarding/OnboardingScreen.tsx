import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { normalizeMoneyInput, usd, type Money } from "@/domain/money";
import type { PayFrequency } from "@/domain/types";
import { useAppStore, type OnboardingAnswers } from "@/store/appStore";
import { AmountDisplay } from "@/components/AmountDisplay";
import { Disclaimer } from "@/components/Disclaimer";
import { KovaWordmark } from "@/components/KovaMark";
import "./Onboarding.css";

const BASE = import.meta.env.BASE_URL;

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

const FREQUENCIES: Array<{ value: PayFrequency; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every two weeks" },
  { value: "semimonthly", label: "Twice a month" },
  { value: "monthly", label: "Monthly" },
  { value: "irregular", label: "It changes" },
];

const FOCUSES: Array<{ value: NonNullable<OnboardingAnswers["focus"]>; label: string }> = [
  { value: "spending", label: "Spending smarter" },
  { value: "savings", label: "Building savings" },
  { value: "bills", label: "Paying bills on time" },
  { value: "goal", label: "Saving for something" },
  { value: "future_fund", label: "Building a future/business fund" },
];

const PROTECT_OPTIONS = ["Bills", "Transport", "Phone", "Subscriptions", "Debt"];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const seedDemo = useAppStore((s) => s.seedDemo);

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<PayFrequency | null>(null);
  const [focus, setFocus] = useState<OnboardingAnswers["focus"] | null>(null);
  const [protectedCats, setProtectedCats] = useState<string[]>([]);
  const [customProtect, setCustomProtect] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalPrice, setGoalPrice] = useState("");
  const [goalPriceError, setGoalPriceError] = useState<string | null>(null);
  const [goalPriority, setGoalPriority] = useState<"high" | "medium" | "low">("high");
  const [region, setRegion] = useState("");
  const [memoryConsent, setMemoryConsent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const parsedGoalPrice: Money | null = useMemo(() => {
    if (goalPrice.trim() === "") return null;
    const r = normalizeMoneyInput(goalPrice);
    return r.ok ? (r.money ?? null) : null;
  }, [goalPrice]);

  const next = () => setStep((s) => Math.min(7, s + 1) as Step);
  const back = () => setStep((s) => Math.max(0, s - 1) as Step);

  async function finish() {
    if (busy || !frequency || !focus || memoryConsent === null) return;
    setBusy(true);
    const goal =
      goalName.trim() && parsedGoalPrice
        ? { name: goalName.trim(), price: parsedGoalPrice, priority: goalPriority }
        : undefined;
    await completeOnboarding({
      displayName: name.trim() || "there",
      frequency,
      focus,
      protectedCategories: [
        ...protectedCats,
        ...(customProtect.trim() ? [customProtect.trim()] : []),
      ],
      ...(goal ? { goal } : {}),
      ...(region.trim() ? { region: region.trim() } : {}),
      memoryConsent,
    });
    setStep(7);
    setBusy(false);
  }

  async function exploreDemo() {
    if (busy) return;
    setBusy(true);
    await seedDemo();
    navigate("/today");
  }

  const stepMotion = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, x: -24 },
    transition: { duration: 0.22, ease: [0.32, 0.72, 0.28, 1] as const },
  };

  return (
    <div className="kv-onboarding">
      <header className="kv-onboarding__top">
        {step > 0 && step < 7 && (
          <button className="kv-btn kv-btn--ghost" onClick={back} aria-label="Back">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        )}
        <div
          className="kv-onboarding__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={7}
          aria-valuenow={step}
          aria-label="Onboarding progress"
        >
          <div className="kv-onboarding__progress-fill" style={{ width: `${(step / 7) * 100}%` }} />
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.section key={step} className="kv-onboarding__step" {...stepMotion}>
          {step === 0 && (
            <>
              <div className="kv-onboarding__brand">
                <KovaWordmark markSize={26} />
              </div>
              <img
                className="kv-onboarding__hero-art"
                src={`${BASE}brand/hero-vessel.webp`}
                alt=""
                role="presentation"
                width={1344}
                height={892}
              />
              <h1 className="kv-title">Every paycheck, already planned.</h1>
              <p className="kv-caption">
                Kova keeps your bills and goals protected, then shows what you can spend safely
                until the next payday. Your data stays on this device.
              </p>
              <div className="kv-field">
                <label className="kv-label" htmlFor="ob-name">
                  What should Kova call you?
                </label>
                <input
                  id="ob-name"
                  className="kv-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your first name"
                  autoComplete="given-name"
                />
              </div>
              <button className="kv-btn kv-btn--primary" onClick={next}>
                Get started
              </button>
              <button className="kv-btn kv-btn--ghost" onClick={exploreDemo} disabled={busy}>
                Explore with demo data instead
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="kv-heading">How do you usually get paid?</h1>
              <div className="kv-onboarding__options" role="radiogroup" aria-label="Pay frequency">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    role="radio"
                    aria-checked={frequency === f.value}
                    className={`kv-onboarding__option ${frequency === f.value ? "is-selected" : ""}`}
                    onClick={() => {
                      setFrequency(f.value);
                      next();
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="kv-heading">What do you want Kova to help with first?</h1>
              <div className="kv-onboarding__options" role="radiogroup" aria-label="First focus">
                {FOCUSES.map((f) => (
                  <button
                    key={f.value}
                    role="radio"
                    aria-checked={focus === f.value}
                    className={`kv-onboarding__option ${focus === f.value ? "is-selected" : ""}`}
                    onClick={() => {
                      setFocus(f.value);
                      next();
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="kv-heading">Any money that must be protected?</h1>
              <p className="kv-caption">Pick everything that applies. You can add exact bills later.</p>
              <div className="kv-onboarding__options">
                {PROTECT_OPTIONS.map((opt) => {
                  const on = protectedCats.includes(opt);
                  return (
                    <button
                      key={opt}
                      role="checkbox"
                      aria-checked={on}
                      className={`kv-onboarding__option ${on ? "is-selected" : ""}`}
                      onClick={() =>
                        setProtectedCats((cur) =>
                          on ? cur.filter((c) => c !== opt) : [...cur, opt],
                        )
                      }
                    >
                      {opt}
                    </button>
                  );
                })}
                <input
                  className="kv-input"
                  value={customProtect}
                  onChange={(e) => setCustomProtect(e.target.value)}
                  placeholder="Something else…"
                  aria-label="Custom protected category"
                />
              </div>
              <button className="kv-btn kv-btn--primary" onClick={next}>
                Continue
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="kv-heading">What are you saving for?</h1>
              <p className="kv-caption">Optional — you can add goals any time.</p>
              <div className="kv-field">
                <label className="kv-label" htmlFor="ob-goal-name">
                  Goal name
                </label>
                <input
                  id="ob-goal-name"
                  className="kv-input"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="E-bike, laptop, emergency fund…"
                />
              </div>
              <div className="kv-field">
                <label className="kv-label" htmlFor="ob-goal-price">
                  Price
                </label>
                <input
                  id="ob-goal-price"
                  className="kv-input"
                  inputMode="decimal"
                  value={goalPrice}
                  onChange={(e) => {
                    setGoalPrice(e.target.value);
                    setGoalPriceError(null);
                  }}
                  onBlur={() => {
                    if (goalPrice.trim() && !parsedGoalPrice) {
                      setGoalPriceError("Use a positive amount like 1500 or 1,499.99");
                    }
                  }}
                  placeholder="$1,500"
                  aria-invalid={goalPriceError !== null}
                  aria-describedby={goalPriceError ? "ob-goal-price-err" : undefined}
                />
                {goalPriceError && (
                  <p id="ob-goal-price-err" className="kv-micro" style={{ color: "var(--kova-attention)" }}>
                    {goalPriceError}
                  </p>
                )}
              </div>
              <div className="kv-field">
                <span className="kv-label" id="ob-priority-label">
                  How important is it?
                </span>
                <div className="kv-onboarding__row" role="radiogroup" aria-labelledby="ob-priority-label">
                  {(["high", "medium", "low"] as const).map((p) => (
                    <button
                      key={p}
                      role="radio"
                      aria-checked={goalPriority === p}
                      className={`kv-chip kv-chip--interactive ${goalPriority === p ? "kv-chip--progress" : ""}`}
                      onClick={() => setGoalPriority(p)}
                    >
                      {p === "high" ? "Very" : p === "medium" ? "Somewhat" : "Nice to have"}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="kv-btn kv-btn--primary"
                onClick={next}
                disabled={goalName.trim() !== "" && goalPrice.trim() !== "" && !parsedGoalPrice}
              >
                Continue
              </button>
              <button className="kv-btn kv-btn--ghost" onClick={next}>
                Skip for now
              </button>
            </>
          )}

          {step === 5 && (
            <>
              <h1 className="kv-heading">Where do you live and work?</h1>
              <p className="kv-caption">
                Used only for payroll and tax planning context. Optional — Kova currently shows
                illustrative tax estimates only, never tax advice.
              </p>
              <div className="kv-field">
                <label className="kv-label" htmlFor="ob-region">
                  Region
                </label>
                <input
                  id="ob-region"
                  className="kv-input"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="City or state (optional)"
                />
              </div>
              <button className="kv-btn kv-btn--primary" onClick={next}>
                Continue
              </button>
            </>
          )}

          {step === 6 && (
            <>
              <h1 className="kv-heading">Should Kova remember your priorities?</h1>
              <p className="kv-caption">
                Memory means Kova keeps structured notes like "phone bill is always protected" to
                keep your plan consistent. Every memory is visible in the Memory Center, and you can
                edit or delete any of them at any time. Nothing is remembered without your approval.
              </p>
              <div className="kv-onboarding__options" role="radiogroup" aria-label="Memory consent">
                <button
                  role="radio"
                  aria-checked={memoryConsent === true}
                  className={`kv-onboarding__option ${memoryConsent === true ? "is-selected" : ""}`}
                  onClick={() => setMemoryConsent(true)}
                >
                  Yes, help me keep my plan consistent
                </button>
                <button
                  role="radio"
                  aria-checked={memoryConsent === false}
                  className={`kv-onboarding__option ${memoryConsent === false ? "is-selected" : ""}`}
                  onClick={() => setMemoryConsent(false)}
                >
                  I'll manage it manually
                </button>
              </div>
              <button
                className="kv-btn kv-btn--primary"
                onClick={finish}
                disabled={memoryConsent === null || busy}
              >
                Finish setup
              </button>
            </>
          )}

          {step === 7 && (
            <FirstPlanReveal
              name={name.trim() || "there"}
              goalName={goalName.trim()}
              goalPrice={parsedGoalPrice}
              onDone={() => navigate("/today")}
            />
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

function FirstPlanReveal({
  name,
  goalName,
  goalPrice,
  onDone,
}: {
  name: string;
  goalName: string;
  goalPrice: Money | null;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className="kv-onboarding__reveal"
      style={{
        backgroundImage: `linear-gradient(rgba(9,10,11,0.72), rgba(9,10,11,0.94)), url(${BASE}brand/texture-obsidian.webp)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: "var(--kova-radius-card-lg)",
      }}
    >
      <motion.h1
        className="kv-title"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        Your first plan is ready, {name}.
      </motion.h1>
      <motion.div
        className="kv-card kv-card--hero kv-onboarding__reveal-card"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduced ? 0 : 0.18, duration: 0.3 }}
      >
        <p className="kv-caption">Safe to spend</p>
        <AmountDisplay amount={usd(0)} size={40} />
        <p className="kv-caption">
          Scan or enter your next paycheck and Kova fills this in — bills
          {goalName ? ` and your ${goalName} goal` : " and your goals"} protected first.
        </p>
        {goalPrice && goalName && (
          <p className="kv-micro">
            {goalName} target: <AmountDisplay amount={goalPrice} size={12} />
          </p>
        )}
      </motion.div>
      <button className="kv-btn kv-btn--primary" onClick={onDone}>
        Open Kova
      </button>
      <Disclaimer />
    </div>
  );
}
