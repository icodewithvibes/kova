# Kova — Product Brief

**Tagline:** Every paycheck, already planned.
**Feel:** dark, calm, premium, private, capable, nonjudgmental.
**Platform:** Mobile app (iOS/Android), React Native + Expo.

## The problem

Most budgeting apps are built around the calendar month and around linked bank accounts. Real life runs on paychecks. People who are paid biweekly, weekly, or irregularly get a mismatch: the month starts on the 1st, but money arrives on the 9th and 23rd. Meanwhile, bank-linking apps (Plaid-based) demand credentials, harvest data, and break constantly — and a growing segment of users explicitly refuses to link accounts.

Kova's bet: **the paycheck is the budgeting unit**, and **privacy is the default**, not a tier.

## Core loop

1. **Capture** — user photographs or uploads a paystub. OCR extracts net pay, pay date, pay period, gross, deductions, YTD figures — each field with a confidence score.
2. **Review** — a calm confirmation screen shows extracted fields next to the source image. Low-confidence fields are visually flagged and take one tap to correct. Nothing is saved without user confirmation.
3. **Plan** — Kova allocates the confirmed net pay across the user's bills, goals, and spending envelopes using deterministic rules the user set up. The paycheck arrives "already planned."
4. **Live** — between paychecks, the user sees what's safe to spend, what's reserved, and what the next paycheck will need to cover.
5. **Reflect** — Kova Space (private notes) captures money thoughts, receipts-adjacent notes, and goal reflections, searchable privately on device.

## Feature pillars

**Paycheck OCR with honest uncertainty.** Field-level extraction with confidence scores; a human-in-the-loop review screen is a first-class feature, not an error state. Industry practice: surface low-confidence fields, show the source location on the document, make correction one tap.

**Paycheck-cycle planning.** Zero-based allocation per paycheck (the model YNAB/EveryDollar validated), plus a pay-period calendar showing which bills each check covers — the "paycheck planning" feature users repeatedly cite as EveryDollar's most valuable paid feature.

**Privacy-first architecture.** Local-first data (encrypted SQLite on device). No bank linking. No credential harvesting. Optional local AI so even intelligence stays on device. Cloud AI is opt-in with clear disclosure of exactly what leaves the phone.

**Kova Space (notes).** A quick-capture money notebook that opens instantly — directly answering Obsidian-mobile pain points: 10–20s startup on large vaults, sync conflicts, broken image handling. Kova Space is scoped small (money notes, not a PKM), opens in under a second, and syncs nothing by default.

**Nonjudgmental intelligence.** AI explains, forecasts, and suggests — it never scolds, never auto-changes financial records, and every AI suggestion requires explicit user approval (audit-trailed).

## Target user

- Paid biweekly/weekly/irregularly; budgets paycheck-to-paycheck by necessity or preference.
- Privacy-conscious: won't link bank accounts, distrusts data brokers.
- Wants a premium, calm tool — not gamified confetti or shame-based "overspending" alerts.

## Differentiation

| | Bank-linking apps (Monarch, Copilot) | Manual zero-based (YNAB, EveryDollar) | **Kova** |
|---|---|---|---|
| Data source | Plaid/aggregators | Manual + optional link | Paystub OCR + manual |
| Budget unit | Month | Month (paycheck views bolted on) | **Paycheck** |
| Privacy | Cloud, aggregators | Cloud | **Local-first, no bank link** |
| AI | Cloud only | Minimal | **Local or cloud, user's choice** |

## Out of scope (v1)

Bank linking, bill pay, investments, shared/household budgets, tax filing (estimation display only, clearly labeled not-advice), Android widgets (v1.1).

## Success metrics

- Time from app open → paycheck captured and planned: **< 90 seconds**.
- OCR field acceptance rate without correction: **> 85%** on common payroll formats (ADP, Gusto, Paychex, Workday).
- Kova Space quick-capture: cold open to typing **< 1 second**.
- Zero financial records ever written by AI without explicit user confirmation.

## Highest-risk assumptions

See `decisions.md` §Risks; summarized: (1) OCR accuracy on real-world paystub variety, (2) users will do photo-capture instead of demanding bank sync, (3) local AI is good enough on typical hardware, (4) paycheck-unit budgeting is a strong enough wedge vs. YNAB, (5) sustainable premium pricing without ads/data sales.
