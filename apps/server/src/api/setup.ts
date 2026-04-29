import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb, getSetting, setSetting } from "../db/index.js";
import { seedDefaults } from "../db/seed.js";
import { setAdminPassword, createSession } from "../security/localAuth.js";
import { setSessionCookie } from "../security/sessions.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { sendError, AppError } from "../utils/errors.js";
import { audit } from "./helpers.js";

const setupSchema = z.object({
  companyName: z.string().min(2),
  description: z.string().optional(),
  industry: z.string().optional(),
  productsServices: z.string().optional(),
  targetCustomers: z.string().optional(),
  currentProblems: z.string().optional(),
  mainGoals: z.string().optional(),
  preferredTone: z.string().optional(),
  riskTolerance: z.enum(["low", "medium", "high"]).default("medium"),
  externalActionsRequireApproval: z.boolean().default(true),
  password: z.string().min(10)
});

export async function registerSetupRoutes(app: FastifyInstance) {
  app.get("/api/setup/status", async () => {
    const company = getDb().prepare("SELECT id, name, emergency_stopped, autopilot_level FROM companies ORDER BY created_at LIMIT 1").get();
    const hasCompany = Boolean(company);
    const hasAdminPassword = Boolean(getSetting("admin_password_hash"));
    return { setupRequired: !hasAdminPassword || !hasCompany, hasCompany, hasAdminPassword, company };
  });

  app.get("/api/setup-status", async () => {
    const company = getDb().prepare("SELECT id FROM companies ORDER BY created_at LIMIT 1").get();
    const hasCompany = Boolean(company);
    const hasAdminPassword = Boolean(getSetting("admin_password_hash"));
    return { setupRequired: !hasAdminPassword || !hasCompany, hasCompany, hasAdminPassword };
  });

  app.post("/api/setup", async (request, reply) => {
    try {
      if (getSetting("admin_password_hash")) throw new AppError("SETUP_COMPLETE", "Setup has already been completed", 409);
      const body = setupSchema.parse(request.body);
      const companyId = id("company");
      const createdAt = nowIso();
      await setAdminPassword(body.password);
      getDb()
        .prepare("INSERT INTO companies (id, name, description, business_description, industry, products_services, target_customers, current_problems, main_goals, preferred_tone, risk_tolerance, external_actions_require_approval, autopilot_level, emergency_stopped, working_hours, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)")
        .run(companyId, body.companyName, body.description ?? "", body.description ?? "", body.industry ?? "", body.productsServices ?? "", body.targetCustomers ?? "", body.currentProblems ?? "", body.mainGoals ?? "", body.preferredTone ?? "", body.riskTolerance, body.externalActionsRequireApproval ? 1 : 0, "Mon-Fri 09:00-17:00", createdAt, createdAt);
      setSetting("max_concurrent_runs", "2");
      setSetting("mark_task_done_after_run", "false");
      seedDefaults(companyId);
      audit("setup_complete", "company", companyId, { name: body.companyName });
      const session = createSession();
      setSessionCookie(reply, session.token, session.expiresAt);
      return { ok: true, companyId };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
