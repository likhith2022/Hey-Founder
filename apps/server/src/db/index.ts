import Database from "better-sqlite3";
import { getConfig } from "../config.js";

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getConfig().paths.db);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(key, value, new Date().toISOString());
}

export function firstCompanyId(): string | null {
  const row = getDb().prepare("SELECT id FROM companies ORDER BY created_at LIMIT 1").get() as { id: string } | undefined;
  return row?.id ?? null;
}
