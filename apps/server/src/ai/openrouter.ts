import type { AIProvider } from "./providers.js";
import { AppError } from "../utils/errors.js";

export class OpenRouterProvider implements AIProvider {
  constructor(private apiKey: string) {}
  async generateText(params: Parameters<AIProvider["generateText"]>[0]) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "http://localhost:7878", "X-Title": "AI Company OS" },
      body: JSON.stringify({ model: params.model, messages: params.messages, temperature: params.temperature ?? 0.2, max_tokens: params.maxTokens ?? 1200 })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new AppError("PROVIDER_REQUEST_FAILED", providerErrorMessage("OpenRouter", response.status), response.status === 401 || response.status === 403 ? 400 : 502, {
        provider: "openrouter",
        model: params.model,
        status: response.status,
        providerMessage: body.error?.message
      });
    }
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { total_tokens?: number } };
    return { text: json.choices?.[0]?.message?.content ?? "", tokensUsed: json.usage?.total_tokens };
  }
}

function providerErrorMessage(provider: string, status: number) {
  if (status === 401 || status === 403) return "Invalid API key or provider authorization failed.";
  return `${provider} request failed. Check your API key/model in Secrets.`;
}
