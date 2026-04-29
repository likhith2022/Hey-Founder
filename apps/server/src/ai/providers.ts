import { getDb, getSetting } from "../db/index.js";
import { decryptSecret } from "../vault/localVault.js";
import { AppError } from "../utils/errors.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { OpenRouterProvider } from "./openrouter.js";
import { OllamaProvider } from "./ollama.js";
import { MockProvider } from "./mock.js";

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AIProvider {
  generateText(params: { messages: AIMessage[]; model: string; temperature?: number; maxTokens?: number; responseFormat?: "text" | "json" }): Promise<{ text: string; tokensUsed?: number; costEstimate?: number }>;
  streamText?(params: { messages: AIMessage[]; model: string; temperature?: number; maxTokens?: number; onToken: (token: string) => void }): Promise<{ text: string; tokensUsed?: number; costEstimate?: number }>;
}

export function getSecretValue(provider: string): string {
  const row = getDb().prepare("SELECT encrypted_value, iv, auth_tag FROM secrets WHERE provider = ? OR name = ? ORDER BY updated_at DESC LIMIT 1").get(provider, provider) as { encrypted_value: string; iv: string; auth_tag: string } | undefined;
  if (!row) throw new AppError("MISSING_PROVIDER_KEY", `Add your ${provider} API key or local config in Secrets before running this agent.`, 400);
  return decryptSecret(row);
}

export function isProviderAvailable(provider: string) {
  const normalized = provider.toLowerCase();
  if (normalized === "mock") return process.env.NODE_ENV === "test" || process.env.DEMO_MODE === "true" || Boolean(getSetting("demo_mode"));
  const row = getDb().prepare("SELECT id FROM secrets WHERE provider = ? OR name = ? LIMIT 1").get(normalized, normalized);
  return Boolean(row);
}

export function createProvider(provider: string | null | undefined): AIProvider {
  switch ((provider ?? "openai").toLowerCase()) {
    case "openai":
      return new OpenAIProvider(getSecretValue("openai"));
    case "anthropic":
      return new AnthropicProvider(getSecretValue("anthropic"));
    case "gemini":
      return new GeminiProvider(getSecretValue("gemini"));
    case "openrouter":
      return new OpenRouterProvider(getSecretValue("openrouter"));
    case "ollama":
      return new OllamaProvider(getSecretValue("ollama"));
    case "mock":
      if (process.env.NODE_ENV !== "test" && process.env.DEMO_MODE !== "true" && !getSetting("demo_mode")) throw new AppError("UNKNOWN_PROVIDER", "Mock provider is only available in test/demo mode", 400);
      return new MockProvider();
    default:
      throw new AppError("UNKNOWN_PROVIDER", "Selected model provider is not supported", 400);
  }
}
