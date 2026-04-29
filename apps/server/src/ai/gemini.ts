import type { AIProvider } from "./providers.js";
import { AppError } from "../utils/errors.js";

export class GeminiProvider implements AIProvider {
  constructor(private apiKey: string) {}
  async generateText(params: Parameters<AIProvider["generateText"]>[0]) {
    const model = normalizeGeminiModel(params.model);
    const prompt = params.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const urlV1Beta = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    console.log(`[Gemini] Requesting v1beta: ${model}`);
    let response = await fetch(urlV1Beta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: params.temperature ?? 0.2, maxOutputTokens: params.maxTokens ?? 1200, ...(params.responseFormat === "json" ? { responseMimeType: "application/json" } : {}) } })
    });

    if (response.status === 404) {
      const urlV1 = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
      console.log(`[Gemini] v1beta 404, retrying v1: ${model}`);
      response = await fetch(urlV1, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: params.temperature ?? 0.2, maxOutputTokens: params.maxTokens ?? 1200, ...(params.responseFormat === "json" ? { responseMimeType: "application/json" } : {}) } })
      });
    }

    console.log(`[Gemini] Response status: ${response.status} for ${model}`);

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      console.log(`[Gemini] Error body:`, JSON.stringify(body));
      const message = response.status === 404
        ? "Gemini model or endpoint not found. Try Auto, gemini-1.5-flash, or check whether your API key has Gemini API access."
        : response.status === 401 || response.status === 403
          ? "Invalid API key or provider authorization failed."
        : `Gemini request failed. Check your API key/model in Secrets.`;
      throw new AppError("PROVIDER_REQUEST_FAILED", message, response.status === 404 || response.status === 401 || response.status === 403 ? 400 : 502, {
        provider: "gemini",
        model,
        status: response.status,
        statusCode: response.status,
        providerMessage: safeExcerpt(body.error?.message)
      });
    }
    const json = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { totalTokenCount?: number } };
    return { text: json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "", tokensUsed: json.usageMetadata?.totalTokenCount };
  }
}

export function normalizeGeminiModel(model: string) {
  return model.replace(/^models\//, "").trim();
}

function safeExcerpt(value: string | undefined) {
  return value ? value.slice(0, 500) : undefined;
}
