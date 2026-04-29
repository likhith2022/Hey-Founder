import type { BaseTool } from "./BaseTool.js";
import { AppError } from "../utils/errors.js";
import type { ToolContext, ToolResult } from "./BaseTool.js";

export class CodeSandboxTool implements BaseTool {
  name = "code_sandbox";
  riskLevel = "high" as const;
  async execute(_input: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    throw new AppError("APPROVAL_REQUIRED", "Shell/code execution requires explicit human approval and is disabled by default in v1", 403);
  }
}
