export const supportedProviders = ["openai", "anthropic", "gemini", "openrouter", "ollama", "mock"] as const;
export type ProviderName = (typeof supportedProviders)[number];
export type ModelRole = "ceo" | "manager" | "worker" | "reviewer" | "default";

// These are editable presets and should remain configurable because provider model names change.
const autoModels: Record<string, Record<ModelRole, string>> = {
  openai: { ceo: "gpt-5.5", manager: "gpt-5.5-mini", worker: "gpt-5.5-mini", reviewer: "gpt-5.5", default: "gpt-5.5-mini" },
  anthropic: { ceo: "claude-opus-4-7", manager: "claude-sonnet-4-6", worker: "claude-haiku-4-5", reviewer: "claude-sonnet-4-6", default: "claude-sonnet-4-6" },
  gemini: { ceo: "gemini-3.1-pro", manager: "gemini-3-flash", worker: "gemini-3-flash", reviewer: "gemini-3.1-pro", default: "gemini-3-flash" },
  openrouter: { ceo: "openrouter/auto", manager: "openrouter/auto", worker: "openrouter/auto", reviewer: "openrouter/auto", default: "openrouter/auto" },
  ollama: { ceo: "qwen2.5", manager: "qwen2.5", worker: "llama3.2", reviewer: "qwen2.5", default: "llama3.2" },
  mock: { ceo: "software-company-builder", manager: "software-company-builder", worker: "software-company-builder", reviewer: "software-company-builder", default: "software-company-builder" }
};

export function resolveAutoModel(provider: string, role: string = "default") {
  const normalizedProvider = provider.toLowerCase();
  const normalizedRole = normalizeRole(role);
  return autoModels[normalizedProvider]?.[normalizedRole] ?? autoModels[normalizedProvider]?.default ?? "auto";
}

export function normalizeRole(role: string): ModelRole {
  if (role === "ceo" || role === "manager" || role === "worker" || role === "reviewer") return role;
  return "default";
}

