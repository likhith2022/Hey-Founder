import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { getDb, getSetting, setSetting } from "../db/index.js";
import { addDaysIso, nowIso } from "../utils/time.js";
import { id } from "../utils/ids.js";
import { getConfig } from "../config.js";

export async function setAdminPassword(password: string) {
  const hash = await bcrypt.hash(password, 12);
  setSetting("admin_password_hash", hash);
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const hash = getSetting("admin_password_hash");
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function hasAdminPassword(): boolean {
  return Boolean(getSetting("admin_password_hash"));
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(): { id: string; token: string; expiresAt: string } {
  const sessionId = id("session");
  const token = randomBytes(32).toString("hex");
  const expiresAt = addDaysIso(getConfig().sessionTtlDays);
  getDb().prepare("INSERT INTO sessions (id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)").run(sessionId, hashToken(token), nowIso(), expiresAt);
  return { id: sessionId, token, expiresAt };
}

export function destroySession(token: string | undefined) {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  const row = getDb().prepare("SELECT id FROM sessions WHERE token_hash = ? AND expires_at > ?").get(hashToken(token), nowIso());
  return Boolean(row);
}
