import type { BaseTool, ToolContext, ToolResult } from "./BaseTool.js";
import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";

export class SocialDraftTool implements BaseTool {
  name = "social_draft";
  riskLevel = "low" as const;

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const topic = String(input.topic ?? "company update");
    const platform = String(input.platform ?? "linkedin").toLowerCase();
    const tone = String(input.tone ?? "professional");
    const keyPoints = Array.isArray(input.key_points) ? (input.key_points as string[]) : [];

    const drafts = generateDrafts(topic, platform, tone, keyPoints);

    const db = getDb();
    const wpId = id("wp");
    const content = formatDrafts(platform, drafts);

    db.prepare("INSERT INTO work_products (id, company_id, run_id, agent_id, type, title, content, created_at) VALUES (?, ?, ?, ?, 'social_post', ?, ?, ?)").run(wpId, context.companyId, context.runId ?? null, context.agentId ?? null, `Social post draft: ${topic}`, content, nowIso());

    return {
      output: { drafts, platform, charCount: drafts.map((d) => d.length), workProductId: wpId },
      workProductId: wpId
    };
  }
}

function generateDrafts(topic: string, platform: string, tone: string, keyPoints: string[]): string[] {
  const limit = platform === "twitter" || platform === "x" ? 280 : platform === "instagram" ? 2200 : 3000;
  const pointsBlock = keyPoints.length > 0 ? `\n${keyPoints.slice(0, 5).map((p) => `• ${p}`).join("\n")}` : "";
  const hashtags = platform !== "linkedin" ? "\n\n#growth #business #startup" : "";
  const cta = tone === "promotional" ? "\n\nLearn more →" : "\n\nThoughts? Drop a comment below.";

  const draft1 = `🚀 ${topic}${pointsBlock}${cta}${hashtags}`.slice(0, limit);
  const draft2 = `We've been working on something important: ${topic.toLowerCase()}.${pointsBlock ? `\n\nHere's what matters most:${pointsBlock}` : ""}${cta}${hashtags}`.slice(0, limit);
  return [draft1, draft2];
}

function formatDrafts(platform: string, drafts: string[]): string {
  return `# Social Post Drafts — ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n\n` +
    drafts.map((d, i) => `## Draft ${i + 1}\n\n${d}\n\n---`).join("\n");
}
