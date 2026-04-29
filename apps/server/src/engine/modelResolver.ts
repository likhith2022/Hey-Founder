import { getSetting } from "../db/index.js";
import { safeJsonParse } from "../utils/json.js";
import { AppError } from "../utils/errors.js";
import { resolveAutoModel } from "../ai/modelPresets.js";
import { log } from "../utils/logger.js";

type Row = Record<string, any>;

export type ResolvedModel = { provider: string; name: string; requestedName: string; source: "custom" | "role_default" | "global_default"; roleKey: string; label: string; displayLabel: string };

export function modelRoleKey(agent: Row) {
  const text = `${agent.name ?? ""} ${agent.role ?? ""}`.toLowerCase();
  if (text.includes("ceo") || text.includes("founder")) return "ceo";
  if (text.includes("review") || text.includes("qa") || text.includes("tester")) return "reviewer";
  if (text.includes("manager") || text.includes("lead") || text.includes("director")) return "manager";
  return "worker";
}

export function resolveAgentModel(agent: Row): ResolvedModel {
  const roleKey = modelRoleKey(agent);
  if ((agent.model_mode ?? "custom") === "custom" && agent.model_provider && agent.model_name) {
    return modelResult(String(agent.model_provider), String(agent.model_name), "custom", roleKey, "Custom");
  }
  const roleDefault = parseModelSetting(`default_model_${roleKey}`);
  if (roleDefault) return modelResult(roleDefault.provider, roleDefault.name, "role_default", roleKey, `${roleLabel(roleKey)} default`);
  const global = parseModelSetting("default_model_global");
  if (global) return modelResult(global.provider, global.name, "global_default", roleKey, "Global default");
  const expectedKeys = [`default_model_${roleKey}_provider`, `default_model_${roleKey}_model`, "default_model_global_provider", "default_model_global_model"];
  const foundDefaults = {
    [`${roleKey}ProviderExists`]: Boolean(getSetting(`default_model_${roleKey}_provider`)),
    [`${roleKey}ModelExists`]: Boolean(getSetting(`default_model_${roleKey}_model`)),
    globalProviderExists: Boolean(getSetting("default_model_global_provider")),
    globalModelExists: Boolean(getSetting("default_model_global_model"))
  };
  log("warn", "Model resolution missing model", { agentId: agent.id, agentName: agent.name, role: roleKey, modelMode: agent.model_mode, expectedKeys, foundDefaults });
  throw new AppError("MISSING_MODEL", `Choose a model for ${agent.name} or configure a ${roleKey}/global default model in Secrets & Model Manager.`, 400, { role: roleKey, agentId: agent.id, expectedKeys, foundDefaults });
}

export function resolveModelForAgent(agent: Row) {
  return resolveAgentModel(agent);
}

export function parseModelSetting(key: string): { provider: string; name: string } | null {
  const role = key.replace("default_model_", "");
  const provider = getSetting(`default_model_${role}_provider`);
  const model = getSetting(`default_model_${role}_model`);
  if (provider && model) return { provider, name: model };
  const value = getSetting(key);
  if (!value) return null;
  const parsed = safeJsonParse<{ provider?: string; model?: string }>(value, {});
  return parsed.provider && parsed.model ? { provider: parsed.provider, name: parsed.model } : null;
}

function roleLabel(roleKey: string) {
  if (roleKey === "ceo") return "CEO";
  if (roleKey === "reviewer") return "Reviewer";
  if (roleKey === "manager") return "Manager";
  return "Worker";
}

function modelResult(provider: string, requestedName: string, source: ResolvedModel["source"], roleKey: string, prefix: string): ResolvedModel {
  const name = requestedName === "auto" ? resolveAutoModel(provider, roleKey) : requestedName;
  const label = requestedName === "auto" ? `${prefix}: ${provider}/Auto → ${name}` : `${prefix}: ${provider}/${name}`;
  return { provider, name, requestedName, source, roleKey, label, displayLabel: label };
}
