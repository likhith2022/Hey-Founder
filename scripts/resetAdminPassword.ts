import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(process.env.DATA_DIR ?? join(root, "data"));
const dbPath = join(dataDir, "ai-company-os.sqlite");

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error('Usage: corepack pnpm admin:reset-password "new-password"');
    console.error("No password was changed.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("New local admin password must be at least 10 characters.");
    process.exit(1);
  }
  if (!existsSync(dbPath)) {
    console.log("No existing local setup found. Start the app and complete setup first.");
    return;
  }
  const db = new Database(dbPath);
  try {
    const hasCompany = Boolean(db.prepare("SELECT id FROM companies LIMIT 1").get());
    const hasSettings = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get());
    if (!hasCompany || !hasSettings) {
      console.log("No existing local setup found. Start the app and complete setup first.");
      return;
    }
    const hash = await bcrypt.hash(password, 12);
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('admin_password_hash', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(hash, new Date().toISOString());
    db.prepare("DELETE FROM sessions").run();
    console.log("Local admin password reset successfully.");
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Password reset failed.");
  process.exit(1);
});

