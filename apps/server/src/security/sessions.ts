import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../utils/errors.js";
import { isValidSession } from "./localAuth.js";

export const sessionCookie = "acos_session";

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) out[key] = decodeURIComponent(rest.join("="));
  }
  return out;
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: string) {
  reply.header("Set-Cookie", `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Expires=${new Date(expiresAt).toUTCString()}`);
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.header("Set-Cookie", `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export async function requireAuth(request: FastifyRequest) {
  const cookies = parseCookies(request.headers.cookie);
  if (!isValidSession(cookies[sessionCookie])) {
    throw new AppError("UNAUTHENTICATED", "Local admin login is required", 401);
  }
}
