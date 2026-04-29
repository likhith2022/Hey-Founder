import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(process.env.DATA_DIR ?? join(root, "data"));

for (const file of ["ai-company-os.sqlite", "ai-company-os.sqlite-wal", "ai-company-os.sqlite-shm", ".vault-key"]) {
  rmSync(join(dataDir, file), { force: true });
}

for (const dir of ["files", "work-products", "backups", "logs", "sandbox"]) {
  rmSync(join(dataDir, dir), { recursive: true, force: true });
  mkdirSync(join(dataDir, dir), { recursive: true });
  writeFileSync(join(dataDir, dir, ".gitkeep"), "\n");
}

console.log("Demo data reset. Run corepack pnpm demo:software-company to seed it again.");
