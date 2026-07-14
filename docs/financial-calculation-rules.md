# Kova — Financial Calculation Rules

All functions live in `src/domain`, are pure, deterministic, and unit-tested (119 tests, incl.
property tests). AI never performs any of these calculations.

## Money (`money.ts`)

- Currency is **integer cents** behind the branded `Cents` type; constructors (`usd`, `cents`)
  reject fractions, NaN, Infinity, and amounts beyond $100M.
- `normalizeMoneyInput()` parses human input ("$1,234.56") digit-by-digit into cents — no
  floating point end-to-end. Rejects negatives and >2 decimals.
- `multiplyRatio()` rounds half away from zero, deterministically.
- `allocateProportionally()` uses largest-remainder so parts always sum exactly to the total.
- Formatting: tabular figures in UI (`kv-money`), `formatMoneyForSpeech()` for screen readers.

## Pay periods (`payPeriod.ts`)

- Frequencies: weekly, biweekly (fixed-interval from an anchor pay date), semimonthly (1st +
  15th), monthly (anchor day clamped to month end), irregular.
- **Irregular income never gets an invented next payday**: `nextPayDate()` returns `null`; the
  app falls back to a labeled 14-day protection window, and forecasts refuse to date completions.
- A paycheck protects bills due in `(payDate, nextPayDate]`.

## Allocation (`allocation.ts`)

Waterfall priority — fixed and explained in-product:
1. Required bills due before the next payday (earliest due date first)
2. Minimum safety buffer — `max(percentOfNet, floorPerCheck)` (`bills.ts`)
3. Approved goal minimum contributions (priority high→low, then name; capped at remaining need)
4. User-defined future/business fund
5. Flexible remainder = safe-to-spend pool

Shortfall behavior: **never over-allocate**. Lower priorities are reduced or zeroed, the plan is
marked `needs_attention`, and shame-free explanations are attached. Invariants enforced by
`validateAllocationPlan()` and property tests:
- funded ≤ planned per allocation, funded ≥ 0
- Σ funded = net pay exactly (every cent accounted)
- once one item is shorted, nothing after it receives funds
- no duplicate bills

## Safe to spend (`safeToSpend.ts`)

`safeToSpend = flexible pool − in-period flexible expenses`, floored at zero for display with an
explicit `overspent`/`overspendAmount` signal. Framing rule: this is **unallocated money from the
paycheck** — Kova never claims bank-balance knowledge.

## Forecasts (`forecast.ts`)

`checksNeeded = ceil(remaining / perCheck)`; completion date = nth upcoming pay date. Returns a
typed reason (`paused`, `no_contribution`, `irregular_income`, `already_complete`) instead of
guessing. Ten-year horizon hard stop.

## Scenarios (`scenarios.ts`)

Presets: conservative (goals ×0.6, buffer ×1.5), balanced (×1), faster_goal (goals ×1.5). Pure
functions — browsing never mutates inputs or the live plan; applying a scenario is a separate,
user-approved store action. `simulateExpenseImpact()` answers "what if I spend $X" without side
effects.

## Paycheck math (`paycheck.ts`)

- `calculateNetPay(gross, deductions)`; `reconcilePaycheck()` with $1.00 tolerance gates OCR
  acceptance.
- `classifyPaycheckFieldSource()` is the single source of the mandatory provenance labels;
  critical money fields flag below 90% confidence, non-critical below 75%, and any conflict with
  a deterministic cross-check forces review regardless of confidence.

## Tax estimates (`tax/`)

Modular `TaxJurisdictionAdapter`. The MVP ships only **"Illustria"** — a deliberately fictional
jurisdiction with US-shaped mechanics (progressive brackets + two flat payroll lines) so the UX
can be demonstrated honestly without real-region claims. Every estimate carries
`illustrative: true` and the disclaimer string; **paystub withholding always supersedes
estimates** (`supersededByPaystub`). Real regions require verified source data + legal review.
