# Kova — Handoff to Claude Code

Read first: `product-brief.md` (what), `ui-system.md` (look), `local-ai-plan.md` (AI rules), `decisions.md` (why), `asset-prompts.md` (assets). This file is the build order.

## Stack (decided — see decisions.md)

- React Native + **Expo** (managed), TypeScript strict
- **expo-sqlite + SQLCipher** (encrypted DB), key in **expo-secure-store**, **expo-local-authentication** for biometric lock
- State: Zustand (or equivalent lightweight store); money as **integer cents**, never floats
- OCR: on-device first (Apple Vision / ML Kit via config plugin or dev build); VLM verification layer behind `AIProvider`
- AI: `AIProvider` abstraction — `cloud | ollama | mock` (interface spec in `local-ai-plan.md` §7)

## Hard rules (never violate)

- [ ] AI never writes financial records, alters allocations, or saves memory without explicit user confirmation
- [ ] Every AI output that touches financial data: strict JSON schema → app-side validation → user confirm → audit-log entry
- [ ] All money math / allocation / forecasting / tax estimation in deterministic, unit-tested TypeScript
- [ ] Raw paystub images never leave the device unless the user explicitly approved that provider + upload path; prefer sending structured summaries (net pay, date, bills, goals), redact PII where possible
- [ ] Tax figures always labeled "estimate — not tax, legal, or financial advice"
- [ ] App fully functional in **mock mode** with seeded synthetic data — no API key, no local model required
- [ ] No installation of Ollama/models/system deps without asking the owner first (plan + exact commands in `local-ai-plan.md` §8)
- [ ] Synthetic paystubs only — never real financial documents in repo, tests, or benchmarks
- [ ] Users can: disable AI memory, delete memories, export all data, delete account/data

## Build order

### M0 — Scaffold
- [ ] Expo app, TS strict, ESLint/Prettier, folder structure (`src/{app,components,domain,data,ai,theme}`)
- [ ] Theme tokens from `ui-system.md` §1–3 (single source of truth)
- [ ] Encrypted SQLite setup + migrations; secure-store key bootstrap; biometric app lock
- [ ] Seed script: synthetic paystubs + demo budget/goals/notes

### M1 — Domain core (pure TS, fully unit-tested)
- [ ] Money type (integer cents), pay-period model, paycheck entity
- [ ] Allocation engine: bills → goals → envelopes per paycheck; rollover rules
- [ ] Forecast: safe-to-spend, next-check obligations, goal ETAs
- [ ] Tax estimation module (display-only, labeled)

### M2 — Capture & review (signature flow)
- [ ] Camera/photo import → OCR pipeline → field extraction with confidence + bounding boxes
- [ ] Review screen per `ui-system.md` §4: image↔field linking, amber low-confidence flags (<90% critical fields), one-tap correct, cross-field validation, single Confirm CTA
- [ ] Nothing persists before confirm; audit-log the confirmation

### M3 — Plan & live screens
- [ ] Home (safe-to-spend hero, allocation bars), Paychecks list/detail, Goals
- [ ] Paycheck calendar: which check covers which bill

### M4 — Kova Space
- [ ] Quick capture: cold open → typing <1 s, implicit save
- [ ] Local search; embeddings only when AI provider available (graceful degrade to keyword)

### M5 — AI layer
- [ ] `AIProvider` interface + `MockProvider` (deterministic canned responses) + `CloudProvider` (env-var key)
- [ ] Settings → Intelligence screen: provider picker (Kova Cloud / Private Local / Demo), active model, local-vs-cloud status, connection health, "do images leave this device?" disclosure, Test connection, fallback behavior, slower/less-accurate warning for local
- [ ] `OllamaProvider` **only after owner approves installation**
- [ ] Benchmark script `bench/` + report per `local-ai-plan.md` §9

### M6 — Hardening
- [ ] Audit trail UI (AI suggestions, approvals, plan changes)
- [ ] Data export (JSON/CSV), memory management UI, delete-everything flow
- [ ] Accessibility pass (AA contrast, screen-reader on review flow, Dynamic Type, reduced motion)
- [ ] Performance: cold start, capture flow <90 s, Space open <1 s

## Verification checklist (definition of done per milestone)

- [ ] Domain logic ≥ 90% unit-test coverage; property tests on allocation invariants (allocations sum to net pay)
- [ ] Zero `number`-typed currency anywhere (lint rule)
- [ ] Mock-mode E2E: fresh install → seeded demo → capture synthetic stub → confirm → plan renders
- [ ] No secrets/keys/PII in repo, logs, or screenshots
- [ ] Icon/logo/assets from `asset-prompts.md` only; WebP/AVIF optimized; alt text present

## Open questions for the owner (ask before relevant milestone)

1. Exact GPU model + VRAM (run `nvidia-smi`) → confirms local model tier (M5)
2. iOS-first, Android-first, or simultaneous? (M0)
3. Cloud AI vendor account/keys available? (M5)
4. Pricing model preference — affects paywall scaffolding (M6)
