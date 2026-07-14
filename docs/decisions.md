# Kova — Decision Log

Each entry: decision, alternatives considered, why this fits Kova. Research-phase decisions; revisit tags mark what the build phase should re-verify.

---

## D1 — Platform: React Native + Expo (managed workflow)

**Alternatives:** native Swift/Kotlin (two codebases), Flutter, PWA.
**Why:** solo/small-team velocity with one codebase; Expo is the officially recommended RN path and covers Kova's native needs without ejecting — `expo-sqlite` supports **SQLCipher (AES-256 encrypted DB)** via config plugin, `expo-secure-store` puts the DB key in Keychain/Android EncryptedSharedPreferences, `expo-local-authentication` gives Face ID/fingerprint. Native would win only for proprietary security SDKs Kova doesn't need. PWA fails quick-capture and camera-quality requirements.
**Revisit:** if OCR needs a heavy native lib without a maintained Expo config plugin.

## D2 — Budget unit: the paycheck, not the month

**Alternatives:** monthly zero-based (YNAB model), rolling 30-day, plain envelope.
**Why:** paycheck planning is the most-praised paid feature in EveryDollar and the core workaround culture in YNAB; no major app makes the paycheck the *primary* object. This is Kova's wedge.
**Risk:** power users may still expect monthly rollups — provide a monthly summary view, but planning stays per-check.

## D3 — Data: local-first, encrypted SQLite, no bank linking

**Alternatives:** cloud-first Postgres + Plaid; hybrid sync-first.
**Why:** privacy is the brand promise; the 2026 privacy-first finance-app wave (local-only trackers with no aggregators) validates demand. SQLCipher + Keychain-held key means data at rest is unreadable even off-device. Optional encrypted backup/export is user-triggered.
**Cost:** no automatic transactions — mitigated by making paystub capture + manual entry genuinely fast (D5, D7).

## D4 — OCR: dedicated OCR pipeline primary, VLM secondary

**Alternatives:** VLM-only extraction; cloud document-AI only; Tesseract-only.
**Why:** deterministic OCR with positional data gives field-level confidence + bounding boxes for the review UI; industry HITL practice ties every value to its source location. A vision LLM cross-checks totals and catches layout weirdness but is never the sole source of truth (per instructions: OCR and financial figures must not depend entirely on a general-purpose LLM). Cross-field validation (gross − deductions ≈ net) runs deterministically.
**Build-phase choice:** evaluate on-device OCR (Apple Vision framework / ML Kit — free, private, on-device) vs. cloud document AI; start with on-device since it matches the privacy promise. **Revisit with benchmark data.**

## D5 — Review UX: confidence-first, human-in-the-loop as a feature

**Alternatives:** silent auto-save with undo; full manual entry.
**Why:** field-level confidence with ~90% threshold on critical money fields, amber flagging, tap-to-locate on the source image, and one-tap correction is converged industry best practice and turns OCR imperfection into a trust-building moment instead of a failure state. Nothing persists without explicit confirmation.

## D6 — Financial math: deterministic TypeScript only

**Alternatives:** LLM-assisted calculations.
**Why:** money math, allocation, date forecasting, and tax estimation must be reproducible, testable, and auditable. Integer-cents arithmetic (no floats). AI is limited to language: explanation, classification, categorization suggestions, note linking — always schema-validated, always user-confirmed. Tax estimates displayed with a clear "estimate, not tax advice" label.

## D7 — Kova Space: scoped quick-capture notes, not a PKM

**Alternatives:** full Markdown vault (Obsidian-style), no notes at all.
**Why:** Obsidian mobile's documented pain — 10–20 s cold starts on large vaults, sync conflicts (worst on iCloud), broken mobile image handling, ~30% plugin gap — comes from vault-scale ambition. Kova Space inverts it: instant open (<1 s), implicit save, organize-later, local embedding search (nomic-embed-text) instead of manual linking. Money-scoped, so the corpus stays small and fast.

## D8 — AI runtime: Ollama local (opt-in) + Claude cloud + mock

**Alternatives:** LM Studio, llama.cpp direct, cloud-only, local-only.
**Why:** Ollama = native Windows service, auto NVIDIA/CUDA detection, decoder-level JSON-schema enforcement (`format` field), tool calling, OpenAI-compatible API, MIT license. Models: Qwen3 8B (chat/tools), Qwen2.5-VL 7B (vision verify), nomic-embed-text (embeddings) — all Apache 2.0, all fit 8–12 GB VRAM quantized. Cloud (Claude) remains the quality default; honest trade-off documented in `local-ai-plan.md` §5–6. Mock provider makes the app fully usable with zero keys/models.
**Guardrail:** no install without explicit owner approval; local mode never required.

## D9 — Dark UI: near-black graphite base, not pure #000

**Alternatives:** pure black OLED theme; dual light/dark at launch.
**Why:** pure black destroys surface-lightening elevation and produces OLED text halos; `#0B0C0E` base with lightened raised surfaces keeps premium depth and most battery benefit. Off-white text (`#E8EAED`) avoids contrast vibration; AA contrast enforced. Dark-only v1 keeps the identity tight; light mode is a v2 question.

## D10 — Brand signals: mint = confirmed money, amber = attention, never shame-red

**Alternatives:** conventional green/red gain-loss coding.
**Why:** "nonjudgmental" is a brand requirement; red-coded overspending is the shame pattern users cite when abandoning budgeting apps. Muted terracotta is reserved for true system errors. All signals icon+label paired (never color-only) for accessibility.

---

# Build-phase decisions (2026-07-13, MVP implementation)

## D11 — MVP platform: mobile-first web PWA (Vite + React), not Expo RN yet

**Alternatives:** follow D1 (Expo RN) immediately.
**Why:** the build brief's requirements are web-native (CSS variables, semantic HTML, keyboard
focus, desktop side-nav translation); a web PWA demos instantly on the dev machine with no
emulator tooling; and `src/domain`, `src/data` schema, `src/ai`, `src/ocr` are framework-free so
the native port replaces only the view layer. D1 remains the production-mobile path.
**Owner-approved** in the implementation plan.

## D12 — Nav: 5 tabs (Today · Plan · Goals · Space · Chat) + center FAB

Supersedes the research docs' 4-tab layout; the newer build brief wins. Settings via the Today
header; Memory Center via Settings/chat.

## D13 — Persistence: Dexie/IndexedDB, owner-scoped, unencrypted-at-rest for the synthetic MVP

Every row carries `userId` (RLS-shaped). Encryption gap documented in
`security-and-privacy.md`; acceptable only while all data is synthetic. Production: SQLCipher
(native) or OPFS+WebCrypto (web).

## D14 — Currency/region: USD-only; tax adapter ships only the fictional "Illustria" region

Real-region tax data requires verified sources + legal review; a deliberately fictional adapter
demonstrates the UX without compliance claims. Paystub withholding always supersedes estimates.

## D15 — Even the mock provider's output is schema-validated

The deterministic MockProvider flows through the same zod → business-rule → approval → audit
pipeline a real model would, so the safety pipeline is exercised (and tested with hostile
payloads) before any real provider exists.

## D16 — Scenario browsing is pure; applying is a store action

`compareScenarios()` never mutates. "Use this plan" opens an approval sheet and writes an audit
entry. Same pattern for chat actions and note→goal conversion.

---

## Five highest-risk assumptions

1. **OCR accuracy on real paystub diversity.** Synthetic benchmarks ≠ 500 payroll-provider layouts, crumpled photos, poor light. *Mitigate:* review UX absorbs errors; benchmark early with varied synthetic set; track acceptance rate from day one.
2. **Users will photograph paystubs instead of demanding bank sync.** The capture habit is the product's heartbeat. *Mitigate:* <90 s capture-to-planned flow; paycheck-date reminders; manual entry as an equally polished path.
3. **Local AI quality/reliability on typical user hardware.** 8B models underperform frontier cloud on reasoning; user PCs vary wildly; mobile can't run Ollama at all (LAN-companion model adds friction). *Mitigate:* cloud default, local opt-in, mock fallback, honest Settings labeling.
4. **Paycheck-unit budgeting is a big enough wedge.** YNAB/EveryDollar could bolt on better paycheck views faster than Kova builds trust. *Mitigate:* privacy + paycheck OCR combo is the moat, not the calendar view alone.
5. **Premium pricing sustains a no-ads, no-data-sale business.** Privacy-first excludes the usual monetization escape hatches; subscription fatigue is real. *Mitigate:* one-time-purchase or modest subscription tests; keep infra costs near zero via local-first architecture.
