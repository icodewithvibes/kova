/**
 * Protected bills and safety buffer — deterministic helpers feeding allocation.
 */
import { ZERO, percentage, sum, max, type Money, usd } from "./money";
import { billsDueInPeriod } from "./payPeriod";
import type { BillDue, IsoDate } from "./types";

/** Bills this paycheck must protect: due after pay date, on/before next payday. */
export function calculateProtectedBills(
  bills: readonly BillDue[],
  payDate: IsoDate,
  nextPayDate: IsoDate,
): { bills: BillDue[]; total: Money } {
  const due = billsDueInPeriod(bills, payDate, nextPayDate).sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
  return { bills: due, total: sum(due.map((b) => b.amount)) };
}

export interface BufferPolicy {
  /** Percent of net pay reserved as safety buffer per check (e.g. 5). */
  readonly percentOfNet: number;
  /** Hard floor per check, regardless of percentage. */
  readonly minimumPerCheck: Money;
}

export const DEFAULT_BUFFER_POLICY: BufferPolicy = {
  percentOfNet: 5,
  minimumPerCheck: usd(10_00),
};

/** Per-check minimum safety buffer: max(percent of net, floor). Zero net → zero. */
export function calculateMinimumBuffer(netPay: Money, policy: BufferPolicy): Money {
  if (netPay.amount <= 0) return ZERO;
  return max(percentage(netPay, policy.percentOfNet), policy.minimumPerCheck);
}
