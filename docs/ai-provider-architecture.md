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
- **OllamaProviderStub**: gated by `VITE_FEATURE_OLLAMA` + owner-approved installation
  (commands live in `local-ai-plan.md` §8 and are NOT run by this build). Target models: Qwen3 8B
  (chat/tools), Qwen2.5-VL 7B (vision verify), nomic-embed-text (embeddings).

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
