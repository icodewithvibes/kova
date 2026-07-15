# Kova — AI Provider Architecture

## Principles

1. **AI explains and proposes; deterministic code decides and calculates.**
2. All model output is untrusted input — even the deterministic mock goes through validation, so
   the pipeline is proven before any real model is attached.
3. No provider ever mutates data. Mutations happen only in `src/store/appStore.ts` methods,
   triggered by an explicit user tap, and always audit-logged.
4. No silent fallback: if the selected provider is down, the user sees which provider failed and
   that Demo Mode answered instead.

## The interface (`src/ai/provider.ts`)

```ts
interface AIProvider {
  kind: "mock" | "cloud" | "ollama";
  label; modelName; local; capabilities;
  healthCheck(): Promise<HealthStatus>;
  chat(userText, context: KovaContext): Promise<unknown>;      // UNVALIDATED
  organizeNote(noteBody, context: KovaContext): Promise<unknown>;
}
```

`KovaContext` is a **structured summary** (plan, goals, memories, logged expenses, pay schedule)
— never raw documents, never paystub images.

## Validation pipeline (`src/ai/schemas.ts` + `src/ai/actions.ts`)

```
provider output (unknown)
  → zod .strict() parse           — unknown fields rejected, amounts are bounded integer
                                     cents in USD, dates ISO, ≤4 actions, length caps
  → business rules                — e.g. spend cards can't show negative "after"
  → ok?  render reply/cards/action buttons
  → fail? safe fallback reply ("Your plan hasn't changed") + rejected_invalid audit entry
```

Action execution (`log_expense`, `create_goal`, `adjust_goal`, `propose_memory`) additionally
requires a confirmation sheet ("Yes, do it") before the store method runs; the approval and the
outcome land in `ai_action_audit_logs`.

## Providers

- **MockProvider** (shipping): deterministic intent patterns over KovaContext; every number in a
  reply comes from `src/domain` functions. Powers the full demo with zero keys.
- **CloudProviderStub**: configuration surface only. Real cloud calls require a server-side proxy
  (keys must never ship to the browser) — `VITE_CLOUD_AI_BASE_URL` points at that proxy, gated by
  `VITE_FEATURE_CLOUD`. Intended vendor per decision D8: Anthropic Claude (Haiku for
  classification, Sonnet for chat).
- **OllamaProvider** (`src/ai/ollamaProvider.ts`, shipping — owner approved the install
  2026-07-14): real client over the Ollama HTTP API, gated by `VITE_FEATURE_OLLAMA`.
  Structured outputs use Ollama's decoder-level `format` schema derived from the SAME zod
  schemas via `toOllamaFormat()` — which strips `oneOf`→`anyOf`, `pattern`, and
  `minLength`/`maxLength` because llama.cpp's grammar compiler rejects them (verified against
  Ollama 0.32.0); zod still enforces those app-side. Model via `VITE_OLLAMA_MODEL`
  (default `qwen3:8b`, local). Models ending in `-cloud` execute on **Ollama Cloud**
  (free tier with usage limits) through the local daemon after the user runs `ollama signin` —
  Kova's requests are identical either way: structured summaries only, never documents.
  Hardware note: this machine's AMD RX 6600 XT is below Ollama's supported GPU line, so local
  inference is CPU-bound (~32 GB RAM handles 8B Q4); cloud models avoid that entirely.

## Memory rules

- A statement becomes memory ONLY via `memory_proposals` → visible approval (Memory Center or
  chat action). Passing statements are never auto-saved.
- Every memory shows statement, source, created/last-confirmed dates, edit and forget controls;
  forgetting is immediate and audit-logged.
- Memory can be disabled wholesale in Settings (`memoryConsent`), and consent is never
  preselected in onboarding.

## Settings → Intelligence (shipping)

Provider picker (Demo / Kova Cloud / Private Local), model name, local-vs-cloud label, live
connection status via `healthCheck()`, the "do images leave this device?" disclosure, and the
explicit fallback-behavior statement.
