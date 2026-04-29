import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb, setSetting, getSetting, firstCompanyId } from "../db/index.js";
import { requireAuth } from "../security/sessions.js";
import { setAdminPassword } from "../security/localAuth.js";
import { AppError, sendError } from "../utils/errors.js";
import { audit } from "./helpers.js";
import { allProviderStatuses } from "../ai/providerStatus.js";
import { resolveAgentModel } from "../engine/modelResolver.js";

const settingsSchema = z.object({
  company_id: z.string().optional(),
  autopilot_level: z.number().int().min(0).max(5).optional(),
  max_concurrent_runs: z.number().int().min(1).max(32).optional(),
  monthly_budget: z.number().min(0).optional(),
  working_hours: z.string().optional(),
  emergency_stopped: z.number().int().min(0).max(1).optional(),
  default_model_ceo: z.object({ provider: z.string().min(1), model: z.string().min(1) }).optional(),
  default_model_manager: z.object({ provider: z.string().min(1), model: z.string().min(1) }).optional(),
  default_model_worker: z.object({ provider: z.string().min(1), model: z.string().min(1) }).optional(),
  default_model_reviewer: z.object({ provider: z.string().min(1), model: z.string().min(1) }).optional(),
  default_model_global: z.object({ provider: z.string().min(1), model: z.string().min(1) }).optional(),
  default_model_ceo_provider: z.string().min(1).optional(),
  default_model_ceo_model: z.string().min(1).optional(),
  default_model_manager_provider: z.string().min(1).optional(),
  default_model_manager_model: z.string().min(1).optional(),
  default_model_worker_provider: z.string().min(1).optional(),
  default_model_worker_model: z.string().min(1).optional(),
  default_model_reviewer_provider: z.string().min(1).optional(),
  default_model_reviewer_model: z.string().min(1).optional(),
  default_model_global_provider: z.string().min(1).optional(),
  default_model_global_model: z.string().min(1).optional(),
  password: z.string().min(10).optional()
});

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get("/api/debug/model-resolution", async (request, reply) => {
    try {
      await requireAuth(request);
      const agentId = (request.query as { agentId?: string }).agentId;
      if (!agentId) throw new AppError("VALIDATION_ERROR", "agentId is required", 400);
      const agent = getDb().prepare("SELECT * FROM agents WHERE id = ?").get(agentId);
      if (!agent) throw new AppError("NOT_FOUND", "Agent not found", 404);
      return { data: resolveAgentModel(agent as Record<string, unknown>) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get("/api/settings", async (request, reply) => {
    try {
      await requireAuth(request);
      const companyId = (request.query as { company_id?: string }).company_id;
      const company = companyId ? getDb().prepare("SELECT * FROM companies WHERE id = ?").get(companyId) : getDb().prepare("SELECT * FROM companies ORDER BY created_at LIMIT 1").get();
      return {
        data: {
          company,
          max_concurrent_runs: Number(getSetting("max_concurrent_runs") ?? 2),
          mark_task_done_after_run: getSetting("mark_task_done_after_run") === "true",
          model_defaults: {
            ceo: parseModelSetting("default_model_ceo"),
            manager: parseModelSetting("default_model_manager"),
            worker: parseModelSetting("default_model_worker"),
            reviewer: parseModelSetting("default_model_reviewer"),
            global: parseModelSetting("default_model_global")
          },
          model_default_keys: modelDefaultKeys(),
          provider_statuses: allProviderStatuses()
        }
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch("/api/settings", async (request, reply) => {
    try {
      await requireAuth(request);
      const body = settingsSchema.parse(request.body);
      const companyId = body.company_id ?? firstCompanyId();
      if (body.password) await setAdminPassword(body.password);
      if (body.max_concurrent_runs) setSetting("max_concurrent_runs", String(body.max_concurrent_runs));
      for (const key of ["default_model_ceo", "default_model_manager", "default_model_worker", "default_model_reviewer", "default_model_global"] as const) {
        if (body[key]) saveModelDefault(key.replace("default_model_", ""), body[key]);
      }
      for (const role of ["ceo", "manager", "worker", "reviewer", "global"] as const) {
        const provider = body[`default_model_${role}_provider` as keyof typeof body];
        const model = body[`default_model_${role}_model` as keyof typeof body];
        if (typeof provider === "string" && typeof model === "string") saveModelDefault(role, { provider, model });
      }
      const updates: string[] = [];
      const values: unknown[] = [];
      for (const key of ["autopilot_level", "working_hours", "emergency_stopped", "monthly_budget"] as const) {
        if (body[key] !== undefined) {
          updates.push(`${key} = ?`);
          values.push(body[key]);
        }
      }
      if (updates.length && companyId) getDb().prepare(`UPDATE companies SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values, companyId);
      audit("settings_updated", "settings", companyId, { ...body, password: body.password ? "[changed]" : undefined });
      return { ok: true };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}

function parseModelSetting(key: string) {
  const role = key.replace("default_model_", "");
  const provider = getSetting(`default_model_${role}_provider`);
  const model = getSetting(`default_model_${role}_model`);
  if (provider && model) return { provider, model };
  const value = getSetting(key);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { provider?: string; model?: string };
    return parsed.provider && parsed.model ? { provider: parsed.provider, model: parsed.model } : null;
  } catch {
    return null;
  }
}

function saveModelDefault(role: string, value: { provider: string; model: string }) {
  setSetting(`default_model_${role}_provider`, value.provider);
  setSetting(`default_model_${role}_model`, value.model);
  setSetting(`default_model_${role}`, JSON.stringify(value));
}

function modelDefaultKeys() {
  return Object.fromEntries(["ceo", "manager", "worker", "reviewer", "global"].flatMap((role) => [
    [`default_model_${role}_provider`, getSetting(`default_model_${role}_provider`)],
    [`default_model_${role}_model`, getSetting(`default_model_${role}_model`)]
  ]));
}
