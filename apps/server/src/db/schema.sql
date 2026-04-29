PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, created_at TEXT, expires_at TEXT);
CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, business_description TEXT, industry TEXT, products_services TEXT, target_customers TEXT, current_problems TEXT, main_goals TEXT, preferred_tone TEXT, risk_tolerance TEXT DEFAULT 'medium', external_actions_require_approval INTEGER DEFAULT 1, autopilot_level INTEGER DEFAULT 0, emergency_stopped INTEGER DEFAULT 0, working_hours TEXT, monthly_budget REAL DEFAULT 0, budget_used REAL DEFAULT 0, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, department_id TEXT, manager_id TEXT, name TEXT NOT NULL, role TEXT NOT NULL, system_prompt TEXT NOT NULL, model_mode TEXT DEFAULT 'custom', model_provider TEXT, model_name TEXT, tools TEXT, permission_level INTEGER DEFAULT 1, budget_limit REAL DEFAULT 0, budget_used REAL DEFAULT 0, memory_scope TEXT DEFAULT 'company', allowed_actions TEXT, blocked_actions TEXT, created_by_type TEXT DEFAULT 'human', created_by_agent_id TEXT, creation_reason TEXT, status TEXT DEFAULT 'active', created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'active', priority TEXT DEFAULT 'medium', due_at TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, goal_id TEXT, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'planning', owner_agent_id TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, project_id TEXT, goal_id TEXT, assigned_agent_id TEXT, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'todo', priority TEXT DEFAULT 'medium', requires_approval INTEGER DEFAULT 0, created_by_type TEXT DEFAULT 'human', created_by_agent_id TEXT, due_at TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, task_id TEXT, agent_id TEXT, company_id TEXT, status TEXT DEFAULT 'queued', input TEXT, output TEXT, error TEXT, tokens_used INTEGER DEFAULT 0, cost_estimate REAL DEFAULT 0, started_at TEXT, finished_at TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS run_steps (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, step_index INTEGER, type TEXT, content TEXT, metadata TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS tool_calls (id TEXT PRIMARY KEY, run_id TEXT, agent_id TEXT, tool_name TEXT, input TEXT, output TEXT, status TEXT, risk_level TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, task_id TEXT, run_id TEXT, agent_id TEXT, approval_type TEXT NOT NULL, action_type TEXT, action_description TEXT, risk_level TEXT, payload TEXT, status TEXT DEFAULT 'pending', decision_note TEXT, created_at TEXT, decided_at TEXT);
CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, agent_id TEXT, name TEXT NOT NULL, cron TEXT NOT NULL, task_template TEXT, enabled INTEGER DEFAULT 1, missed_job_policy TEXT DEFAULT 'run_if_less_than_6_hours_late', last_run_at TEXT, next_run_at TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS tools (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT, enabled INTEGER DEFAULT 1, risk_level TEXT DEFAULT 'low', requires_approval INTEGER DEFAULT 0, config TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS secrets (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, type TEXT, provider TEXT, encrypted_value TEXT NOT NULL, iv TEXT NOT NULL, auth_tag TEXT NOT NULL, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, agent_id TEXT, scope TEXT, content TEXT NOT NULL, importance REAL DEFAULT 0.5, source_run_id TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, path TEXT NOT NULL, name TEXT NOT NULL, mime_type TEXT, size INTEGER, metadata TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS work_products (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, task_id TEXT, run_id TEXT, agent_id TEXT, type TEXT, title TEXT, content TEXT, file_path TEXT, metadata TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, company_id TEXT, actor_type TEXT, actor_id TEXT, action TEXT NOT NULL, resource_type TEXT, resource_id TEXT, before_state TEXT, after_state TEXT, metadata TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT, status TEXT DEFAULT 'queued', attempts INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 3, run_after TEXT, error TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, type TEXT, title TEXT, body TEXT, read INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS wiki_pages (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT, category TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT, company_name TEXT, email TEXT, linkedin_url TEXT, source_url TEXT, status TEXT DEFAULT 'new', notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, description TEXT, created_at TEXT);


CREATE INDEX IF NOT EXISTS idx_agents_company_id ON agents(company_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_task_id ON runs(task_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
