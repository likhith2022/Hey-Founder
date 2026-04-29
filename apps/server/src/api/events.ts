import type { FastifyInstance, FastifyReply } from "fastify";
import { requireAuth } from "../security/sessions.js";
import { sendError } from "../utils/errors.js";

const listeners = new Map<string, Set<FastifyReply>>();

export function emitRunEvent(runId: string, event: unknown) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const reply of listeners.get(runId) ?? []) reply.raw.write(payload);
  for (const reply of listeners.get("*") ?? []) reply.raw.write(payload);
}

export async function registerEventRoutes(app: FastifyInstance) {
  app.get("/api/events/runs/:runId", async (request, reply) => {
    try {
      await requireAuth(request);
      const { runId } = request.params as { runId: string };
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      const set = listeners.get(runId) ?? new Set<FastifyReply>();
      set.add(reply);
      listeners.set(runId, set);
      reply.raw.write(`data: ${JSON.stringify({ type: "connected", runId })}\n\n`);
      request.raw.on("close", () => set.delete(reply));
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
