import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { BaseTool } from "./BaseTool.js";
import { AppError } from "../utils/errors.js";

export class WebResearchTool implements BaseTool {
  name = "web_research";
  riskLevel = "low" as const;
  async execute(input: Record<string, unknown>) {
    let url: URL;
    try {
      url = new URL(String(input.url ?? ""));
    } catch {
      throw new AppError("INVALID_URL", `The provided URL '${input.url}' is not a valid URL. Include http:// or https://`, 400);
    }
    if (!["http:", "https:"].includes(url.protocol)) throw new AppError("INVALID_URL", "Only HTTP and HTTPS URLs are allowed", 400);
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new AppError("SSRF_BLOCKED", "Localhost URLs are blocked", 400);
    const address = isIP(url.hostname) ? url.hostname : (await lookup(url.hostname)).address;
    if (isPrivateIp(address)) throw new AppError("SSRF_BLOCKED", "Private network URLs are blocked", 400);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timer);
    const text = (await response.text()).slice(0, 200000).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { output: text.slice(0, 12000) };
  }
}

function isPrivateIp(ip: string): boolean {
  return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.|::1|fc|fd|fe80)/i.test(ip);
}
