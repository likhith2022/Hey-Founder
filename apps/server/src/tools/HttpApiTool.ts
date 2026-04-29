import type { BaseTool } from "./BaseTool.js";
import { AppError } from "../utils/errors.js";

export class HttpApiTool implements BaseTool {
  name = "http_api";
  riskLevel = "high" as const;
  async execute(input: Record<string, unknown>) {
    const method = String(input.method ?? "GET").toUpperCase();
    if (method !== "GET") throw new AppError("APPROVAL_REQUIRED", "HTTP mutations require approval", 403);
    const response = await fetch(String(input.url), { method, signal: AbortSignal.timeout(8000) });
    return { output: { status: response.status, body: (await response.text()).slice(0, 50000) } };
  }
}
