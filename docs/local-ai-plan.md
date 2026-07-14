# Kova — Local AI Plan

**Status: research only. Nothing installed, no models downloaded, no commands run.** Installation happens only after explicit approval (see §8).

## 1. Hardware context

Owner's machine: **Windows PC with a dedicated NVIDIA GPU** (exact model/VRAM not yet inspected — first task after approval is to run the inspection commands in §8 and confirm the tier).

Ollama requirements (2026): NVIDIA compute capability 5.0+ (GTX 900+), driver 550+; native Windows installer (no WSL/Docker needed); automatic CUDA detection. Minimum 8 GB system RAM + 10 GB disk. Sweet spot for this use case: **8–12 GB VRAM runs 7–8B models with Q4_K_M quantization at 40+ tok/s** — fully adequate for Kova's workloads.

| VRAM tier | Realistic models | Verdict for Kova |
|---|---|---|
| 4–6 GB | 3–4B quantized | Chat OK, vision marginal; cloud fallback essential |
| **8–12 GB** | 7–8B Q4 (text + vision) | **Target tier — full local mode viable** |
| 16–24 GB | 14–32B | Better reasoning; overkill for v1 |

## 2. Important framing: what AI is NOT allowed to do

- **Financial math, allocation, forecasting, tax estimation = deterministic TypeScript.** Never an LLM.
- **Primary OCR = dedicated OCR pipeline**, not a vision LLM. The VLM is a *secondary verification/fallback* layer.
- AI output is untrusted input: strict JSON schema, server/app-side validation, user confirmation before anything is stored. AI never writes financial records directly.

## 3. Recommended runtime: Ollama

Chosen over LM Studio / llama.cpp-direct because: native Windows service with automatic NVIDIA detection; **structured outputs via the `format` field enforce a JSON schema at the decoder level** (not prompt-hoping) — exactly what Kova's "strict JSON for anything touching money" rule needs; tool-calling support; OpenAI-compatible API so the `OllamaProvider` and `CloudProvider` share one adapter shape; MIT-licensed and free. LM Studio is a fine GUI but weaker as an embedded app dependency; raw llama.cpp adds maintenance burden with no capability gain for this use case.

## 4. Recommended models (specialized, not one giant model)

| Role | Model | Size (Q4) | License | Why |
|---|---|---|---|---|
| Chat + tool calling + structured actions | **Qwen3 8B** | ~5 GB | Apache 2.0 | Best-in-class small-model tool calling and JSON reliability in 2026 evaluations; clean commercial license |
| Vision — paystub secondary verification | **Qwen2.5-VL 7B** (or current Qwen-VL 7B tag) | ~6 GB | Apache 2.0 | Small VLMs demonstrably extract payslip fields incl. deductions; 7B is the floor — 2B-class models drift into summarizing complex documents |
| Embeddings — Kova Space private search | **nomic-embed-text** | ~0.3 GB | Apache 2.0 | Tiny, fast, standard choice for local RAG |

Notes: models below ~7B without explicit tool-call training emit malformed calls at meaningful rates — don't ship smaller than 7–8B for the action model. Only one model needs to be resident at a time (Ollama loads/unloads on demand), so 8 GB VRAM suffices.

## 5. Cloud fallback (and default for quality)

**Anthropic Claude (Haiku for classification/extraction verification, Sonnet for chat/explanations)** via `CloudProvider` with env-var key. Honest trade-off, per instructions: frontier cloud models remain more accurate for nuanced reasoning and messy documents; local wins on privacy and marginal cost. Kova therefore ships three modes — **Kova Cloud** (best quality), **Private Local** (Ollama), **Demo Mode** (mock) — user-selectable in Settings → Intelligence, with the app fully functional in mock mode with seeded synthetic data and no keys.

## 6. Realistic limitations (do not oversell local mode)

- 8B-class chat is noticeably weaker than frontier cloud on multi-step reasoning and long explanations.
- VLM verification of a blurry phone photo will produce more low-confidence fields; the review screen absorbs this by design.
- First-token latency after model cold-load can be several seconds; keep-alive mitigates.
- Local mode is desktop/companion-server territory: **phones do not run Ollama.** Local mode in the mobile app means "talk to Ollama on the user's own PC over LAN" — this must be labeled clearly ("Runs on your computer, on your network"), and is a v1.1 feature. v1 mobile ships Cloud + Demo; on-device mobile inference (e.g., 3B via llama.cpp/MLC) is a research item, not a commitment.

## 7. Provider abstraction (build-phase spec)

```ts
type ProviderKind = "cloud" | "ollama" | "mock";
interface AIProvider {
  kind: ProviderKind;
  capabilities: { chat: boolean; structured_output: boolean; vision: boolean; embeddings: boolean; tool_calling: boolean };
  model: { name: string; tag: string; contextSize: number; local: boolean };
  healthCheck(): Promise<HealthStatus>;
  chat(req: ChatRequest): Promise<ChatResponse>;
  extractStructured<T>(req: { schema: JsonSchema; input: string | ImageRef }): Promise<Validated<T>>;
  embed(texts: string[]): Promise<number[][]>;
}
```

Graceful fallback chain: selected provider → health-check fail → user-visible notice → offer cloud or demo. Never silent substitution. Every AI suggestion that touches financial data goes through: schema validation → app-side rule validation → user confirmation → audit-log entry.

## 8. Exact commands (run ONLY after approval)

```powershell
# 0. Inspect hardware first
nvidia-smi                          # GPU model, VRAM, driver
systeminfo | findstr /C:"Total Physical Memory"
node --version; python --version; docker --version

# 1. Install Ollama (native Windows installer)
winget install Ollama.Ollama

# 2. Pull models (sizes: ~5 GB, ~6 GB, ~0.3 GB — confirm disk first)
ollama pull qwen3:8b
ollama pull qwen2.5vl:7b
ollama pull nomic-embed-text

# 3. Verify structured outputs
curl http://localhost:11434/api/chat -d '{"model":"qwen3:8b","format":{...schema...},"messages":[...]}'
```

## 9. Benchmark plan (synthetic data only)

Build `bench/` with 15–20 synthetic paystubs (varied layouts: ADP-like, Gusto-like, handwritten-adjacent, blurry photo) and 20 scripted Kova conversations. Score each provider (mock baseline, Ollama models, Claude): field-extraction accuracy, **correctly marking uncertainty** (calibration, not just accuracy), JSON schema validity rate, tool-call validity rate, explanation safety/quality (rubric), notes-linking accuracy, p50/p95 latency. Output: `bench/report.md` selecting default dev provider, recommended local option, cloud fallback, and confirming mock provider behavior.
