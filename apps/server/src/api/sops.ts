import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../security/sessions.js";
import { sendError } from "../utils/errors.js";
import { SOPRunner } from "../engine/SOPRunner.js";

const sopStepSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  agent_role_hint: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional()
});

export async function registerSOPRoutes(app: FastifyInstance) {
  // Create a new SOP
  app.post("/api/sops", async (request, reply) => {
    try {
      await requireAuth(request);
      const { company_id, name, steps } = request.body as { company_id: string; name: string; steps: any[] };
      const parsed = z.array(sopStepSchema).safeParse(steps);
      if (!parsed.success) return reply.status(400).send({ error: "INVALID_STEPS", message: "Invalid SOP steps format" });
      return { data: new SOPRunner().createSOP(company_id, name, parsed.data) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Run a SOP
  app.post("/api/sops/:id/run", async (request, reply) => {
    try {
      await requireAuth(request);
      const { id } = request.params as { id: string };
      const { company_id } = request.body as { company_id: string };
      return { data: new SOPRunner().run(id, company_id) };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
