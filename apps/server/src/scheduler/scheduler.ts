import cron from "node-cron";
import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { safeJsonParse, safeJsonStringify } from "../utils/json.js";
import { audit } from "../api/helpers.js";

export function startScheduler() {
  const rows = getDb().prepare("SELECT * FROM schedules WHERE enabled = 1").all() as any[];
  for (const schedule of rows) {
    if (!cron.validate(schedule.cron)) continue;
    cron.schedule(schedule.cron, () => {
      const company = getDb().prepare("SELECT emergency_stopped FROM companies WHERE id = ?").get(schedule.company_id) as { emergency_stopped: number } | undefined;
      if (company?.emergency_stopped) {
        audit("schedule_skipped_emergency_stop", "schedule", schedule.id, { companyId: schedule.company_id });
        return;
      }
      const payload = safeJsonParse<any>(schedule.task_template, {});
      const type = payload.type === "daily_report" || /daily ceo report/i.test(schedule.name) ? "daily_report" : "run_task";
      getDb().prepare("INSERT INTO jobs (id, type, payload, status, attempts, max_attempts, created_at, updated_at) VALUES (?, ?, ?, 'queued', 0, 3, ?, ?)").run(id("job"), type, safeJsonStringify({ ...payload, companyId: schedule.company_id }), nowIso(), nowIso());
      getDb().prepare("UPDATE schedules SET last_run_at = ? WHERE id = ?").run(nowIso(), schedule.id);
      audit("schedule_executed", "schedule", schedule.id, { type });
    });
  }
}
