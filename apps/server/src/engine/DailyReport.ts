import { getDb, firstCompanyId } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { audit } from "../api/helpers.js";

export class DailyReport {
  create(companyId = firstCompanyId()) {
    if (!companyId) return null;
    const db = getDb();
    const completed = db.prepare("SELECT title FROM tasks WHERE company_id = ? AND status IN ('done','review') ORDER BY updated_at DESC LIMIT 10").all(companyId) as any[];
    const failed = db.prepare("SELECT error FROM runs WHERE company_id = ? AND status = 'failed' ORDER BY created_at DESC LIMIT 5").all(companyId) as any[];
    const approvals = db.prepare("SELECT action_description FROM approvals WHERE company_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 10").all(companyId) as any[];
    const blocked = db.prepare("SELECT title FROM tasks WHERE company_id = ? AND status = 'blocked' ORDER BY updated_at DESC LIMIT 10").all(companyId) as any[];
    const content = [
      "# Daily CEO Report",
      "",
      "## Completed or In Review",
      ...list(completed.map((x) => x.title)),
      "## Failed Runs",
      ...list(failed.map((x) => x.error)),
      "## Pending Approvals",
      ...list(approvals.map((x) => x.action_description)),
      "## Blocked Tasks",
      ...list(blocked.map((x) => x.title)),
      "## Suggested Next Actions",
      "- Review pending approvals.",
      "- Run blocked tasks after adding missing provider keys or clarifying requirements."
    ].join("\n");
    const workProductId = id("wp");
    db.prepare("INSERT INTO work_products (id, company_id, type, title, content, created_at) VALUES (?, ?, 'daily_report', 'Daily CEO Report', ?, ?)").run(workProductId, companyId, content, nowIso());
    audit("daily_report_created", "work_product", workProductId, { companyId });
    return { id: workProductId, content };
  }
}

function list(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`) : ["- None"];
}
