import { getDb, getSetting } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { safeJsonStringify } from "../utils/json.js";
import { JobRunner } from "./JobRunner.js";
import { log } from "../utils/logger.js";

export class AutopilotLoop {
  private chainTimer: NodeJS.Timeout | undefined;

  constructor(private jobs = new JobRunner()) {}

  start() {
    this.jobs.start();
    // Chain tick: every 5 seconds check for tasks that should auto-start
    this.chainTimer = setInterval(() => void this.chainTick(), 5000);
  }

  stop() {
    this.jobs.stop();
    if (this.chainTimer) clearInterval(this.chainTimer);
  }

  /**
   * Autopilot chain: when a task completes, look for the next todo task in the
   * same project and queue it automatically — if autopilot_level >= 1 and
   * max concurrent runs are not saturated.
   */
  private async chainTick() {
    try {
      const db = getDb();
      const max = Number(getSetting("max_concurrent_runs") ?? process.env.MAX_CONCURRENT_RUNS ?? 2);
      const running = (db.prepare("SELECT COUNT(*) as n FROM runs WHERE status = 'running'").get() as { n: number }).n;
      if (running >= max) return;

      // Find companies with autopilot enabled
      const companies = db.prepare("SELECT id, autopilot_level, emergency_stopped FROM companies WHERE autopilot_level >= 1 AND emergency_stopped = 0").all() as any[];

      for (const company of companies) {
        // Find recently completed tasks and check for next task in the same project
        const recentlyDone = db.prepare(`
          SELECT t.id as task_id, t.project_id
          FROM tasks t
          WHERE t.company_id = ?
            AND t.status = 'done'
            AND t.project_id IS NOT NULL
            AND t.updated_at >= datetime('now', '-60 seconds')
          ORDER BY t.updated_at DESC
          LIMIT 5
        `).all(company.id) as Array<{ task_id: string; project_id: string }>;

        for (const done of recentlyDone) {
          if (!done.project_id) continue;
          const next = db.prepare(`
            SELECT id, title FROM tasks
            WHERE company_id = ? AND project_id = ? AND status = 'todo'
            ORDER BY created_at ASC LIMIT 1
          `).get(company.id, done.project_id) as { id: string; title: string } | undefined;

          if (!next) continue;

          // Make sure it isn't already queued
          const alreadyQueued = db.prepare("SELECT id FROM jobs WHERE payload LIKE ? AND status IN ('queued', 'running')").get(`%${next.id}%`);
          if (alreadyQueued) continue;

          const currentRunning = (db.prepare("SELECT COUNT(*) as n FROM runs WHERE status = 'running'").get() as { n: number }).n;
          if (currentRunning >= max) break;

          log("info", `AutopilotLoop: chaining task "${next.title}" (project: ${done.project_id})`);
          db.prepare("INSERT INTO jobs (id, type, payload, status, attempts, max_attempts, created_at, updated_at) VALUES (?, 'run_task', ?, 'queued', 0, 3, ?, ?)").run(id("job"), safeJsonStringify({ taskId: next.id }), nowIso(), nowIso());
        }
      }
    } catch (err) {
      log("error", "AutopilotLoop chain tick failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }
}
