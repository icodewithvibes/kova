# Kova — Demo Data

All demo data is synthetic: fictional person, fictional employer, invented amounts. It is crafted
so every number the UI shows **reconciles exactly** through the deterministic engine — the demo
never fakes a figure.

## The persona

**Yuriel** — café worker at **Harborline Café** (fictional), paid **biweekly on Fridays**,
hourly + tips. Anchor pay date 2026-07-10; next payday 2026-07-24.

## Current paycheck (2026-07-10, confirmed)

| Line | Amount |
|---|---|
| Regular earnings (68.5h × $14.00) | $959.00 |
| Tips | $281.00 |
| **Gross** | **$1,240.00** |
| Federal withholding | −$128.14 |
| State withholding | −$32.00 |
| Social Security | −$76.88 |
| Medicare | −$17.98 |
| **Net** | **$985.00** |

Deductions sum to $255.00 → gross − deductions = net exactly.

## The plan (generated, not hand-written)

Net $985.00 → Phone $45 (due 7/15) + Rent share $400 (due 7/20) + buffer $49.25 (5% of net) +
E-bike Fund $65 + Future fund $25 → **flexible $400.75**.

Logged expenses: Groceries $86.40 + Gas $38.15 + Dinner $102.00 = $226.55 →
**safe to spend $174.20 until Friday, July 24** (the hero number).

Previous check (6/26, net $940) carried the $343.26 auto-insurance hit → flexible $382.75 →
Today's insight: **"You have $18 more flexible money than last check."**

## Goal

E-bike Fund: $1,500 target, $850 saved, $65/check → 10 more checks → **Nov 27, 2026** forecast.

## Recurring bills

Phone $45 (15th) · Rent share $400 (20th) · Streaming $11.99 (3rd) · Transit pass $65 (28th) ·
Auto insurance $343.26 (29th).

## Scan fixtures (`src/ocr/mockExtractor.ts`)

- **clean-scan** — reconciles; tips (84%) and state withholding (87%) flagged amber to
  demonstrate the review pattern. Net $1,025.83 for the 7/24 check.
- **blurry-photo** — several low-confidence fields AND a stated net $12.40 off from computed —
  triggers the "Some numbers don't fully match" banner and blocks confirm until corrected.

## Notes & memories

Three seeded notes including the raw MacBook note
(*"want a macbook for coding maybe used around 600 but still saving for bike"*) that drives the
Space "Organize / Turn into plan" demo. Three onboarding-sourced memories (pay cadence, e-bike
priority, protected bills) power the Memory Center.

Reset any time: Settings → Delete everything → onboarding → "Explore with demo data instead".
