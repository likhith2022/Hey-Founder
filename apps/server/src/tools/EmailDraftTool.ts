import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import type { BaseTool, ToolContext } from "./BaseTool.js";

export class EmailDraftTool implements BaseTool {
  name = "email_draft";
  riskLevel = "medium" as const;
  async execute(input: Record<string, unknown>, context: ToolContext) {
    const subject = String(input.subject ?? "Draft email");
    const content = `To: ${String(input.to ?? "")}\nSubject: ${subject}\n\n${String(input.body ?? input.content ?? "")}`;
    const workProductId = id("wp");
    getDb().prepare("INSERT INTO work_products (id, company_id, task_id, run_id, agent_id, type, title, content, created_at) VALUES (?, ?, ?, ?, ?, 'email_draft', ?, ?, ?)").run(workProductId, context.companyId, null, context.runId ?? null, context.agentId ?? null, subject, content, nowIso());
    return { output: { draft: content, note: "Draft created only. Email sending is not implemented in v1." }, workProductId };
  }
}
