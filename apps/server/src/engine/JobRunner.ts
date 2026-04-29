import { getDb, getSetting } from "../db/index.js";
import { nowIso } from "../utils/time.js";
import { safeJsonParse } from "../utils/json.js";
import { AgentRunner } from "./AgentRunner.js";
import { DailyReport } from "./DailyReport.js";
import { ChiefOfStaff } from "./ChiefOfStaff.js";
import { log } from "../utils/logger.js";

export class JobRunner {
  private active = 0;
  private timer: NodeJS.Timeout | undefined;

  start() {
    this.timer = setInterval(() => void this.tick(), 2500);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    const db = getDb();
    const max = Number(getSetting("max_concurrent_runs") ?? process.env.MAX_CONCURRENT_RUNS ?? 2);
    const company = db.prepare("SELECT emergency_stopped FROM companies ORDER BY created_at LIMIT 1").get() as { emergency_stopped: number } | undefined;
    if (company?.emergency_stopped) {
      db.prepare("UPDATE jobs SET status = 'paused', updated_at = ? WHERE status = 'queued'").run(nowIso());
      return;
    }
    while (this.active < max) {
      const job = db.prepare("SELECT * FROM jobs WHERE status = 'queued' AND (run_after IS NULL OR run_after <= ?) ORDER BY created_at LIMIT 1").get(nowIso()) as any;
      if (!job) return;
      this.active += 1;
      db.prepare("UPDATE jobs SET status = 'running', attempts = attempts + 1, updated_at = ? WHERE id = ?").run(nowIso(), job.id);
      void this.run(job).finally(() => (this.active -= 1));
    }
  }

  private async run(job: any) {
    const db = getDb();
    try {
      const payload = safeJsonParse<any>(job.payload, {});
      if (job.type === "run_task") await new AgentRunner().runTask(payload.taskId);
      if (job.type === "daily_report") new DailyReport().create(payload.companyId);
      if (job.type === "executive_briefing") await new ChiefOfStaff().generateWeeklyBriefing(payload.companyId);
      db.prepare("UPDATE jobs SET status = 'completed', updated_at = ? WHERE id = ?").run(nowIso(), job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job failed";
      const status = job.attempts + 1 >= job.max_attempts ? "failed" : "queued";
      db.prepare("UPDATE jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?").run(status, message, nowIso(), job.id);
      log("error", "Job failed", { id: job.id, message });
    }
  }
}
