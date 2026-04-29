import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getConfig } from "../config.js";
import { safeName, safeResolve } from "../security/safePaths.js";
import { AppError } from "../utils/errors.js";
import type { BaseTool, ToolContext } from "./BaseTool.js";

export class FileTool implements BaseTool {
  name = "file_tool";
  riskLevel = "low" as const;
  async execute(input: Record<string, unknown>, _context: ToolContext) {
    const action = String(input.action ?? "list");
    const paths = getConfig().paths;
    if (action === "list") return { output: readdirSync(paths.files, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name) };
    if (action === "read") {
      const file = safeResolve(paths.files, String(input.path ?? ""));
      return { output: readFileSync(file, "utf8").slice(0, 20000) };
    }
    if (action === "write") {
      const name = safeName(String(input.name ?? "agent-output.md"));
      const file = join(paths.workProducts, name);
      if (existsSync(file)) throw new AppError("FILE_EXISTS", "Refusing to overwrite a work product without approval", 409);
      writeFileSync(file, String(input.content ?? ""), "utf8");
      return { output: { path: file, name } };
    }
    throw new AppError("UNSUPPORTED_FILE_ACTION", "File tool supports list, read, and write only", 400);
  }
}
