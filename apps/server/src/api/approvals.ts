import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { requireAuth } from "../security/sessions.js";
import { sendError, AppError } from "../utils/errors.js";
import { nowIso } from "../utils/time.js";
import { audit } from "./helpers.js";
import { AgentFactory } from "../engine/AgentFactory.js";

const decisionSchema = z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().optional() });

export async function registerApprovalRoutes(app: FastifyInstance) {
  app.post("/api/approvals/:id/decide", async (request, reply) => {
    try {
      await requireAuth(request);
      const { id } = request.params as { id: string };
      const body = decisionSchema.parse(request.body);
      const approval = getDb().prepare("SELECT * FROM approvals WHERE id = ?").get(id) as any;
      if (!approval) throw new AppError("NOT_FOUND", "Approval not found", 404);
      if (approval.status !== "pending") throw new AppError("APPROVAL_CLOSED", "Approval has already been decided", 409);
      getDb().prepare("UPDATE approvals SET status = ?, decision_note = ?, decided_at = ? WHERE id = ?").run(body.decision, body.note ?? null, nowIso(), id);
      if (approval.approval_type === "create_agent" || approval.action_type === "activate_agent") {
        if (body.decision === "approved" && approval.agent_id) new AgentFactory().activateApprovedAgent(approval.agent_id);
        if (body.decision === "rejected" && approval.agent_id) new AgentFactory().archiveAgent(approval.agent_id);
      }
      audit(`approval_${body.decision}`, "approval", id, { note: body.note });
      return { ok: true };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
