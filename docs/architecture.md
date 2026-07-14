# Kova — Architecture

## Layers

```
┌─────────────────────────────────────────────────────┐
│ src/app — screens (Today, Plan, Goals, Space, Chat, │
│ Scan, Onboarding, Memory, Settings) + AppShell nav  │
├─────────────────────────────────────────────────────┤
│ src/components — primitives (AmountDisplay,         │
│ SourceBadge, AllocationLanes, Sheet, ProgressBar…)  │
├──────────────┬──────────────────────────────────────┤
│ src/store —  │ src/ai — AIProvider interface,       │
│ Zustand app  │ zod schemas, validation pipeline,    │
│ store, write-│ MockProvider, cloud/ollama stubs     │
│ through to DB├──────────────────────────────────────┤
│ + derived    │ src/ocr — PaystubExtractor interface,│
│ selectors    │ MockPaystubExtractor fixtures        │
├──────────────┴──────────────────────────────────────┤
│ src/domain — ★ deterministic financial engine.      │
│ Pure TS, zero framework imports, fully unit-tested. │
├─────────────────────────────────────────────────────┤
│ src/data — schema types, Dexie (IndexedDB), seed    │
└─────────────────────────────────────────────────────┘
```

**Dependency rule:** `domain` imports nothing above it. `data` imports `domain` types only.
`ai`/`ocr` import `domain` + `data` types. Screens never compute money — they call domain
functions through store selectors.

## Data flow: the core loop

1. **Capture** — `ScanScreen` runs `MockPaystubExtractor.extract()` → normalized
   `ExtractedField`s (value, source, confidence, rawLabel, method, requiresReview).
2. **Review** — "We found this": every field editable; `reconcilePaycheck()` gates the confirm
   CTA (gross − deductions ≈ net within $1.00); flagged fields must be visited. Nothing persists
   before confirm.
3. **Plan** — `store.confirmPaycheck()` calls `generateAllocationPlan()` (bills → buffer → goals
   → future fund → flexible), runs `validateAllocationPlan()`, persists paycheck + plan + goal
   contributions in one transaction, writes an audit entry.
4. **Live** — `selectSafeToSpend()` recomputes flexible-minus-expenses on every render from
   stored records; nothing derived is cached stale.
5. **Reflect** — Kova Space notes; AI suggestions (organize / turn into plan) validate through
   `src/ai/actions.ts` and only apply after explicit approval.

## State

- **Zustand store** (`src/store/appStore.ts`) is the in-memory source of truth, hydrated from
  Dexie at boot; every mutation writes through to IndexedDB then re-hydrates.
- Derived values (safe-to-spend, forecasts, insights) are **selector functions** calling the
  domain engine — they are never persisted, so they can't drift from the records.

## Routing

React Router: `/onboarding` (public) → everything else behind `RequireOnboarding`.
Tabs: `/today`, `/plan`, `/goals`, `/space`, `/chat`; secondary: `/scan`, `/memory`, `/settings`.
Mobile: bottom tab bar + expanding center FAB (dark glass). Desktop ≥900px: left side-nav with the
same hierarchy and quick actions.

## Motion

`motion` (Framer Motion) drives the required moments: paycheck split (staggered lanes on
confirm), scenario/plan count changes, sheet transitions, chat entrance. Every animated component
checks `useReducedMotion()`; CSS transitions also collapse under `prefers-reduced-motion`.

## Porting path (mobile-native)

`domain`, `data/schema`, `ai`, and `ocr` are framework-free by construction. A React Native port
replaces `src/app` + `src/components` + Dexie (→ expo-sqlite/SQLCipher); decision log D1 stays
honored by that path.
