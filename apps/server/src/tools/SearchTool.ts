import type { BaseTool, ToolContext, ToolResult } from "./BaseTool.js";
import { AppError } from "../utils/errors.js";
import { decryptSecret } from "../vault/localVault.js";
import { getDb } from "../db/index.js";

export class SearchTool implements BaseTool {
  name = "google_search";
  riskLevel = "low" as const;

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const query = String(input.query || input.q || "");
    if (!query) throw new AppError("VALIDATION_ERROR", "Search query is required", 400);

    const secret = getDb().prepare("SELECT * FROM secrets WHERE provider = 'serper'").get() as any;
    
    if (secret) {
      const apiKey = decryptSecret(secret);
      try {
        const response = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ q: query })
        });
        
        if (response.ok) {
          const data = await response.json();
          const results = (data.organic || []).map((res: any) => ({
            title: res.title,
            link: res.link,
            snippet: res.snippet
          }));
          return { output: { results } };
        }
      } catch (err) {
        console.error("Serper API failed, falling back to simulated search", err);
      }
    }

    // Fallback: Real-time search via DuckDuckGo (no key required)
    console.log(`[Search] No Serper key, falling back to DuckDuckGo: ${query}`);
    try {
      const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const html = await response.text();
        // Simple regex to extract search result titles and links
        const matches = [...html.matchAll(/class="result__a" href="([^"]+)">([^<]+)<\/a>/g)];
        const results = matches.slice(0, 5).map(m => ({
          title: m[2].trim(),
          link: m[1].startsWith("//") ? "https:" + m[1] : m[1],
          snippet: "Result found via open search."
        }));
        
        if (results.length > 0) return { output: { results, source: "duckduckgo" } };
      }
    } catch (err) {
      console.error("DuckDuckGo fallback failed", err);
    }

    return { 
      output: { 
        results: [], 
        warning: "Internet search unavailable. Connect Serper in API Keys for professional real-time results." 
      } 
    };
  }
}
