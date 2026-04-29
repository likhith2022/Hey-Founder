import type { BaseTool, ToolContext, ToolResult } from "./BaseTool.js";
import { AppError } from "../utils/errors.js";
import { decryptSecret } from "../vault/localVault.js";
import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";

export class LeadHunterTool implements BaseTool {
  name = "lead_hunter";
  riskLevel = "low" as const;

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const query = String(input.query || input.q || "");
    if (!query) throw new AppError("VALIDATION_ERROR", "Search query is required", 400);

    const db = getDb();
    const secret = db.prepare("SELECT * FROM secrets WHERE provider = 'serper'").get() as any;
    let rawResults: any[] = [];
    
    if (secret) {
      const apiKey = decryptSecret(secret);
      try {
        const response = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q: query })
        });
        if (response.ok) {
          const data = await response.json();
          rawResults = (data.organic || []).map((res: any) => ({
            title: res.title,
            link: res.link,
            snippet: res.snippet
          }));
        }
      } catch (err) {
        console.error("Serper API failed in Lead Hunter", err);
      }
    }

    if (rawResults.length === 0) {
      // DuckDuckGo fallback
      try {
        const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const html = await response.text();
          const matches = [...html.matchAll(/class="result__a" href="([^"]+)">([^<]+)<\/a>/g)];
          rawResults = matches.slice(0, 5).map(m => ({
            title: m[2].trim(),
            link: m[1].startsWith("//") ? "https:" + m[1] : m[1],
            snippet: "Result found via open search."
          }));
        }
      } catch {}
    }

    // Lead extraction logic (simulated for now, but saves to DB)
    const newLeads: any[] = [];
    for (const res of rawResults) {
      // Basic pattern matching for common "Lead" identifiers
      if (res.title.includes("|") || res.title.includes("-")) {
        const [namePart, companyPart] = res.title.split(/[|-]/);
        const lead = {
          id: id("lead"),
          company_id: context.companyId,
          name: namePart?.trim() || "Unknown",
          company_name: companyPart?.trim() || "Unknown",
          source_url: res.link,
          status: "new",
          notes: res.snippet,
          created_at: nowIso(),
          updated_at: nowIso()
        };
        db.prepare("INSERT INTO leads (id, company_id, name, company_name, source_url, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(lead.id, lead.company_id, lead.name, lead.company_name, lead.source_url, lead.status, lead.notes, lead.created_at, lead.updated_at);
        newLeads.push(lead);
      }
    }

    return { 
      output: { 
        message: `Found ${rawResults.length} results and identified ${newLeads.length} potential leads.`,
        leadsFound: newLeads,
        totalResults: rawResults.length
      } 
    };
  }
}
