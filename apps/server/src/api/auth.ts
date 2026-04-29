import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSession, destroySession, hasAdminPassword, verifyAdminPassword } from "../security/localAuth.js";
import { clearSessionCookie, parseCookies, sessionCookie, setSessionCookie } from "../security/sessions.js";
import { sendError, AppError } from "../utils/errors.js";
import { getDb } from "../db/index.js";

const loginSchema = z.object({ password: z.string().min(1) });

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      const hasCompany = Boolean(getDb().prepare("SELECT id FROM companies LIMIT 1").get());
      if (hasCompany && !hasAdminPassword()) throw new AppError("ADMIN_PASSWORD_MISSING", "Local admin password is missing. Reset it using admin:reset-password.", 500);
      if (!(await verifyAdminPassword(body.password))) throw new AppError("INVALID_LOGIN", "Password is incorrect", 401);
      const session = createSession();
      setSessionCookie(reply, session.token, session.expiresAt);
      return { ok: true };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const cookies = parseCookies(request.headers.cookie);
    destroySession(cookies[sessionCookie]);
    clearSessionCookie(reply);
    return { ok: true };
  });
}
