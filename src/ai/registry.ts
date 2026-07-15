/**
 * Provider selection with graceful, USER-VISIBLE fallback — never silent
 * substitution. Env flags gate cloud/local; mock is always available.
 */
import { MockProvider } from "./mockProvider";
import { OllamaProvider } from "./ollamaProvider";
import { CloudProviderStub, OllamaProviderStub, type AIProvider, type ProviderKind } from "./provider";

export interface EnvConfig {
  defaultProvider: ProviderKind;
  cloudEnabled: boolean;
  cloudBaseUrl: string | undefined;
  ollamaEnabled: boolean;
  ollamaBaseUrl: string | undefined;
  ollamaModel: string;
}

export function readEnvConfig(): EnvConfig {
  const env = import.meta.env;
  const requested = (env.VITE_AI_PROVIDER ?? "mock") as string;
  const defaultProvider: ProviderKind = ["mock", "cloud", "ollama"].includes(requested)
    ? (requested as ProviderKind)
    : "mock";
  return {
    defaultProvider,
    cloudEnabled: env.VITE_FEATURE_CLOUD === "true",
    cloudBaseUrl: env.VITE_CLOUD_AI_BASE_URL || undefined,
    ollamaEnabled: env.VITE_FEATURE_OLLAMA === "true",
    ollamaBaseUrl: env.VITE_OLLAMA_BASE_URL || undefined,
    ollamaModel: env.VITE_OLLAMA_MODEL || "qwen3:8b",
  };
}

const mock = new MockProvider();

export function getProvider(kind: ProviderKind, env: EnvConfig = readEnvConfig()): AIProvider {
  switch (kind) {
    case "cloud":
      return new CloudProviderStub(env.cloudBaseUrl);
    case "ollama":
      return env.ollamaEnabled
        ? new OllamaProvider({
            baseUrl: env.ollamaBaseUrl ?? "http://localhost:11434",
            model: env.ollamaModel,
          })
        : new OllamaProviderStub(env.ollamaBaseUrl, false);
    case "mock":
      return mock;
  }
}

export function allProviders(env: EnvConfig = readEnvConfig()): AIProvider[] {
  return [mock, getProvider("cloud", env), getProvider("ollama", env)];
}

/** Active provider with health check; falls back to mock with an explanation. */
export async function resolveActiveProvider(
  preferred: ProviderKind,
): Promise<{ provider: AIProvider; fallbackNotice: string | null }> {
  const candidate = getProvider(preferred);
  const health = await candidate.healthCheck();
  if (health.ok) return { provider: candidate, fallbackNotice: null };
  if (candidate.kind === "mock") return { provider: candidate, fallbackNotice: null };
  return {
    provider: mock,
    fallbackNotice: `${candidate.label} isn't available (${health.detail}) — using Demo Mode instead.`,
  };
}
