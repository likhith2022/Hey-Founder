import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { requireAuth } from "../security/sessions.js";
import { encryptSecret } from "../vault/localVault.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { AppError, sendError } from "../utils/errors.js";
import { audit } from "./helpers.js";
import { createProvider, isProviderAvailable } from "../ai/providers.js";
import { resolveAutoModel } from "../ai/modelPresets.js";
import { allProviderStatuses, getProviderStatus, markProviderUnverified, setProviderModelTest, setProviderStatus } from "../ai/providerStatus.js";
import { log } from "../utils/logger.js";
import { parseModelSetting } from "../engine/modelResolver.js";

const secretSchema = z.object({ name: z.string().min(1), provider: z.string().min(1), type: z.string().optional(), value: z.string().min(1) });
const testProviderSchema = z.object({ provider: z.enum(["openai", "anthropic", "gemini", "openrouter", "ollama", "mock"]), model: z.string().min(1).default("auto") });

export async function registerSecretRoutes(app: FastifyInstance) {
  app.get("/api/secrets", async (request, reply) => {
    try {
      await requireAuth(request);
      const rows = getDb().prepare("SELECT id, name, type, provider, created_at, updated_at FROM secrets ORDER BY provider").all();
      return { data: rows.map((row: any) => ({ ...row, configured: getProviderStatus(row.provider).status === "verified", provider_status: getProviderStatus(row.provider) })), provider_statuses: allProviderStatuses() };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/api/secrets", async (request, reply) => {
    try {
      await requireAuth(request);
      const body = secretSchema.parse(request.body);
      const encrypted = encryptSecret(body.value);
      const secretId = id("secret");
      getDb()
        .prepare("INSERT INTO secrets (id, name, type, provider, encrypted_value, iv, auth_tag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET provider = excluded.provider, type = excluded.type, encrypted_value = excluded.encrypted_value, iv = excluded.iv, auth_tag = excluded.auth_tag, updated_at = excluded.updated_at")
        .run(secretId, body.name, body.type ?? "api_key", body.provider, encrypted.encryptedValue, encrypted.iv, encrypted.authTag, nowIso(), nowIso());
      markProviderUnverified(body.provider);
      audit("secret_saved", "secret", body.name, { provider: body.provider });
      return { ok: true };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/api/secrets/test-provider", async (request, reply) => {
    try {
      await requireAuth(request);
      const body = testProviderSchema.parse(request.body);
      if (!isProviderAvailable(body.provider)) throw new AppError("MISSING_PROVIDER_KEY", `Add your ${providerDisplay(body.provider)} API key or local config before testing.`, 400, { provider: body.provider, status: "not_configured" });
      const model = body.model === "auto" ? resolveAutoModel(body.provider, "default") : body.model;
      try {
        const provider = createProvider(body.provider);
        const result = await withTimeout(provider.generateText({ model, maxTokens: 8, temperature: 0, messages: [{ role: "user", content: "Reply with OK only." }] }), 15000);
        const normalized = normalizeTestReply(result.text);
        if (!normalized) throw new AppError("PROVIDER_REQUEST_FAILED", `${providerDisplay(body.provider)} returned an empty test response. Check the selected model.`, 502, { provider: body.provider, model });
        const warning = normalized.includes("ok") || normalized.includes("okay") ? undefined : "Provider responded with a non-standard test reply.";
        setProviderStatus(body.provider, "verified", null, warning);
        setProviderModelTest(body.provider, model, warning ? "warning" : "verified", warning ?? null);
        audit("provider_test_succeeded", "secret", body.provider, { provider: body.provider, model, warning });
        return { ok: true, provider: body.provider, model, status: "verified", warning };
      } catch (error) {
        const message = providerFailureMessage(body.provider, error);
        const statusCode = error instanceof AppError ? Number(error.details?.statusCode ?? error.details?.status ?? error.statusCode) : 0;
        if ([401, 403].includes(statusCode) || /authorization|api key|unreachable|timed out/i.test(message)) setProviderStatus(body.provider, "invalid", message);
        setProviderModelTest(body.provider, model, "invalid", message);
        log("warn", "Provider connection test failed", { provider: body.provider, model, error: error instanceof AppError ? error.code : "PROVIDER_REQUEST_FAILED", message });
        audit("provider_test_failed", "secret", body.provider, { provider: body.provider, model, error: message });
        return reply.status(502).send({ ok: false, provider: body.provider, model, status: "invalid", error: message });
      }
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/api/secrets/test-defaults", async (request, reply) => {
    try {
      await requireAuth(request);
      const roles = ["ceo", "manager", "worker", "reviewer", "global"] as const;
      const results = [];
      for (const role of roles) {
        const item = parseModelSetting(`default_model_${role}`);
        if (!item) {
          results.push({ role, ok: false, status: "invalid", error: "Default model is not configured." });
          continue;
        }
        const model = item.name === "auto" ? resolveAutoModel(item.provider, role === "global" ? "default" : role) : item.name;
        try {
          const provider = createProvider(item.provider);
          const result = await withTimeout(provider.generateText({ model, maxTokens: 8, temperature: 0, messages: [{ role: "user", content: "Reply with OK only." }] }), 15000);
          const normalized = normalizeTestReply(result.text);
          if (!normalized) throw new AppError("PROVIDER_REQUEST_FAILED", `${providerDisplay(item.provider)} returned an empty test response. Check the selected model.`, 502, { provider: item.provider, model });
          const warning = normalized.includes("ok") || normalized.includes("okay") ? undefined : "Provider responded with a non-standard test reply.";
          setProviderStatus(item.provider, "verified", null, warning);
          setProviderModelTest(item.provider, model, warning ? "warning" : "verified", warning ?? null);
          results.push({ role, ok: true, provider: item.provider, model, status: warning ? "warning" : "verified", warning });
        } catch (error) {
          const message = providerFailureMessage(item.provider, error);
          setProviderModelTest(item.provider, model, "invalid", message);
          results.push({ role, ok: false, provider: item.provider, model, status: "invalid", error: message });
        }
      }
      return { data: results };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AppError("PROVIDER_REQUEST_FAILED", "Provider test timed out.", 502)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function providerFailureMessage(provider: string, error: unknown) {
  if (error instanceof AppError && error.message) return error.message;
  if (error instanceof Error && /401|403|authorization|api key/i.test(error.message)) return "Invalid API key or provider authorization failed.";
  if (provider === "gemini" && error instanceof Error && /404|not found/i.test(error.message)) return "Gemini model or endpoint not found. Try Auto, gemini-1.5-flash, or check whether your API key has Gemini API access.";
  return `${providerDisplay(provider)} request failed. Check your API key/model in Secrets.`;
}

function normalizeTestReply(text: string | null | undefined) {
  return String(text ?? "")
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/i, "")
    .replace(/[*_`>#-]/g, "")
    .trim()
    .toLowerCase();
}

function providerDisplay(provider: string) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}
