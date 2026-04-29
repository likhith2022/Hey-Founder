import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getConfig } from "../config.js";
import { getDb } from "../db/index.js";
import { safeName } from "../security/safePaths.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import type { BaseTool, ToolContext } from "./BaseTool.js";

export class DocumentTool implements BaseTool {
  name = "document_tool";
  riskLevel = "low" as const;
  async execute(input: Record<string, unknown>, context: ToolContext) {
    const title = String(input.title ?? "Agent Document");
    const content = String(input.content ?? "");
    const name = safeName(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.md`);
    const filePath = join(getConfig().paths.workProducts, name);
    writeFileSync(filePath, content, "utf8");
    const workProductId = id("wp");
    getDb().prepare("INSERT INTO work_products (id, company_id, run_id, agent_id, type, title, content, file_path, created_at) VALUES (?, ?, ?, ?, 'document', ?, ?, ?, ?)").run(workProductId, context.companyId, context.runId ?? null, context.agentId ?? null, title, content, filePath, nowIso());
    return { output: { filePath, title }, workProductId };
  }
}
