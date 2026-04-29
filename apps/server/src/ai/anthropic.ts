import type { AIProvider } from "./providers.js";
import { AppError } from "../utils/errors.js";

export class AnthropicProvider implements AIProvider {
  constructor(private apiKey: string) {}
  async generateText(params: Parameters<AIProvider["generateText"]>[0]) {
    const system = params.messages.find((m) => m.role === "system")?.content ?? "";
    const messages = params.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: params.model, max_tokens: params.maxTokens ?? 1200, temperature: params.temperature ?? 0.2, system, messages })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new AppError("PROVIDER_REQUEST_FAILED", providerErrorMessage("Anthropic", response.status), response.status === 401 || response.status === 403 ? 400 : 502, {
        provider: "anthropic",
        model: params.model,
        status: response.status,
        providerMessage: body.error?.message
      });
    }
    const json = (await response.json()) as { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    return { text: json.content?.map((c) => c.text ?? "").join("") ?? "", tokensUsed: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0) };
  }
}

function providerErrorMessage(provider: string, status: number) {
  if (status === 401 || status === 403) return "Invalid API key or provider authorization failed.";
  return `${provider} request failed. Check your API key/model in Secrets.`;
}
