import type { FastifyInstance } from "fastify";
import { createWriteStream, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { requireAuth } from "../security/sessions.js";
import { safeName, safeResolve } from "../security/safePaths.js";
import { getConfig } from "../config.js";
import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { sendError } from "../utils/errors.js";
import { audit } from "./helpers.js";

export async function registerFileRoutes(app: FastifyInstance) {
  app.post("/api/files/upload", async (request, reply) => {
    try {
      await requireAuth(request);
      const file = await request.file();
      if (!file) return reply.status(400).send({ error: "NO_FILE", message: "Upload a file" });
      const name = safeName(file.filename);
      const fullPath = join(getConfig().paths.files, `${Date.now()}-${name}`);
      await pipeline(file.file, createWriteStream(fullPath, { flags: "wx" }));
      const size = statSync(fullPath).size;
      const fileId = id("file");
      getDb().prepare("INSERT INTO files (id, path, name, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(fileId, fullPath, name, file.mimetype, size, nowIso());
      audit("file_uploaded", "file", fileId, { name, size });
      return { data: { id: fileId, name, size } };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get("/api/files/:id/content", async (request, reply) => {
    try {
      await requireAuth(request);
      const row = getDb().prepare("SELECT * FROM files WHERE id = ?").get((request.params as { id: string }).id) as any;
      if (!row) return reply.status(404).send({ error: "NOT_FOUND", message: "File not found" });
      const path = safeResolve(getConfig().paths.files, row.path.replace(getConfig().paths.files, ""));
      return { data: { content: readFileSync(path, "utf8").slice(0, 50000) } };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
