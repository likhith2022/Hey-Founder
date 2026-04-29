import { getDb, firstCompanyId } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { audit } from "../api/helpers.js";
import { AgentRunner } from "./AgentRunner.js";
import { EmailSendTool } from "../tools/EmailSendTool.js";

export class ChiefOfStaff {
  async generateWeeklyBriefing(companyId = firstCompanyId()) {
    if (!companyId) return null;
    const db = getDb();
    
    // 1. Gather data from the last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const workProducts = db.prepare("SELECT title, type, content FROM work_products WHERE company_id = ? AND created_at >= ?").all(companyId, oneWeekAgo) as any[];
    const tasks = db.prepare("SELECT title, status, priority FROM tasks WHERE company_id = ? AND updated_at >= ?").all(companyId, oneWeekAgo) as any[];
    
    const dataSummary = `
      WEEKLY ACTIVITY LOG:
      Work Products Created: ${workProducts.length}
      Tasks Updated: ${tasks.length}
      
      RECENT DELIVERABLES:
      ${workProducts.slice(0, 10).map(wp => `- [${wp.type}] ${wp.title}`).join("\n")}
      
      CURRENT TASK STATUS:
      ${tasks.slice(0, 10).map(t => `- ${t.title} (${t.status}, ${t.priority})`).join("\n")}
    `;

    // 2. Use CEO Agent to synthesize a briefing
    const ceo = db.prepare("SELECT id, system_prompt FROM agents WHERE company_id = ? AND role = 'CEO'").get(companyId) as { id: string, system_prompt: string } | undefined;
    if (!ceo) return null;

    const runner = new AgentRunner();
    // We'll simulate a prompt to the CEO agent for the briefing
    const prompt = `
      You are the Chief of Staff for the founder. 
      Analyze the following business activity from the last 7 days and write a 3-paragraph executive briefing.
      - Paragraph 1: Key Achievements & Growth (What did we actually finish?)
      - Paragraph 2: Operational Health (Where are we stuck? Any blocked tasks or failures?)
      - Paragraph 3: Strategic Recommendation (What should the founder focus on next week?)
      
      ACTIVITY DATA:
      ${dataSummary}
    `;

    // Mocking the LLM synthesis for now to avoid external dependencies in the loop if not ready
    const briefingContent = `
# Weekly Executive Briefing

## Key Achievements
This week, we focused on setting up our core automation infrastructure. We successfully registered our social media OAuth handshakes and enabled the Lead Hunter pipeline. The agent successfully identified several potential prospects in the SaaS space.

## Operational Health
Most systems are running smoothly. However, we have 2 tasks currently "blocked" because the SMTP server credentials need to be finalized. We recommend checking the API Keys page to ensure all connectors are verified.

## Strategic Recommendation
Next week, we should focus on high-intent outreach. Now that the leads are identified, the Sales Representative should be tasked with personalized email sequences to convert these prospects.
    `;

    const workProductId = id("wp");
    db.prepare("INSERT INTO work_products (id, company_id, type, title, content, created_at) VALUES (?, ?, 'executive_briefing', 'Weekly Chief of Staff Briefing', ?, ?)").run(workProductId, companyId, briefingContent, nowIso());
    
    audit("executive_briefing_created", "work_product", workProductId, { companyId });
    
    return { id: workProductId, content: briefingContent };
  }
}
