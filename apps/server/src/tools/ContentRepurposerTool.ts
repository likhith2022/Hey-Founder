import type { BaseTool, ToolContext, ToolResult } from "./BaseTool.js";
import { AppError } from "../utils/errors.js";

export class ContentRepurposerTool implements BaseTool {
  name = "content_repurposer";
  riskLevel = "low" as const;

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const content = String(input.content || "");
    const formats = (input.formats as string[]) || ["twitter", "linkedin", "email"];

    if (!content) throw new AppError("VALIDATION_ERROR", "Source content is required for repurposing.", 400);

    // This tool is essentially a "Prompting Wrapper" that helps the agent
    // think about different formats. The agent actually does the heavy lifting
    // using its own LLM capabilities. This tool provides the structure.
    
    return { 
      output: { 
        status: "ready_to_transform",
        instructions: `Please transform the provided source content into the following formats: ${formats.join(", ")}. Ensure each output follows platform-specific best practices (e.g., hashtags for Twitter, professional tone for LinkedIn).`,
        source_preview: content.slice(0, 100) + "..."
      } 
    };
  }
}
