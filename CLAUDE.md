# Kova — permanent rules for Claude Code

## Non-negotiable trust rules
- All money math, allocation, forecasting, tax estimation, and date math is **deterministic
  TypeScript in `src/domain`** — never an LLM, never duplicated in components.
- Currency is **integer cents** behind the branded `Cents` type from `src/domain/money.ts`.
  Never use floats, `parseFloat`, or raw number arithmetic on money outside `money.ts`.
- AI output is untrusted input: zod schema (`src/ai/schemas.ts`) → business-rule validation
  (`src/ai/actions.ts`) → **explicit user approval UI** → audit log (`ai_action_audit_logs`).
  AI never mutates financial records, saves memories, or changes plans directly.
- Mandatory provenance labels on financial values: "From paystub" / "You entered this" /
  "Estimated" / "Suggested by Kova" / "Needs review" (see `classifyPaycheckFieldSource`).
- Every financial surface renders the `<Disclaimer />` footer.
- Tax figures always labeled illustrative estimates; paystub withholding outranks estimates;
  only the fictional "Illustria" adapter ships until real data passes legal review.
- Synthetic data ONLY — never real paystubs, names, or amounts in code, tests, seeds, or docs.
- Nothing installs (Ollama, models, new deps, system packages) without explicit owner approval.

## Conventions
- Stack: Vite + React 19 + TS strict; Zustand store (`src/store/appStore.ts`) hydrated from
  Dexie (`src/data/db.ts`); every table row carries `userId` (single `local-owner` in MVP).
- Screens live in `src/app/<screen>/`, one CSS file next to each screen; primitives in
  `src/components`; design tokens ONLY via CSS variables in `src/theme/tokens.css`.
- Semantic color: mint = progress/safe only, amber = attention (never shame), terracotta = true
  errors only. Icons + labels together, never color alone. Respect `prefers-reduced-motion`.
- Voice: calm, precise, nonjudgmental. No hype, no shame, no exclamation marks in money contexts.
- Tests colocated as `*.test.ts`; run `npm test`, `npm run typecheck`, `npm run lint` before
  declaring work done. Domain changes need tests (property tests for allocation invariants).

## Environment note
- Node.js lives at `%USERPROFILE%\tools\nodejs` (portable). In non-interactive shells prepend it
  to PATH: `$env:Path = "$env:USERPROFILE\tools\nodejs;$env:Path"`.
