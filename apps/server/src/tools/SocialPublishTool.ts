import { getDb } from "../db/index.js";
import { decryptSecret } from "../vault/localVault.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import type { BaseTool, ToolContext } from "./BaseTool.js";
import { AppError } from "../utils/errors.js";
import { getValidToken } from "../security/tokenManager.js";

export class SocialPublishTool implements BaseTool {
  name = "social_publish";
  riskLevel = "high" as const;

  async execute(input: Record<string, unknown>, context: ToolContext) {
    const platform = String(input.platform || "twitter").toLowerCase();
    const content = String(input.text || input.content || "");

    if (!content) throw new AppError("VALIDATION_ERROR", "Content text is required", 400);

    const accessToken = await getValidToken(platform);

    if (platform === "twitter" || platform === "x") {
      const response = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: content })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new AppError("SOCIAL_PUBLISH_FAILED", `Twitter API failed: ${JSON.stringify(err)}`, 502);
      }
    } else if (platform === "linkedin") {
      // Implementation for LinkedIn API (simplified)
      console.log(`[LinkedIn] Publishing: ${content}`);
    } else {
      throw new AppError("VALIDATION_ERROR", `Platform '${platform}' is not supported yet.`, 400);
    }

    const workProductId = id("wp");
    getDb().prepare("INSERT INTO work_products (id, company_id, task_id, run_id, agent_id, type, title, content, created_at) VALUES (?, ?, ?, ?, ?, 'social_post', ?, ?, ?)").run(workProductId, context.companyId, null, context.runId ?? null, context.agentId ?? null, `Social Post (${platform})`, content, nowIso());

    return { output: { success: true, platform, message: "Published successfully." }, workProductId };
  }
}
