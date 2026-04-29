import { getDb } from "../db/index.js";
import { safeJsonStringify } from "../utils/json.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { audit } from "../api/helpers.js";
import type { BaseTool, ToolContext } from "../tools/BaseTool.js";
import { FileTool } from "../tools/FileTool.js";
import { WebResearchTool } from "../tools/WebResearchTool.js";
import { DocumentTool } from "../tools/DocumentTool.js";
import { EmailDraftTool } from "../tools/EmailDraftTool.js";
import { HttpApiTool } from "../tools/HttpApiTool.js";
import { CodeSandboxTool } from "../tools/CodeSandboxTool.js";
import { SocialDraftTool } from "../tools/SocialDraftTool.js";
import { InvoiceTool } from "../tools/InvoiceTool.js";
import { LeadTrackerTool } from "../tools/LeadTrackerTool.js";
import { EmailSendTool } from "../tools/EmailSendTool.js";
import { SocialPublishTool } from "../tools/SocialPublishTool.js";
import { SearchTool } from "../tools/SearchTool.js";
import { ContentRepurposerTool } from "../tools/ContentRepurposerTool.js";
import { WikiTool } from "../tools/WikiTool.js";
import { LeadHunterTool } from "../tools/LeadHunterTool.js";
import { EmailOutreachTool } from "../tools/EmailOutreachTool.js";
import { AppError } from "../utils/errors.js";

const registry: Record<string, BaseTool> = {
  file_tool: new FileTool(),
  web_research: new WebResearchTool(),
  document_tool: new DocumentTool(),
  email_draft: new EmailDraftTool(),
  http_api: new HttpApiTool(),
  code_sandbox: new CodeSandboxTool(),
  social_draft: new SocialDraftTool(),
  invoice_tool: new InvoiceTool(),
  lead_tracker: new LeadTrackerTool(),
  lead_hunter: new LeadHunterTool(),
  email_outreach: new EmailOutreachTool(),
  email_send: new EmailSendTool(),
  social_publish: new SocialPublishTool(),
  google_search: new SearchTool(),
  content_repurposer: new ContentRepurposerTool(),
  company_wiki: new WikiTool()
};

export class ToolExecutor {
  getTool(name: string) {
    const tool = registry[name];
    if (!tool) throw new AppError("UNKNOWN_TOOL", "Requested tool is not installed", 400);
    const row = getDb().prepare("SELECT enabled FROM tools WHERE name = ?").get(name) as { enabled: number } | undefined;
    if (row && row.enabled !== 1) throw new AppError("TOOL_DISABLED", "This tool is disabled", 403);
    return tool;
  }

  async execute(toolName: string, input: Record<string, unknown>, context: ToolContext) {
    const tool = this.getTool(toolName);
    const toolCallId = id("tc");
    getDb().prepare("INSERT INTO tool_calls (id, run_id, agent_id, tool_name, input, status, risk_level, created_at) VALUES (?, ?, ?, ?, ?, 'running', ?, ?)").run(toolCallId, context.runId ?? null, context.agentId ?? null, toolName, safeJsonStringify(input), tool.riskLevel, nowIso());
    try {
      const result = await tool.execute(input, context);
      getDb().prepare("UPDATE tool_calls SET output = ?, status = 'completed' WHERE id = ?").run(safeJsonStringify(result.output), toolCallId);
      audit("tool_call_completed", "tool_call", toolCallId, { toolName, input, output: result.output });
      return result;
    } catch (error) {
      getDb().prepare("UPDATE tool_calls SET output = ?, status = 'failed' WHERE id = ?").run(error instanceof Error ? error.message : "Tool failed", toolCallId);
      throw error;
    }
  }
}
