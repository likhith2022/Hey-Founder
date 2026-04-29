import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";

export class MemoryManager {
  search(companyId: string, agentId: string | null, text: string, limit = 6) {
    const terms = text.toLowerCase().split(/\W+/).filter((term) => term.length > 3).slice(0, 8);
    const rows = getDb().prepare("SELECT * FROM memories WHERE company_id = ? AND (agent_id IS NULL OR agent_id = ?) ORDER BY importance DESC, created_at DESC LIMIT 200").all(companyId, agentId) as Array<{ content: string }>;
    return rows
      .map((row) => ({ row, score: terms.reduce((sum, term) => sum + (row.content.toLowerCase().includes(term) ? 1 : 0), 0) }))
      .filter((item) => item.score > 0 || terms.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.row);
  }

  save(companyId: string, agentId: string | null, content: string, sourceRunId?: string) {
    if (!content.trim()) return;
    getDb().prepare("INSERT INTO memories (id, company_id, agent_id, scope, content, importance, source_run_id, created_at) VALUES (?, ?, ?, 'company', ?, 0.6, ?, ?)").run(id("mem"), companyId, agentId, content.slice(0, 4000), sourceRunId ?? null, nowIso());
  }
}
