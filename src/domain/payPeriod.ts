/**
 * Pay-frequency and pay-date math. All deterministic, all on ISO date strings.
 */
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isValid,
  lastDayOfMonth,
  parseISO,
  setDate,
} from "date-fns";
import type { IsoDate, PayFrequency } from "./types";

export function toIso(d: Date): IsoDate {
  return format(d, "yyyy-MM-dd");
}

export function fromIso(iso: IsoDate): Date {
  const d = parseISO(iso);
  if (!isValid(d)) throw new Error(`Invalid ISO date: ${iso}`);
  return d;
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarDays(fromIso(to), fromIso(from));
}

export const PAYCHECKS_PER_YEAR: Record<Exclude<PayFrequency, "irregular">, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

/**
 * Next expected pay date strictly after `afterDate`.
 * - weekly/biweekly: fixed-interval from the anchor pay date.
 * - semimonthly: 1st and 15th (or 15th and last day when anchored mid-month).
 * - monthly: same day-of-month as anchor, clamped to month length.
 * - irregular: cannot be predicted — callers must handle `null` and ask the user.
 */
export function nextPayDate(
  frequency: PayFrequency,
  anchorPayDate: IsoDate,
  afterDate: IsoDate = anchorPayDate,
): IsoDate | null {
  const anchor = fromIso(anchorPayDate);
  const after = fromIso(afterDate);

  switch (frequency) {
    case "weekly":
    case "biweekly": {
      const step = frequency === "weekly" ? 7 : 14;
      let candidate = anchor;
      // Walk forward (or backward alignment is implicit: anchor is a real pay date).
      while (candidate <= after) {
        candidate = addDays(candidate, step);
      }
      return toIso(candidate);
    }
    case "semimonthly": {
      // Pay on the 1st and 15th of each month.
      let cursor = after;
      for (let i = 0; i < 3; i++) {
        const first = setDate(cursor, 1);
        const fifteenth = setDate(cursor, 15);
        if (first > after) return toIso(first);
        if (fifteenth > after) return toIso(fifteenth);
        cursor = addMonths(setDate(cursor, 1), 1);
      }
      return null;
    }
    case "monthly": {
      const dayOfMonth = anchor.getDate();
      let cursor = setDate(after, 1);
      for (let i = 0; i < 3; i++) {
        const eom = lastDayOfMonth(cursor).getDate();
        const candidate = setDate(cursor, Math.min(dayOfMonth, eom));
        if (candidate > after) return toIso(candidate);
        cursor = addMonths(cursor, 1);
      }
      return null;
    }
    case "irregular":
      return null;
  }
}

/** Pay dates for the next `count` checks after `afterDate` (empty for irregular). */
export function upcomingPayDates(
  frequency: PayFrequency,
  anchorPayDate: IsoDate,
  afterDate: IsoDate,
  count: number,
): IsoDate[] {
  const dates: IsoDate[] = [];
  let cursor = afterDate;
  for (let i = 0; i < count; i++) {
    const next = nextPayDate(frequency, anchorPayDate, cursor);
    if (next === null) break;
    dates.push(next);
    cursor = next;
  }
  return dates;
}

/** Bills with due dates inside (payDate, nextPayDate] — what THIS check must protect. */
export function billsDueInPeriod<T extends { dueDate: IsoDate }>(
  bills: readonly T[],
  payDate: IsoDate,
  nextPay: IsoDate,
): T[] {
  return bills.filter((b) => b.dueDate > payDate && b.dueDate <= nextPay);
}
