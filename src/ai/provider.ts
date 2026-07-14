/**
 * AIProvider abstraction — mock | cloud | ollama.
 *
 * Rules enforced by the surrounding pipeline (see actions.ts):
 * - every action-shaped output is zod-validated before it reaches the UI
 * - no provider ever mutates financial records; providers only PROPOSE
 * - explicit user approval + audit log precede every store mutation
 */
import type { KovaContext } from "./schemas";

export type ProviderKind = "mock" | "cloud" | "ollama";

export interface ProviderCapabilities {
  chat: boolean;
  structuredOutput: boolean;
  intentClassification: boolean;
  noteOrganization: boolean;
  memoryProposal: boolean;
  embeddings: boolean;
  vision: boolean;
}

export interface HealthStatus {
  ok: boolean;
  detail: string;
}

export interface AIProvider {
  readonly kind: ProviderKind;
  readonly label: string;
  readonly modelName: string;
  readonly local: boolean;
  readonly capabilities: ProviderCapabilities;
  healthCheck(): Promise<HealthStatus>;
  /** Returns an UNVALIDATED reply envelope; callers must run it through validateChatReply. */
  chat(userText: string, context: KovaContext): Promise<unknown>;
  organizeNote(noteBody: string, context: KovaContext): Promise<unknown>;
}

/**
 * CloudProvider — configuration placeholder only in MVP.
 * Real calls require a server-side proxy so API keys never ship to the
 * browser, plus explicit owner approval. See docs/ai-provider-architecture.md.
 */
export class CloudProviderStub implements AIProvider {
  readonly kind = "cloud" as const;
  readonly label = "Kova Cloud";
  readonly modelName = "not configured";
  readonly local = false;
  readonly capabilities: ProviderCapabilities = {
    chat: false,
    structuredOutput: false,
    intentClassification: false,
    noteOrganization: false,
    memoryProposal: false,
    embeddings: false,
    vision: false,
  };
  constructor(private baseUrl: string | undefined) {}
  async healthCheck(): Promise<HealthStatus> {
    if (!this.baseUrl) {
      return { ok: false, detail: "No cloud endpoint configured. Kova stays in demo mode." };
    }
    return { ok: false, detail: "Cloud provider is a placeholder in this build." };
  }
  async chat(): Promise<unknown> {
    throw new Error("Cloud provider not available in this build");
  }
  async organizeNote(): Promise<unknown> {
    throw new Error("Cloud provider not available in this build");
  }
}

/**
 * OllamaProvider — feature-flagged stub. Never installed or contacted unless
 * the owner enabled the flag AND approved the local install separately.
 */
export class OllamaProviderStub implements AIProvider {
  readonly kind = "ollama" as const;
  readonly label = "Private Local (Ollama)";
  readonly modelName = "not installed";
  readonly local = true;
  readonly capabilities: ProviderCapabilities = {
    chat: false,
    structuredOutput: false,
    intentClassification: false,
    noteOrganization: false,
    memoryProposal: false,
    embeddings: false,
    vision: false,
  };
  constructor(private baseUrl: string | undefined, private enabled: boolean) {}
  async healthCheck(): Promise<HealthStatus> {
    if (!this.enabled) {
      return { ok: false, detail: "Local AI is feature-flagged off. Nothing runs on this machine." };
    }
    if (!this.baseUrl) return { ok: false, detail: "No Ollama URL configured." };
    return { ok: false, detail: "Ollama support is a stub in this build — install requires owner approval." };
  }
  async chat(): Promise<unknown> {
    throw new Error("Ollama provider not available in this build");
  }
  async organizeNote(): Promise<unknown> {
    throw new Error("Ollama provider not available in this build");
  }
}
