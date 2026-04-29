import type { BaseTool, ToolContext, ToolResult } from "./BaseTool.js";
import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";

export class WikiTool implements BaseTool {
  name = "company_wiki";
  riskLevel = "low" as const;

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const action = String(input.action ?? "search");
    const db = getDb();

    switch (action) {
      case "save": {
        const title = String(input.title ?? "");
        const content = String(input.content ?? "");
        const category = String(input.category ?? "general");

        if (!title || !content) {
          return { output: { error: "Title and content are required to save to wiki" } };
        }

        // Check if page exists
        const existing = db.prepare("SELECT id FROM wiki_pages WHERE company_id = ? AND title = ?").get(context.companyId, title) as { id: string } | undefined;

        if (existing) {
          db.prepare("UPDATE wiki_pages SET content = ?, category = ?, updated_at = ? WHERE id = ?").run(content, category, nowIso(), existing.id);
          return { output: { action: "updated", title } };
        } else {
          db.prepare("INSERT INTO wiki_pages (id, company_id, title, content, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(id("wiki"), context.companyId, title, content, category, nowIso(), nowIso());
          return { output: { action: "saved", title } };
        }
      }

      case "search":
      default: {
        const query = String(input.query ?? "");
        const pages = db.prepare("SELECT title, content, category, updated_at FROM wiki_pages WHERE company_id = ? AND (title LIKE ? OR content LIKE ? OR category LIKE ?) LIMIT 5")
          .all(context.companyId, `%${query}%`, `%${query}%`, `%${query}%`) as any[];

        return { output: { results: pages, count: pages.length, query } };
      }
    }
  }
}
