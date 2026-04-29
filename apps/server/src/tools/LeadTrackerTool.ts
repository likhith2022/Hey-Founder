import type { BaseTool, ToolContext, ToolResult } from "./BaseTool.js";
import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { safeJsonParse, safeJsonStringify } from "../utils/json.js";

export type Lead = {
  id: string;
  name: string;
  company: string;
  email?: string;
  status: "prospect" | "contacted" | "qualified" | "closed_won" | "closed_lost";
  notes?: string;
  created_at: string;
  updated_at: string;
};

export class LeadTrackerTool implements BaseTool {
  name = "lead_tracker";
  riskLevel = "low" as const;

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const action = String(input.action ?? "list");
    const db = getDb();

    // Leads stored as a single work_product of type "lead_database"
    let wpRow = db.prepare("SELECT id, content FROM work_products WHERE company_id = ? AND type = 'lead_database' ORDER BY created_at LIMIT 1").get(context.companyId) as { id: string; content: string } | undefined;
    let leads: Lead[] = wpRow ? (safeJsonParse<Lead[]>(wpRow.content, [])) : [];

    switch (action) {
      case "add": {
        const lead: Lead = {
          id: id("lead"),
          name: String(input.name ?? ""),
          company: String(input.company ?? ""),
          email: input.email ? String(input.email) : undefined,
          status: (input.status as Lead["status"]) ?? "prospect",
          notes: input.notes ? String(input.notes) : undefined,
          created_at: nowIso(),
          updated_at: nowIso()
        };
        leads.push(lead);
        this.save(db, context.companyId, leads, wpRow?.id);
        return { output: { action: "added", lead } };
      }

      case "update": {
        const leadId = String(input.lead_id ?? "");
        const idx = leads.findIndex((l) => l.id === leadId);
        if (idx === -1) return { output: { error: "Lead not found", lead_id: leadId } };
        leads[idx] = { ...leads[idx], ...{ status: input.status as Lead["status"] ?? leads[idx].status, notes: input.notes ? String(input.notes) : leads[idx].notes, updated_at: nowIso() } };
        this.save(db, context.companyId, leads, wpRow?.id);
        return { output: { action: "updated", lead: leads[idx] } };
      }

      case "list":
      default: {
        const status = input.status ? String(input.status) : null;
        const filtered = status ? leads.filter((l) => l.status === status) : leads;
        return { output: { leads: filtered, total: filtered.length } };
      }
    }
  }

  private save(db: any, companyId: string, leads: Lead[], existingId?: string) {
    const content = safeJsonStringify(leads);
    if (existingId) {
      db.prepare("UPDATE work_products SET content = ?, updated_at = ? WHERE id = ?").run(content, nowIso(), existingId);
    } else {
      db.prepare("INSERT INTO work_products (id, company_id, type, title, content, created_at) VALUES (?, ?, 'lead_database', 'Lead Pipeline', ?, ?)").run(id("wp"), companyId, content, nowIso());
    }
  }
}
