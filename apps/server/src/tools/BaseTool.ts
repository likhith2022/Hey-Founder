export type ToolContext = { companyId: string; runId?: string; agentId?: string };
export type ToolResult = { output: unknown; workProductId?: string };

export interface BaseTool {
  name: string;
  riskLevel: "low" | "medium" | "high";
  execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
