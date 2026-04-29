import { getDb, getSetting, setSetting } from "../db/index.js";
import { safeJsonParse, safeJsonStringify } from "../utils/json.js";
import { nowIso } from "../utils/time.js";
import { AppError } from "../utils/errors.js";

export type ProviderStatusValue = "not_configured" | "unverified" | "verified" | "invalid";
export type ModelTestStatus = "untested" | "verified" | "warning" | "invalid";
export type ProviderStatus = { status: ProviderStatusValue; last_checked_at?: string | null; last_error?: string | null; warning?: string | null; model_tested_model?: string | null; model_tested_at?: string | null; model_test_status?: ModelTestStatus; model_test_error?: string | null };

export function getProviderStatus(provider: string): ProviderStatus {
  const normalized = provider.toLowerCase();
  const saved = getSetting(statusKey(normalized));
  if (saved) {
    const parsed = safeJsonParse<ProviderStatus>(saved, { status: "unverified" });
    return { status: parsed.status ?? "unverified", last_checked_at: parsed.last_checked_at ?? null, last_error: parsed.last_error ?? null, warning: parsed.warning ?? null, model_tested_model: parsed.model_tested_model ?? null, model_tested_at: parsed.model_tested_at ?? null, model_test_status: parsed.model_test_status ?? "untested", model_test_error: parsed.model_test_error ?? null };
  }
  return hasProviderSecret(normalized) ? { status: "unverified", last_checked_at: null, last_error: null, warning: null, model_test_status: "untested" } : { status: "not_configured", last_checked_at: null, last_error: null, warning: null, model_test_status: "untested" };
}

export function setProviderStatus(provider: string, status: Exclude<ProviderStatusValue, "not_configured">, lastError?: string | null, warning?: string | null) {
  const current = getProviderStatus(provider);
  setSetting(statusKey(provider.toLowerCase()), safeJsonStringify({ ...current, status, last_checked_at: nowIso(), last_error: lastError ?? null, warning: warning ?? null }));
}

export function setProviderModelTest(provider: string, model: string, status: ModelTestStatus, error?: string | null) {
  const current = getProviderStatus(provider);
  setSetting(statusKey(provider.toLowerCase()), safeJsonStringify({ ...current, model_tested_model: model, model_tested_at: nowIso(), model_test_status: status, model_test_error: error ?? null }));
}

export function markProviderUnverified(provider: string) {
  setSetting(statusKey(provider.toLowerCase()), safeJsonStringify({ status: "unverified", last_checked_at: null, last_error: null }));
}

export function allProviderStatuses(providers = ["openai", "anthropic", "gemini", "openrouter", "ollama", "mock"]) {
  return Object.fromEntries(providers.map((provider) => [provider, getProviderStatus(provider)]));
}

export function assertProviderReady(provider: string, action: "build_company" | "run_agent" = "run_agent") {
  if (provider === "mock") return;
  const state = getProviderStatus(provider);
  const display = providerDisplay(provider);
  if (state.status === "not_configured") throw new AppError("MISSING_PROVIDER_KEY", `Add your ${display} API key or local config in Secrets before running this agent.`, 400, { provider, providerStatus: state.status });
  if (state.status === "invalid") throw new AppError("PROVIDER_INVALID", `${display} is marked invalid. Test or replace the API key in Secrets → Model Manager.`, 400, { provider, providerStatus: state.status, lastError: state.last_error });
  if (state.status === "unverified") {
    const message = action === "build_company"
      ? `Test your ${display} connection in Secrets → Model Manager before asking the CEO to build the company.`
      : `${display} key is saved but not tested. Test connection before running agents.`;
    throw new AppError("PROVIDER_NOT_VERIFIED", message, 400, { provider, providerStatus: state.status, lastError: state.last_error });
  }
}

function hasProviderSecret(provider: string) {
  const row = getDb().prepare("SELECT id FROM secrets WHERE provider = ? OR name = ? LIMIT 1").get(provider, provider);
  return Boolean(row);
}

function statusKey(provider: string) {
  return `provider_status_${provider}`;
}

function providerDisplay(provider: string) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}
