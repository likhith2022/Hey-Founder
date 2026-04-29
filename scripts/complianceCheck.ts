import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const excludedDirs = new Set(["node_modules", ".git", "dist", "data", "release", "test-results", "playwright-report"]);
const searchedTerms = [/paperclip/i, /paperclipai/i, /paperclip\.ing/i, /openclaw/i, /copied from/i, /adapted from/i, /inspired by/i];
const prohibitedUserFacing = [/paperclip clone/i, /paperclip replacement/i, /paperclip-compatible/i, /from paperclip/i, /affiliated with paperclip/i];
const allowedReferenceFiles = new Set(["LICENSE_COMPLIANCE.md", "THIRD_PARTY_NOTICES.md", "scripts/complianceCheck.ts"]);
const matches: string[] = [];
const prohibited: string[] = [];

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    if (excludedDirs.has(entry)) continue;
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path);
      continue;
    }
    if (stats.size > 1024 * 1024) continue;
    const rel = relative(root, path);
    if (/\.(png|jpg|jpeg|gif|webp|sqlite|zip|gz|tgz|woff2?)$/i.test(rel)) continue;
    const text = readFileSync(path, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (searchedTerms.some((term) => term.test(line))) matches.push(`${rel}:${index + 1}: ${line.trim()}`);
      if (!allowedReferenceFiles.has(rel) && prohibitedUserFacing.some((term) => term.test(line))) prohibited.push(`${rel}:${index + 1}: ${line.trim()}`);
    });
  }
}

walk(root);

const unexpected = matches.filter((line) => !allowedReferenceFiles.has(line.split(":")[0] ?? ""));

console.log("Compliance text scan");
console.log(`- Paperclip/OpenClaw/copying-reference matches: ${matches.length}`);
if (matches.length) matches.forEach((line) => console.log(`  ${line}`));
console.log(`- Unexpected references outside compliance docs: ${unexpected.length}`);
console.log(`- Prohibited branding phrases: ${prohibited.length}`);

if (unexpected.length || prohibited.length) {
  if (unexpected.length) console.error(`Unexpected references:\n${unexpected.join("\n")}`);
  if (prohibited.length) console.error(`Prohibited phrases:\n${prohibited.join("\n")}`);
  process.exit(1);
}

const license = spawnSync("corepack", ["pnpm", "license:check"], { encoding: "utf8", stdio: "inherit" });
if (license.status !== 0) process.exit(license.status ?? 1);

const lint = spawnSync("corepack", ["pnpm", "lint"], { encoding: "utf8", stdio: "inherit" });
if (lint.status !== 0) process.exit(lint.status ?? 1);

console.log("Compliance check passed.");
