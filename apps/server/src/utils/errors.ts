import type { FastifyReply } from "fastify";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function sendError(reply: FastifyReply, error: unknown) {
  if (reply.raw.headersSent) {
    // If headers already sent (e.g. SSE), we can't send a JSON error
    // Just end the stream with an error message if possible
    reply.raw.write(`data: ${JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "Unexpected error" })}\n\n`);
    reply.raw.end();
    return;
  }
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: error.code, message: error.message, ...error.details });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return reply.status(500).send({ error: "INTERNAL_ERROR", message });
}
