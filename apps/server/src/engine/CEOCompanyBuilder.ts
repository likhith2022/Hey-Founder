import { getDb } from "../db/index.js";
import { z } from "zod";
import { createProvider } from "../ai/providers.js";
import { safeJsonStringify } from "../utils/json.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { audit } from "../api/helpers.js";
import { AppError } from "../utils/errors.js";
import { log } from "../utils/logger.js";
import { resolveAgentModel } from "./modelResolver.js";
import { assertProviderReady, getProviderStatus } from "../ai/providerStatus.js";
import { extractJsonObject } from "../utils/extractJson.js";

type Row = Record<string, any>;
type BuildPlan = {
  departments: Array<{ name: string; description?: string; reason?: string }>;
  agents: Array<{ name: string; role: string; department_name?: string; manager_name?: string; system_prompt: string; tools?: string[]; permission_level?: number; allowed_actions?: string[]; blocked_actions?: string[]; reason?: string; model_provider?: string; model_name?: string }>;
  first_90_day_plan?: Array<{ title: string; description?: string; department_name?: string }>;
};

const CompanyBuildPlanSchema = z.object({
  departments: z.array(z.object({ name: z.string().min(2), description: z.string().min(1).default(""), reason: z.string().optional().default("") })).min(1),
  agents: z.array(z.object({
    name: z.string().min(2),
    role: z.string().min(2),
    department_name: z.string().min(1),
    manager_name: z.string().optional().default("CEO Agent"),
    system_prompt: z.string().min(20),
    tools: z.array(z.string()).default(["file_tool", "document_tool"]),
    permission_level: z.number().default(1),
    allowed_actions: z.array(z.string()).default(["research", "draft", "summarize", "create_internal_work_product"]),
    blocked_actions: z.array(z.string()).default(["send_email", "delete_files", "make_payments", "sign_contracts"]),
    reason: z.string().min(1).default("Needed for this business."),
    model_provider: z.string().optional(),
    model_name: z.string().optional()
  })).min(1),
  first_90_day_plan: z.array(z.object({ title: z.string().min(2), description: z.string().min(1).default(""), department_name: z.string().optional().default("") })).default([])
});

export class CEOCompanyBuilder {
  async buildCompany(companyId: string) {
    const db = getDb();
    const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId) as Row | undefined;
    if (!company) throw new AppError("COMPANY_NOT_FOUND", "Company was not found", 404);
    const ceo = db.prepare("SELECT * FROM agents WHERE company_id = ? AND name = 'CEO Agent' AND status = 'active' ORDER BY created_at LIMIT 1").get(companyId) as Row | undefined;
    if (!ceo) throw new AppError("CEO_NOT_FOUND", "Create an active CEO Agent before building the AI company.", 400);
    let result;
    try {
      const model = this.resolveModel(ceo);
      assertProviderReady(model.provider, "build_company");
      const provider = createProvider(model.provider);
      result = await provider.generateText({ model: model.name, temperature: 0.1, maxTokens: 8000, responseFormat: "json", messages: [{ role: "system", content: `${ceo.system_prompt}\n\nIMPORTANT: Be concise and efficient. Do not repeat descriptions. Focus on high-quality structure over quantity.` }, { role: "user", content: this.prompt(company) }] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "CEO company build failed";
      if (error instanceof AppError && ["PROVIDER_NOT_VERIFIED", "PROVIDER_INVALID"].includes(error.code)) throw error;
      if (message.includes("Add your") || message.includes("MISSING_PROVIDER_KEY")) throw new AppError("MISSING_PROVIDER_KEY", "Add a provider key in Secrets before asking CEO to build the company.", 400);
      const details = error instanceof AppError ? error.details : undefined;
      log("error", "CEO company build provider request failed", { error: error instanceof AppError ? error.code : "PROVIDER_REQUEST_FAILED", message, provider: details?.provider, model: details?.model, providerStatus: details?.provider ? getProviderStatus(String(details.provider)).status : undefined });
      if (error instanceof AppError && error.code === "PROVIDER_REQUEST_FAILED") {
        const provider = String(error.details?.provider ?? "provider");
        throw new AppError("PROVIDER_REQUEST_FAILED", `${providerDisplay(provider)} request failed. Check your API key/model in Secrets.`, error.statusCode >= 500 ? 502 : error.statusCode, error.details);
      }
      throw new AppError("PROVIDER_REQUEST_FAILED", "Provider request failed. Check your API key/model in Secrets.", 502);
    }
    const plan = parsePlan(result.text);
    const departmentIds = this.createDepartments(companyId, plan.departments, ceo.id);
    const createdAgents = this.createPendingAgents(companyId, ceo.id, plan.agents, departmentIds);
    if (plan.first_90_day_plan?.length) {
      db.prepare("INSERT INTO work_products (id, company_id, agent_id, type, title, content, metadata, created_at) VALUES (?, ?, ?, 'company_build_plan', 'CEO proposed first 90 day plan', ?, ?, ?)")
        .run(id("wp"), companyId, ceo.id, plan.first_90_day_plan.map((item, index) => `${index + 1}. ${item.title}\n${item.description ?? ""}`).join("\n\n"), safeJsonStringify({ departments: plan.departments.map((dep) => dep.name) }), nowIso());
    }
    audit("ceo_company_built", "company", companyId, { departments: plan.departments.length, agents: createdAgents.length });
    this.createDefaultSchedules(companyId, ceo.id);
    return { departments: plan.departments, agents: createdAgents, first_90_day_plan: plan.first_90_day_plan ?? [] };
  }

  private createDefaultSchedules(companyId: string, ceoId: string) {
    const db = getDb();
    const monitorId = id("schedule");
    const taskTemplate = safeJsonStringify({
      type: "run_task",
      title: "Daily Competitor & Market Research Briefing",
      description: "Research top 3 competitors for any news, pricing changes, or new features and generate a summary report for the founder.",
      priority: "high"
    });
    db.prepare("INSERT OR IGNORE INTO schedules (id, company_id, agent_id, name, cron, task_template, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)")
      .run(monitorId, companyId, ceoId, "Daily Competitor Monitoring", "0 6 * * *", taskTemplate, nowIso());
  }

  approveSafeEmployees(companyId: string) {
    const approvals = getDb().prepare("SELECT id FROM approvals WHERE company_id = ? AND approval_type = 'create_agent' AND status = 'pending' AND COALESCE(risk_level, 'medium') IN ('low', 'medium')").all(companyId) as Array<{ id: string }>;
    for (const approval of approvals) {
      const row = getDb().prepare("SELECT agent_id FROM approvals WHERE id = ?").get(approval.id) as { agent_id?: string };
      getDb().prepare("UPDATE approvals SET status = 'approved', decision_note = 'Approved by bulk safe employee action', decided_at = ? WHERE id = ?").run(nowIso(), approval.id);
      if (row.agent_id) getDb().prepare("UPDATE agents SET status = 'active', updated_at = ? WHERE id = ?").run(nowIso(), row.agent_id);
      audit("approval_approved", "approval", approval.id, { bulk: true });
    }
    return { approved: approvals.length };
  }

  private createDepartments(companyId: string, departments: BuildPlan["departments"], ceoId: string) {
    const db = getDb();
    const departmentIds = new Map<string, string>();
    for (const dep of departments) {
      if (!dep.name) continue;
      const existing = db.prepare("SELECT id FROM departments WHERE company_id = ? AND name = ?").get(companyId, dep.name) as { id: string } | undefined;
      const depId = existing?.id ?? id("dep");
      if (!existing) {
        db.prepare("INSERT INTO departments (id, company_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)").run(depId, companyId, dep.name, `${dep.description ?? ""}${dep.reason ? `\n\nReason: ${dep.reason}` : ""}`.trim(), nowIso());
        audit("ceo_department_proposed", "department", depId, { name: dep.name, reason: dep.reason }, undefined, { actor: ceoId });
      }
      departmentIds.set(dep.name, depId);
    }
    return departmentIds;
  }

  private createPendingAgents(companyId: string, ceoId: string, agents: BuildPlan["agents"], departmentIds: Map<string, string>) {
    const db = getDb();
    const byName = new Map((db.prepare("SELECT id, name FROM agents WHERE company_id = ?").all(companyId) as Array<{ id: string; name: string }>).map((agent) => [agent.name, agent.id]));
    const created: Row[] = [];
    for (const proposal of agents) {
      if (!proposal.name || byName.has(proposal.name)) continue;
      const agentId = id("agent");
      const managerId = proposal.manager_name ? byName.get(proposal.manager_name) ?? null : ceoId;
      const row = {
        id: agentId,
        company_id: companyId,
        department_id: proposal.department_name ? departmentIds.get(proposal.department_name) ?? null : null,
        manager_id: managerId,
        name: proposal.name,
        role: proposal.role,
        system_prompt: proposal.system_prompt,
        model_mode: proposal.model_provider && proposal.model_name ? "custom" : "role_default",
        model_provider: proposal.model_provider ?? null,
        model_name: proposal.model_name ?? null,
        tools: safeJsonStringify(proposal.tools ?? ["file_tool", "document_tool"]),
        permission_level: Math.min(Number(proposal.permission_level ?? 1), 1),
        allowed_actions: safeJsonStringify(proposal.allowed_actions ?? ["research", "draft", "summarize", "create_internal_work_product"]),
        blocked_actions: safeJsonStringify(proposal.blocked_actions ?? ["send_email", "delete_files", "make_payments", "sign_contracts", "activate_agent_without_approval"]),
        created_by_type: "agent",
        created_by_agent_id: ceoId,
        creation_reason: proposal.reason ?? "Proposed by CEO Agent during company build.",
        status: "pending_approval",
        created_at: nowIso(),
        updated_at: nowIso()
      };
      db.prepare("INSERT INTO agents (id, company_id, department_id, manager_id, name, role, system_prompt, model_mode, model_provider, model_name, tools, permission_level, allowed_actions, blocked_actions, created_by_type, created_by_agent_id, creation_reason, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(row.id, row.company_id, row.department_id, row.manager_id, row.name, row.role, row.system_prompt, row.model_mode, row.model_provider, row.model_name, row.tools, row.permission_level, row.allowed_actions, row.blocked_actions, row.created_by_type, row.created_by_agent_id, row.creation_reason, row.status, row.created_at, row.updated_at);
      db.prepare("INSERT INTO approvals (id, company_id, agent_id, approval_type, action_type, action_description, risk_level, payload, status, created_at) VALUES (?, ?, ?, 'create_agent', 'activate_agent', ?, 'medium', ?, 'pending', ?)")
        .run(id("approval"), companyId, agentId, `Activate CEO-proposed agent ${proposal.name}`, safeJsonStringify(row), nowIso());
      audit("ceo_agent_proposed", "agent", agentId, row);
      created.push(row);
      byName.set(proposal.name, agentId);
    }
    return created;
  }

  private prompt(company: Row) {
    return `Design the right AI company for this founder profile.

Return JSON only. Do not include markdown, code fences, commentary, or explanation outside JSON.

The JSON must match this exact shape:
{
  "departments": [{"name":"...", "description":"...", "reason":"..."}],
  "agents": [{
    "name":"...",
    "role":"...",
    "department_name":"...",
    "manager_name":"CEO Agent",
    "system_prompt":"At least 20 characters describing the employee responsibilities.",
    "tools":["file_tool","web_research","document_tool"],
    "permission_level":1,
    "allowed_actions":["research","draft","summarize","create_internal_work_product"],
    "blocked_actions":["send_email","delete_files","make_payments","sign_contracts"],
    "reason":"Why this employee is needed for this business"
  }],
  "first_90_day_plan": [{"title":"...", "description":"...", "department_name":"..."}]
}

Rules:
- Departments and agents must be business-specific.
- Every employee is only a proposal and requires human founder approval before activation.
- Keep permission_level conservative, usually 1.
- Use only known tools: file_tool, web_research, google_search, lead_tracker, content_repurposer, document_tool, email_draft, email_send, social_publish, http_api, code_sandbox.

Company: ${company.name}
Business description: ${company.business_description || company.description || ""}
Industry: ${company.industry || ""}
Products/services: ${company.products_services || ""}
Target customers: ${company.target_customers || ""}
Current problems: ${company.current_problems || ""}
Main goals: ${company.main_goals || ""}
Preferred tone/style: ${company.preferred_tone || ""}
Risk tolerance: ${company.risk_tolerance || "medium"}
External actions always require approval: ${Number(company.external_actions_require_approval ?? 1) === 1 ? "yes" : "no"}

Each proposed employee must be conservative, internal-first, and suitable for pending founder approval.`;
  }

  private resolveModel(ceo: Row) {
    return resolveAgentModel(ceo);
  }
}

function providerDisplay(provider: string) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function parsePlan(text: string): BuildPlan {
  const extracted = extractJsonObject(text);
  const parsed = CompanyBuildPlanSchema.safeParse(extracted);
  if (!parsed.success) {
    log("warn", "CEO returned invalid company build JSON", { issues: parsed.error.issues.slice(0, 6), responsePreview: text.slice(0, 1000) });
    throw new AppError("INVALID_CEO_BUILD_PLAN", "CEO returned an invalid company-build plan. Try again or test the selected CEO model in Secrets → Model Manager.", 502, { validationIssues: parsed.error.issues.slice(0, 6), responsePreview: text.slice(0, 500) });
  }
  return parsed.data;
}
