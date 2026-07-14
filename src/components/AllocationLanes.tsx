import { motion, useReducedMotion } from "motion/react";
import { formatMoney, formatMoneyForSpeech } from "@/domain/money";
import type { Allocation } from "@/domain/types";
import { AmountDisplay } from "./AmountDisplay";
import "./AllocationLanes.css";

interface AllocationLanesProps {
  allocations: readonly Allocation[];
  netPayCents: number;
  /** Stagger the lanes in (the paycheck-split motion moment). */
  animateIn?: boolean;
}

const CATEGORY_LABEL: Record<Allocation["category"], string> = {
  bill: "Bills",
  buffer: "Buffer",
  goal: "Goals",
  future_fund: "Future",
  flexible: "Flexible",
};

/**
 * The plan's allocation lanes: one labeled row per allocation with a width
 * proportional to its share of net pay. Flexible renders in mint (safe money);
 * shorted lanes get an amber marker + text, never red.
 */
export function AllocationLanes({ allocations, netPayCents, animateIn = false }: AllocationLanesProps) {
  const reduced = useReducedMotion();
  const visible = allocations.filter((a) => a.planned.amount > 0);
  return (
    <ul className="kv-lanes" aria-label="This paycheck's plan">
      {visible.map((a, i) => {
        const share = netPayCents > 0 ? a.funded.amount / netPayCents : 0;
        const shorted = a.funded.amount < a.planned.amount;
        return (
          <motion.li
            key={a.id}
            className="kv-lanes__row"
            initial={animateIn && !reduced ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : i * 0.06, duration: 0.26, ease: [0.32, 0.72, 0.28, 1] }}
          >
            <div className="kv-lanes__meta">
              <span className="kv-lanes__label">
                {a.label}
                <span className="kv-micro"> · {CATEGORY_LABEL[a.category]}</span>
              </span>
              <span
                className="kv-num kv-lanes__amount"
                aria-label={`${a.label}: ${formatMoneyForSpeech(a.funded)}`}
              >
                <AmountDisplay amount={a.funded} size={14} />
              </span>
            </div>
            <div className="kv-lanes__track">
              <motion.div
                className={`kv-lanes__fill ${a.category === "flexible" ? "kv-lanes__fill--flex" : ""} ${shorted ? "kv-lanes__fill--short" : ""}`}
                initial={animateIn && !reduced ? { width: 0 } : false}
                animate={{ width: `${Math.max(share * 100, 2)}%` }}
                transition={{ delay: reduced ? 0 : i * 0.06 + 0.08, duration: 0.32, ease: [0.32, 0.72, 0.28, 1] }}
              />
            </div>
            {shorted && (
              <p className="kv-micro kv-lanes__short-note">
                Planned {formatMoney(a.planned)} — {formatMoney(a.funded)} covered this check
              </p>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
