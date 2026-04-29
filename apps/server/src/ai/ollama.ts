import type { AIProvider } from "./providers.js";
import { AppError } from "../utils/errors.js";

export class OllamaProvider implements AIProvider {
  constructor(private baseUrl: string) {}
  async generateText(params: Parameters<AIProvider["generateText"]>[0]) {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: params.model, messages: params.messages, stream: false, options: { temperature: params.temperature ?? 0.2, num_predict: params.maxTokens ?? 1200 } })
      });
    } catch {
      throw new AppError("PROVIDER_REQUEST_FAILED", "Ollama server is unreachable. Check the local base URL in Secrets.", 502, { provider: "ollama", model: params.model });
    }
    if (!response.ok) throw new AppError("PROVIDER_REQUEST_FAILED", "Ollama request failed. Check the base URL and local model name.", 502, { provider: "ollama", model: params.model, status: response.status });
    const json = (await response.json()) as { message?: { content?: string }; eval_count?: number; prompt_eval_count?: number };
    return { text: json.message?.content ?? "", tokensUsed: (json.eval_count ?? 0) + (json.prompt_eval_count ?? 0) };
  }
}
