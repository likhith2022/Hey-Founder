import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { audit } from "../api/helpers.js";
import { AppError } from "../utils/errors.js";
import { safeJsonParse } from "../utils/json.js";

export type SOPStep = { title: string; description?: string; agent_role_hint?: string; priority?: string };
export type SOP = { id: string; name: string; steps: SOPStep[] };

export class SOPRunner {
  run(sopWorkProductId: string, companyId: string) {
    const db = getDb();
    const wpRow = db.prepare("SELECT * FROM work_products WHERE id = ? AND type = 'sop'").get(sopWorkProductId) as any;
    if (!wpRow) throw new AppError("SOP_NOT_FOUND", "SOP work product not found", 404);

    const sop: SOP = safeJsonParse(wpRow.content, { id: wpRow.id, name: wpRow.title, steps: [] });
    if (!sop.steps || sop.steps.length === 0) throw new AppError("SOP_EMPTY", "SOP has no steps defined", 400);

    const activeAgents = db.prepare("SELECT * FROM agents WHERE company_id = ? AND status = 'active' ORDER BY created_at").all(companyId) as any[];
    const createdTasks: string[] = [];

    for (const step of sop.steps) {
      const bestAgent = this.pickAgent(activeAgents, step.agent_role_hint ?? step.title);
      const taskId = id("task");
      db.prepare("INSERT INTO tasks (id, company_id, assigned_agent_id, title, description, status, priority, created_by_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'todo', ?, 'agent', ?, ?)").run(taskId, companyId, bestAgent?.id ?? null, step.title, step.description ?? `SOP step: ${step.title}`, step.priority ?? "medium", nowIso(), nowIso());
      createdTasks.push(taskId);
    }

    audit("sop_run_started", "work_product", sopWorkProductId, { sopName: sop.name, tasks: createdTasks, companyId });
    return { sopName: sop.name, tasks: createdTasks, agentsAssigned: activeAgents.length };
  }

  createSOP(companyId: string, name: string, steps: SOPStep[], agentId?: string) {
    const db = getDb();
    const sop: SOP = { id: id("sop"), name, steps };
    const wpId = id("wp");
    db.prepare("INSERT INTO work_products (id, company_id, agent_id, type, title, content, created_at) VALUES (?, ?, ?, 'sop', ?, ?, ?)").run(wpId, companyId, agentId ?? null, name, JSON.stringify(sop), nowIso());
    audit("sop_created", "work_product", wpId, { name, steps: steps.length, companyId });
    return { id: wpId, name, steps: steps.length };
  }

  private pickAgent(agents: any[], hint: string) {
    const h = hint.toLowerCase();
    if (/finance|invoice|payment|accounting/.test(h)) return agents.find((a) => /finance|ops/i.test(`${a.name} ${a.role}`)) ?? agents[0];
    if (/marketing|content|social|campaign/.test(h)) return agents.find((a) => /marketing|content/i.test(`${a.name} ${a.role}`)) ?? agents[0];
    if (/sales|lead|proposal|outreach/.test(h)) return agents.find((a) => /sales/i.test(`${a.name} ${a.role}`)) ?? agents[0];
    if (/support|faq|customer/.test(h)) return agents.find((a) => /support|ops/i.test(`${a.name} ${a.role}`)) ?? agents[0];
    return agents.find((a) => /operations|ceo/i.test(`${a.name} ${a.role}`)) ?? agents[0];
  }
}
