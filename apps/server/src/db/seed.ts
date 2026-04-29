import { getDb } from "./index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { safeJsonStringify } from "../utils/json.js";

export const defaultDepartments = ["Executive"];

const defaultTools = [
  ["file_tool", "Read local uploaded files and write new work products.", "low", 0, { approvals: ["overwrite", "delete"] }],
  ["web_research", "Fetch public webpage text with SSRF protections.", "low", 0, {}],
  ["google_search", "Search the web for companies, leads, and market news.", "low", 0, {}],
  ["content_repurposer", "Transform one idea into multiple social posts and emails.", "low", 0, {}],
  ["document_tool", "Create markdown documents as work products.", "low", 0, {}],
  ["email_draft", "Create email drafts only; no sending in v1.", "medium", 0, { draftsOnly: true }],
  ["email_send", "Send real emails autonomously using Resend or SMTP.", "high", 1, {}],
  ["social_publish", "Post directly to Twitter/X or LinkedIn autonomously.", "high", 1, {}],
  ["http_api", "Make allowlisted HTTP requests. Mutations require approval.", "high", 1, { methods: ["GET"], allowlist: [] }],
  ["code_sandbox", "Run controlled local commands inside data/sandbox with approval.", "high", 1, { network: false }]
];

export function seedDefaults(companyId: string) {
  const db = getDb();
  const createdAt = nowIso();
  const departmentIds = new Map<string, string>();
  const insertDepartment = db.prepare("INSERT OR IGNORE INTO departments (id, company_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)");
  for (const department of defaultDepartments) {
    const existing = db.prepare("SELECT id FROM departments WHERE company_id = ? AND name = ?").get(companyId, department) as { id: string } | undefined;
    const depId = existing?.id ?? id("dep");
    insertDepartment.run(depId, companyId, department, `${department} department`, createdAt);
    departmentIds.set(department, depId);
  }
  const insertTool = db.prepare("INSERT OR IGNORE INTO tools (id, name, description, enabled, risk_level, requires_approval, config, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const [name, description, risk, approval, config] of defaultTools) {
    insertTool.run(id("tool"), name, description, name === "http_api" || name === "code_sandbox" ? 0 : 1, risk, approval, safeJsonStringify(config), createdAt);
  }
  const insertAgent = db.prepare(`INSERT INTO agents (id, company_id, department_id, name, role, system_prompt, model_mode, model_provider, model_name, tools, permission_level, allowed_actions, blocked_actions, created_by_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'role_default', ?, ?, ?, ?, ?, ?, 'human', 'active', ?, ?)`);
  const agentCount = db.prepare("SELECT COUNT(*) AS count FROM agents WHERE company_id = ?").get(companyId) as { count: number };
  if (agentCount.count === 0) {
    insertAgent.run(
      id("agent"),
      companyId,
      departmentIds.get("Executive") ?? null,
      "CEO Agent",
      "CEO",
      "You are the CEO Agent for this company. Your first responsibility is to understand the founder's business profile, design the right AI company structure, propose departments, propose AI employees, define their prompts/tools/permissions, and request human approval before activating any employee.",
      null,
      null,
      safeJsonStringify(["file_tool", "web_research", "document_tool", "email_draft"]),
      1,
      safeJsonStringify(["design_company_structure", "propose_departments", "propose_ai_employees", "plan_goals", "create_internal_work_product"]),
      safeJsonStringify(["send_email", "delete_files", "make_payments", "sign_contracts", "activate_agent_without_approval"]),
      createdAt,
      createdAt
    );
  }
}
