import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./index.js";

export function migrate() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, "schema.sql"), resolve(process.cwd(), "src/db/schema.sql")];
  const schemaPath = candidates.find((path) => {
    try {
      readFileSync(path);
      return true;
    } catch {
      return false;
    }
  });
  if (!schemaPath) throw new Error("schema.sql not found");
  getDb().exec(readFileSync(schemaPath, "utf8"));
  ensureColumn("companies", "monthly_budget", "REAL DEFAULT 0");
  ensureColumn("companies", "budget_used", "REAL DEFAULT 0");
  ensureColumn("companies", "business_description", "TEXT");
  ensureColumn("companies", "industry", "TEXT");
  ensureColumn("companies", "products_services", "TEXT");
  ensureColumn("companies", "target_customers", "TEXT");
  ensureColumn("companies", "current_problems", "TEXT");
  ensureColumn("companies", "main_goals", "TEXT");
  ensureColumn("companies", "preferred_tone", "TEXT");
  ensureColumn("companies", "risk_tolerance", "TEXT DEFAULT 'medium'");
  ensureColumn("companies", "external_actions_require_approval", "INTEGER DEFAULT 1");
  ensureColumn("agents", "budget_limit", "REAL DEFAULT 0");
  ensureColumn("agents", "budget_used", "REAL DEFAULT 0");
  ensureColumn("agents", "model_mode", "TEXT DEFAULT 'custom'");
  getDb().prepare("UPDATE agents SET model_mode = 'role_default', model_provider = NULL, model_name = NULL WHERE name = 'CEO Agent' AND role IN ('CEO', 'Plans company strategy, decomposes goals, proposes staff, and requests approval for risky work.') AND model_provider = 'openai' AND model_name = 'gpt-4o-mini'").run();
}

function ensureColumn(table: string, column: string, definition: string) {
  const exists = (getDb().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((row) => row.name === column);
  if (!exists) getDb().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
