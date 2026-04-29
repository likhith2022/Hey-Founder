import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { optionalText, registerCrud } from "./helpers.js";
import { getConfig } from "../config.js";
import { safeResolve } from "../security/safePaths.js";
import { AppError } from "../utils/errors.js";
import { sendError } from "../utils/errors.js";
import { CEOCompanyBuilder } from "../engine/CEOCompanyBuilder.js";
import { requireAuth } from "../security/sessions.js";

const jsonText = optionalText.transform((v) => v ?? null);
const companyId = z.string().min(1);

export async function registerResourceRoutes(app: FastifyInstance) {
  app.post("/api/companies/:id/build-company", async (request, reply) => {
    try {
      await requireAuth(request);
      const { id } = request.params as { id: string };
      return { data: await new CEOCompanyBuilder().buildCompany(id) };
    } catch (error) {
      return sendError(reply, error);
    }
  });
  app.post("/api/companies/:id/approve-safe-employees", async (request, reply) => {
    try {
      await requireAuth(request);
      const { id } = request.params as { id: string };
      return { data: new CEOCompanyBuilder().approveSafeEmployees(id) };
    } catch (error) {
      return sendError(reply, error);
    }
  });
  registerCrud(app, "/api/companies", {
    table: "companies",
    prefix: "company",
    searchable: ["name", "description"],
    createSchema: z.object({ name: z.string().min(1), description: optionalText, business_description: optionalText, industry: optionalText, products_services: optionalText, target_customers: optionalText, current_problems: optionalText, main_goals: optionalText, preferred_tone: optionalText, risk_tolerance: optionalText, external_actions_require_approval: z.number().int().min(0).max(1).optional(), autopilot_level: z.number().int().min(0).max(5).optional(), working_hours: optionalText, monthly_budget: z.number().optional(), budget_used: z.number().optional() }),
    updateSchema: z.object({ name: optionalText, description: optionalText, business_description: optionalText, industry: optionalText, products_services: optionalText, target_customers: optionalText, current_problems: optionalText, main_goals: optionalText, preferred_tone: optionalText, risk_tolerance: optionalText, external_actions_require_approval: z.number().int().min(0).max(1).optional(), autopilot_level: z.number().int().min(0).max(5).optional(), emergency_stopped: z.number().int().min(0).max(1).optional(), working_hours: optionalText, monthly_budget: z.number().optional(), budget_used: z.number().optional() })
  });
  registerCrud(app, "/api/departments", {
    table: "departments",
    prefix: "dep",
    searchable: ["name", "description"],
    createSchema: z.object({ company_id: companyId, name: z.string().min(1), description: optionalText }),
    updateSchema: z.object({ name: optionalText, description: optionalText })
  });
  registerCrud(app, "/api/agents", {
    table: "agents",
    prefix: "agent",
    searchable: ["name", "role", "system_prompt"],
    createSchema: z.object({ company_id: companyId, department_id: optionalText, manager_id: optionalText, name: z.string().min(1), role: z.string().min(1), system_prompt: z.string().min(1), model_mode: optionalText, model_provider: optionalText, model_name: optionalText, tools: jsonText, permission_level: z.number().int().min(0).max(5).optional(), budget_limit: z.number().optional(), budget_used: z.number().optional(), memory_scope: optionalText, allowed_actions: jsonText, blocked_actions: jsonText, created_by_type: optionalText, created_by_agent_id: optionalText, creation_reason: optionalText, status: optionalText }),
    updateSchema: z.object({ department_id: optionalText, manager_id: optionalText, name: optionalText, role: optionalText, system_prompt: optionalText, model_mode: optionalText, model_provider: optionalText, model_name: optionalText, tools: jsonText, permission_level: z.number().int().min(0).max(5).optional(), budget_limit: z.number().optional(), budget_used: z.number().optional(), memory_scope: optionalText, allowed_actions: jsonText, blocked_actions: jsonText, creation_reason: optionalText, status: optionalText }),
    beforeCreate: (row) => {
      if (row.model_mode === "role_default") {
        row.model_provider = null;
        row.model_name = null;
      }
      if (row.created_by_type === "agent") {
        return { ...row, model_mode: row.model_mode ?? "role_default", status: "pending_approval", permission_level: Math.min(Number(row.permission_level ?? 1), 1) };
      }
      return row;
    },
    beforeUpdate: (patch, before) => {
      if (patch.model_mode === "role_default") {
        patch.model_provider = null;
        patch.model_name = null;
      }
      if (before.created_by_type === "agent" && before.status === "pending_approval" && patch.status === "active") {
        throw new AppError("APPROVAL_REQUIRED", "CEO-created agents can only be activated through an approval decision", 403);
      }
      return patch;
    }
  });
  registerCrud(app, "/api/goals", {
    table: "goals",
    prefix: "goal",
    searchable: ["title", "description"],
    createSchema: z.object({ company_id: companyId, title: z.string().min(1), description: optionalText, status: optionalText, priority: optionalText, due_at: optionalText }),
    updateSchema: z.object({ title: optionalText, description: optionalText, status: optionalText, priority: optionalText, due_at: optionalText })
  });
  registerCrud(app, "/api/projects", {
    table: "projects",
    prefix: "project",
    searchable: ["title", "description"],
    createSchema: z.object({ company_id: companyId, goal_id: optionalText, title: z.string().min(1), description: optionalText, status: optionalText, owner_agent_id: optionalText }),
    updateSchema: z.object({ goal_id: optionalText, title: optionalText, description: optionalText, status: optionalText, owner_agent_id: optionalText })
  });
  registerCrud(app, "/api/tasks", {
    table: "tasks",
    prefix: "task",
    searchable: ["title", "description"],
    createSchema: z.object({ company_id: companyId, project_id: optionalText, goal_id: optionalText, assigned_agent_id: optionalText, title: z.string().min(1), description: optionalText, status: optionalText, priority: optionalText, requires_approval: z.number().int().min(0).max(1).optional(), created_by_type: optionalText, created_by_agent_id: optionalText, due_at: optionalText }),
    updateSchema: z.object({ project_id: optionalText, goal_id: optionalText, assigned_agent_id: optionalText, title: optionalText, description: optionalText, status: optionalText, priority: optionalText, requires_approval: z.number().int().min(0).max(1).optional(), due_at: optionalText })
  });
  registerCrud(app, "/api/runs", { table: "runs", prefix: "run", searchable: ["input", "output", "error"], createSchema: z.object({ task_id: optionalText, agent_id: optionalText, company_id: optionalText, status: optionalText, input: optionalText }), updateSchema: z.object({ status: optionalText, output: optionalText, error: optionalText }) });
  registerCrud(app, "/api/approvals", { table: "approvals", prefix: "approval", searchable: ["action_description", "risk_level"], createSchema: z.object({ company_id: companyId, task_id: optionalText, run_id: optionalText, agent_id: optionalText, approval_type: z.string().min(1), action_type: optionalText, action_description: optionalText, risk_level: optionalText, payload: jsonText, status: optionalText }), updateSchema: z.object({ status: optionalText, decision_note: optionalText }) });
  registerCrud(app, "/api/schedules", { table: "schedules", prefix: "schedule", searchable: ["name", "cron"], createSchema: z.object({ company_id: companyId, agent_id: optionalText, name: z.string().min(1), cron: z.string().min(1), task_template: jsonText, enabled: z.number().int().min(0).max(1).optional(), missed_job_policy: optionalText }), updateSchema: z.object({ agent_id: optionalText, name: optionalText, cron: optionalText, task_template: jsonText, enabled: z.number().int().min(0).max(1).optional(), missed_job_policy: optionalText }) });
  registerCrud(app, "/api/tools", {
    table: "tools",
    prefix: "tool",
    searchable: ["name", "description"],
    createSchema: z.object({ name: z.string().min(1), description: optionalText, enabled: z.number().int().min(0).max(1).optional(), risk_level: optionalText, requires_approval: z.number().int().min(0).max(1).optional(), config: jsonText }),
    updateSchema: z.object({ description: optionalText, enabled: z.number().int().min(0).max(1).optional(), risk_level: optionalText, requires_approval: z.number().int().min(0).max(1).optional(), config: jsonText }),
    beforeCreate: (row) => ({ ...row, requires_approval: row.risk_level === "high" ? 1 : row.requires_approval }),
    beforeUpdate: (patch, before) => {
      const risk = patch.risk_level ?? before.risk_level;
      if (risk === "high" && patch.enabled === 1 && patch.requires_approval === 0) {
        throw new AppError("APPROVAL_REQUIRED", "High-risk tools must keep approval enforcement enabled", 403);
      }
      if (risk === "high") return { ...patch, requires_approval: 1 };
      return patch;
    }
  });
  registerCrud(app, "/api/memory", { table: "memories", prefix: "mem", searchable: ["content"], createSchema: z.object({ company_id: companyId, agent_id: optionalText, scope: optionalText, content: z.string().min(1), importance: z.number().min(0).max(1).optional(), source_run_id: optionalText }), updateSchema: z.object({ content: optionalText, importance: z.number().min(0).max(1).optional(), scope: optionalText }) });
  registerCrud(app, "/api/files", {
    table: "files",
    prefix: "file",
    searchable: ["name", "path"],
    createSchema: z.object({ path: z.string().min(1), name: z.string().min(1), mime_type: optionalText, size: z.number().int().optional(), metadata: jsonText }),
    updateSchema: z.object({ metadata: jsonText }),
    beforeCreate: (row) => {
      safeResolve(getConfig().paths.files, String(row.path));
      return row;
    }
  });
  registerCrud(app, "/api/work-products", { table: "work_products", prefix: "wp", searchable: ["title", "content"], createSchema: z.object({ company_id: companyId, task_id: optionalText, run_id: optionalText, agent_id: optionalText, type: optionalText, title: optionalText, content: optionalText, file_path: optionalText, metadata: jsonText }), updateSchema: z.object({ title: optionalText, content: optionalText, metadata: jsonText }) });
  registerCrud(app, "/api/audit", { table: "audit_logs", prefix: "audit", searchable: ["action", "resource_type", "actor_type"], createSchema: z.object({ action: z.string().min(1), company_id: optionalText, actor_type: optionalText, actor_id: optionalText, resource_type: optionalText, resource_id: optionalText, metadata: jsonText }), updateSchema: z.object({ metadata: jsonText }) });
  registerCrud(app, "/api/ledger", { table: "ledger", prefix: "entry", searchable: ["description", "type"], createSchema: z.object({ company_id: companyId, type: z.enum(["revenue", "expense"]), amount: z.number(), description: optionalText }), updateSchema: z.object({ description: optionalText, amount: z.number() }) });
  registerCrud(app, "/api/wiki", { table: "wiki_pages", prefix: "wiki", searchable: ["title", "content", "category"], createSchema: z.object({ company_id: companyId, title: z.string().min(1), content: optionalText, category: optionalText }), updateSchema: z.object({ title: optionalText, content: optionalText, category: optionalText }) });
  registerCrud(app, "/api/leads", { table: "leads", prefix: "lead", searchable: ["name", "company_name", "email"], createSchema: z.object({ company_id: companyId, name: optionalText, company_name: optionalText, email: optionalText, linkedin_url: optionalText, source_url: optionalText, status: optionalText, notes: optionalText }), updateSchema: z.object({ name: optionalText, company_name: optionalText, email: optionalText, linkedin_url: optionalText, source_url: optionalText, status: optionalText, notes: optionalText }) });
}
