import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(process.env.DATA_DIR ?? join(root, "data"));
const dbPath = join(dataDir, "ai-company-os.sqlite");
const filesDir = join(dataDir, "files");
const workProductsDir = join(dataDir, "work-products");
const backupsDir = join(dataDir, "backups");
const logsDir = join(dataDir, "logs");
const sandboxDir = join(dataDir, "sandbox");
const now = new Date().toISOString();
const demoPassword = "demo-local-password";

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function json(value: unknown) {
  return JSON.stringify(value);
}

function setting(db: Database.Database, key: string, value: string) {
  db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(key, value, now);
}

function main() {
  for (const dir of [dataDir, filesDir, workProductsDir, backupsDir, logsDir, sandboxDir]) mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(join(root, "apps/server/src/db/schema.sql"), "utf8"));

  setting(db, "admin_password_hash", bcrypt.hashSync(demoPassword, 12));
  setting(db, "max_concurrent_runs", "2");
  setting(db, "mark_task_done_after_run", "false");
  setting(db, "demo_mode", "software_company");
  setting(db, "default_model_ceo", json({ provider: "gemini", model: "auto" }));
  setting(db, "default_model_ceo_provider", "gemini");
  setting(db, "default_model_ceo_model", "auto");

  const company = db.prepare("SELECT id FROM companies WHERE name = 'NovaStack AI'").get() as { id: string } | undefined;
  const companyId = company?.id ?? id("company");
  db.prepare("INSERT INTO companies (id, name, description, business_description, industry, products_services, target_customers, current_problems, main_goals, preferred_tone, risk_tolerance, external_actions_require_approval, autopilot_level, emergency_stopped, working_hours, created_at, updated_at) VALUES (?, 'NovaStack AI', ?, ?, 'Software startup', ?, ?, ?, ?, ?, 'medium', 1, 1, 0, 'Mon-Fri 09:00-17:00', ?, ?) ON CONFLICT(id) DO UPDATE SET description = excluded.description, business_description = excluded.business_description, industry = excluded.industry, products_services = excluded.products_services, target_customers = excluded.target_customers, current_problems = excluded.current_problems, main_goals = excluded.main_goals, preferred_tone = excluded.preferred_tone, risk_tolerance = excluded.risk_tolerance, external_actions_require_approval = excluded.external_actions_require_approval, autopilot_level = 1, emergency_stopped = 0, updated_at = excluded.updated_at")
    .run(companyId, "Software startup building practical AI productivity tools for revenue teams.", "NovaStack AI builds local-first productivity tools that help revenue teams draft, review, and improve customer email workflows.", "An AI email assistant that drafts, rewrites, summarizes, and reviews sales and customer-success email.", "Seed-stage B2B SaaS founders, sales teams, and customer success teams.", "The team needs sharper positioning, a launch landing page, QA review, and repeatable customer-facing copy.", "Build and launch a landing page for an AI email assistant.", "Confident, precise, useful, and human. Avoid hype.", now, now);

  const executiveId = id("dep");
  db.prepare("INSERT OR IGNORE INTO departments (id, company_id, name, description, created_at) VALUES (?, ?, 'Executive', 'Executive leadership for the local AI company.', ?)").run(executiveId, companyId, now);

  const tools = [
    ["file_tool", "Read local uploaded files and write new work products.", "low", 0, { approvals: ["overwrite", "delete"] }, 1],
    ["web_research", "Fetch public webpage text with SSRF protections.", "low", 0, {}, 1],
    ["document_tool", "Create markdown documents as work products.", "low", 0, {}, 1],
    ["email_draft", "Create email drafts only; no sending in v1.", "medium", 0, { draftsOnly: true }, 1],
    ["http_api", "Make allowlisted HTTP requests. Mutations require approval.", "high", 1, { methods: ["GET"], allowlist: [] }, 0],
    ["code_sandbox", "Run controlled local commands inside data/sandbox with approval.", "high", 1, { network: false }, 0]
  ] as const;
  for (const [name, description, risk, approval, config, enabled] of tools) {
    db.prepare("INSERT INTO tools (id, name, description, enabled, risk_level, requires_approval, config, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET description = excluded.description, enabled = excluded.enabled, risk_level = excluded.risk_level, requires_approval = excluded.requires_approval, config = excluded.config")
      .run(id("tool"), name, description, enabled, risk, approval, json(config), now);
  }

  const ceo = db.prepare("SELECT id FROM agents WHERE company_id = ? AND name = 'CEO Agent'").get(companyId) as { id: string } | undefined;
  if (!ceo) {
    db.prepare("INSERT INTO agents (id, company_id, department_id, name, role, system_prompt, model_mode, model_provider, model_name, tools, permission_level, allowed_actions, blocked_actions, created_by_type, status, creation_reason, created_at, updated_at) VALUES (?, ?, ?, 'CEO Agent', 'CEO', ?, 'role_default', NULL, NULL, ?, 1, ?, ?, 'human', 'active', 'Only default employee created during setup.', ?, ?)")
      .run(id("agent"), companyId, executiveId, "You are the CEO Agent for this company. Your first responsibility is to understand the founder's business profile, design the right AI company structure, propose departments, propose AI employees, define their prompts/tools/permissions, and request human approval before activating any employee.", json(["file_tool", "web_research", "document_tool", "email_draft"]), json(["design_company_structure", "propose_departments", "propose_ai_employees", "plan_goals", "create_internal_work_product"]), json(["send_email", "delete_files", "make_payments", "sign_contracts", "activate_agent_without_approval"]), now, now);
  }

  const goalTitle = "Build and launch a landing page for an AI email assistant";
  const existingGoal = db.prepare("SELECT id FROM goals WHERE company_id = ? AND title = ?").get(companyId, goalTitle) as { id: string } | undefined;
  if (!existingGoal) {
    db.prepare("INSERT INTO goals (id, company_id, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 'high', ?, ?)")
      .run(id("goal"), companyId, goalTitle, "After the CEO builds the AI company and the founder approves employees, plan product positioning, launch copy, QA checks, and work products for an AI email assistant.", now, now);
  }

  const sampleFiles = [
    ["product-notes.md", "# Product Notes\n\nNovaStack Mail Assistant drafts, improves, and summarizes revenue-team email workflows while keeping customer data local-first where possible.\n\nCore promise: faster high-quality email without losing human control."],
    ["target-customers.md", "# Target Customers\n\n- Seed-stage B2B SaaS founders\n- Sales teams writing outbound emails\n- Customer success teams answering repetitive account questions\n- Operators who need reviewable AI drafts before anything is sent"],
    ["brand-voice.md", "# Brand Voice\n\nConfident, precise, useful, and human. Avoid hype. Show that the assistant drafts and prepares work, while people approve important communication."]
  ] as const;
  for (const [name, content] of sampleFiles) {
    const path = join(filesDir, name);
    writeFileSync(path, content, "utf8");
    const size = statSync(path).size;
    const existing = db.prepare("SELECT id FROM files WHERE path = ?").get(path) as { id: string } | undefined;
    if (!existing) db.prepare("INSERT INTO files (id, path, name, mime_type, size, metadata, created_at) VALUES (?, ?, ?, 'text/markdown', ?, ?, ?)").run(id("file"), path, name, size, json({ demo: true }), now);
  }

  db.prepare("INSERT INTO audit_logs (id, company_id, actor_type, actor_id, action, resource_type, resource_id, after_state, metadata, created_at) VALUES (?, ?, 'system', 'demo-script', 'demo_seeded', 'company', ?, ?, ?, ?)")
    .run(id("audit"), companyId, companyId, json({ name: "NovaStack AI", businessType: "Software startup", initialAgents: ["CEO Agent"] }), json({ script: "demo:software-company" }), now);
  db.close();

  console.log("Demo data seeded for NovaStack AI with only the CEO Agent active.");
  console.log(`Local demo admin password: ${demoPassword}`);
  console.log("Start the app with: corepack pnpm start");
}

main();
