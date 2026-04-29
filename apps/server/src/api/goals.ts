import type { FastifyInstance } from "fastify";
import { requireAuth } from "../security/sessions.js";
import { sendError } from "../utils/errors.js";
import { CEOPlanner } from "../engine/CEOPlanner.js";

export async function registerGoalRoutes(app: FastifyInstance) {
  app.post("/api/goals/:id/plan", async (request, reply) => {
    try {
      await requireAuth(request);
      const { id } = request.params as { id: string };
      const result = await new CEOPlanner().planGoal(id);
      return { data: result };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
