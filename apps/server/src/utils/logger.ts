import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { getConfig } from "../config.js";

export function log(level: "info" | "warn" | "error", message: string, metadata?: unknown) {
  const line = JSON.stringify({ at: new Date().toISOString(), level, message: redact(message), metadata: redact(metadata) }) + "\n";
  if (level === "error") console.error(line.trim());
  else console.log(line.trim());
  try {
    appendFileSync(join(getConfig().paths.logs, "server.log"), line);
  } catch {
    // Logging must never break the local server.
  }
}

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/(sk-[a-zA-Z0-9_-]{12,})/g, "[REDACTED_SECRET]")
      .replace(/([a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,})/g, "[REDACTED_TOKEN]")
      .replace(/(api[_-]?key|token|secret|password)=([^&\s]+)/gi, "$1=[REDACTED_SECRET]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /(api[_-]?key|token|secret|password|encrypted_value|auth_tag|iv)/i.test(key) ? "[REDACTED_SECRET]" : redact(item)
      ])
    );
  }
  return value;
}
