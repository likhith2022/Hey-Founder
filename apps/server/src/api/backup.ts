import type { FastifyInstance } from "fastify";
import { existsSync, copyFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { requireAuth } from "../security/sessions.js";
import { getConfig } from "../config.js";
import { id } from "../utils/ids.js";
import { sendError } from "../utils/errors.js";
import { audit } from "./helpers.js";

export async function registerBackupRoutes(app: FastifyInstance) {
  app.post("/api/backup", async (request, reply) => {
    try {
      await requireAuth(request);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dest = join(getConfig().paths.backups, `backup-${stamp}`);
      mkdirSync(dest, { recursive: true });
      copyFileSync(getConfig().paths.db, join(dest, "ai-company-os.sqlite"));
      copyDir(getConfig().paths.files, join(dest, "files"));
      copyDir(getConfig().paths.workProducts, join(dest, "work-products"));
      copyDir(getConfig().paths.logs, join(dest, "logs"));
      audit("backup_created", "backup", id("backup"), { path: dest });
      return { data: { path: dest } };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get("/api/backup", async (request, reply) => {
    try {
      await requireAuth(request);
      const rows = readdirSync(getConfig().paths.backups, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
        const path = join(getConfig().paths.backups, d.name);
        return { name: d.name, path, created_at: statSync(path).birthtime.toISOString() };
      });
      return { data: rows };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}

function copyDir(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  if (!existsSync(src)) return;
  for (const item of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, item.name);
    const to = join(dest, item.name);
    if (item.isDirectory()) copyDir(from, to);
    else copyFileSync(from, to);
  }
}
