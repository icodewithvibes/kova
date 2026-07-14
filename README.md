# Kova

**Every paycheck, already planned.**

Kova is a premium, privacy-first paycheck planning app for people with hourly, weekly, biweekly,
tipped, or irregular income. Scan or enter a paycheck, and Kova protects bills, buffer, and goals
first — then shows exactly what's safe to spend until the next payday.

This is the **mock-data MVP**: the entire product runs end-to-end with synthetic data, a
deterministic financial engine, a mock OCR extractor, and a deterministic demo AI provider.
No API keys, no accounts, no external services.

## Quick start

Requirements: Node.js 20+ (this machine has a portable install at `~/tools/nodejs`).

```bash
npm install
npm run dev        # → http://localhost:5173
```

On first launch you can either walk through onboarding or tap **"Explore with demo data instead"**
to load the synthetic persona (see `docs/demo-data.md`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 5173 |
| `npm test` | Full Vitest suite (domain engine, AI schemas, OCR fixtures) |
| `npm run typecheck` | Strict TypeScript project build check |
| `npm run lint` | ESLint over `src` |
| `npm run build` | Production build |

## The demo flow (90 seconds)

1. **Onboarding** → or "Explore with demo data instead"
2. **Today** — safe-to-spend hero, protected bills + goal, allocation lanes, one honest insight
3. **FAB → Scan paycheck** — pick the "Clear photo" synthetic stub → review the amber
   "Needs review" fields on **We found this** → Confirm → watch the paycheck split into lanes
4. **Plan** — scenario simulator (Conservative / Balanced / Faster goal); browsing never changes
   the live plan, applying requires approval
5. **Chat** — "Can I spend $80 tonight?" → answer, inline card, action buttons, "Based on" panel
6. **Space** — open the MacBook note → **Organize** → linked concepts + optional goal proposal
7. **Memory Center** (Settings → Memory) — every memory visible, editable, forgettable
8. **Settings** — provider status, audit trail, export, delete-everything

## Architecture in one paragraph

A mobile-first React PWA (Vite, strict TypeScript). All money math lives in `src/domain` — a
framework-free, fully unit-tested engine using integer cents; AI never calculates money. Data is
local-first (IndexedDB via Dexie), owner-scoped, exportable, and deletable. AI providers implement
one interface (`mock | cloud | ollama`); every action-shaped AI output is zod-validated, needs an
explicit user approval, and lands in an audit log. See `docs/architecture.md`.

## Docs

- `docs/architecture.md` — layers, data flow, directory map
- `docs/data-model.md` — entities, ownership, retention, indexes
- `docs/financial-calculation-rules.md` — the deterministic engine's contracts
- `docs/ai-provider-architecture.md` — provider interface, validation pipeline, approval flow
- `docs/security-and-privacy.md` — threat model and current-state honesty
- `docs/demo-data.md` — the synthetic persona and why its numbers reconcile
- `docs/decisions.md` — decision log (research phase + build phase)

> Kova is for planning only. Verify important payroll and tax information with your paystub,
> employer, or a qualified professional. All data in this repository is synthetic.
