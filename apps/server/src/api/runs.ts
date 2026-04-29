import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../security/sessions.js";
import { sendError } from "../utils/errors.js";
import { AgentRunner } from "../engine/AgentRunner.js";
import { getDb } from "../db/index.js";

const runSchema = z.object({ taskId: z.string().min(1) });

export async function registerRunRoutes(app: FastifyInstance) {
  app.post("/api/runs/run-task", async (request, reply) => {
    try {
      await requireAuth(request);
      const body = runSchema.parse(request.body);
      const result = await new AgentRunner().runTask(body.taskId);
      return { data: result };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get("/api/runs/:id/steps", async (request, reply) => {
    try {
      await requireAuth(request);
      const { id } = request.params as { id: string };
      return { data: getDb().prepare("SELECT * FROM run_steps WHERE run_id = ? ORDER BY step_index, created_at").all(id) };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
