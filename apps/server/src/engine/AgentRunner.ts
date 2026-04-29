import { getDb, getSetting } from "../db/index.js";
import { createProvider } from "../ai/providers.js";
import type { AIMessage } from "../ai/providers.js";
import { safeJsonParse, safeJsonStringify } from "../utils/json.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { audit } from "../api/helpers.js";
import { AppError } from "../utils/errors.js";
import { ApprovalGate } from "./ApprovalGate.js";
import { MemoryManager } from "./MemoryManager.js";
import { ToolExecutor } from "./ToolExecutor.js";
import { emitRunEvent } from "../api/events.js";
import { resolveAgentModel } from "./modelResolver.js";
import { assertProviderReady } from "../ai/providerStatus.js";

type Row = Record<string, any>;

export class AgentRunner {
  async runTask(taskId: string) {
    const db = getDb();
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Row | undefined;
    if (!task) throw new AppError("TASK_NOT_FOUND", "Task was not found", 404);
    const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(task.company_id) as Row;
    if (company.emergency_stopped) throw new AppError("EMERGENCY_STOPPED", "Emergency stop is active", 423);
    const agent = db.prepare("SELECT * FROM agents WHERE id = COALESCE(?, (SELECT id FROM agents WHERE company_id = ? AND status = 'active' ORDER BY created_at LIMIT 1))").get(task.assigned_agent_id, task.company_id) as Row | undefined;
    if (!agent || agent.status !== "active") throw new AppError("NO_ACTIVE_AGENT", "Assign an active agent before running this task", 400);
    this.assertBudgetAvailable(company, agent);
    const model = resolveAgentModel(agent);
    assertProviderReady(model.provider, "run_agent");
    const runId = id("run");
    db.prepare("INSERT INTO runs (id, task_id, agent_id, company_id, status, input, started_at, created_at) VALUES (?, ?, ?, ?, 'running', ?, ?, ?)").run(runId, task.id, agent.id, task.company_id, task.description ?? task.title, nowIso(), nowIso());
    db.prepare("UPDATE tasks SET status = 'running', updated_at = ? WHERE id = ?").run(nowIso(), task.id);
    emitRunEvent(runId, { type: "run_started", runId, taskId, agentId: agent.id });
    audit("run_started", "run", runId, { taskId, agentId: agent.id });

    try {
      const memories = new MemoryManager().search(task.company_id, agent.id, `${task.title} ${task.description ?? ""}`);
      const tools = db.prepare("SELECT name, description, risk_level, requires_approval FROM tools WHERE enabled = 1").all();
      const system = this.buildPrompt({ task, agent, company, tools, memories });
      const provider = createProvider(model.provider);
      let messages: AIMessage[] = [
        { role: "system" as const, content: system },
        { role: "user" as const, content: `Task: ${task.title}\n\n${task.description ?? ""}` }
      ];
      const maxSteps = Number(getSetting("max_steps") ?? 4);
      let finalText = "";
      for (let step = 0; step < maxSteps; step += 1) {
        const result = await provider.generateText({ messages, model: model.name });
        finalText = result.text;
        this.addStep(runId, step, "model", result.text, { tokensUsed: result.tokensUsed, costEstimate: result.costEstimate, model });
        db.prepare("UPDATE runs SET tokens_used = tokens_used + ?, cost_estimate = cost_estimate + ? WHERE id = ?").run(Number(result.tokensUsed ?? 0), Number(result.costEstimate ?? 0), runId);
        const toolCall = extractToolCall(result.text);
        if (!toolCall) break;
        const tool = new ToolExecutor().getTool(toolCall.tool);
        const approval = new ApprovalGate().checkAndCreate({ companyId: task.company_id, taskId: task.id, runId, agentId: agent.id, approvalType: "tool_call", actionType: toolCall.tool, description: toolCall.reason, riskLevel: tool.riskLevel, payload: toolCall });
        if (approval.required) {
          db.prepare("UPDATE runs SET status = 'approval_needed', output = ? WHERE id = ?").run(result.text, runId);
          emitRunEvent(runId, { type: "approval_needed", runId, approvalId: approval.approvalId });
          return { runId, status: "approval_needed" };
        }
        const toolResult = await new ToolExecutor().execute(toolCall.tool, toolCall.input, { companyId: task.company_id, runId, agentId: agent.id });
        this.addStep(runId, step, "tool", safeJsonStringify(toolResult.output), { tool: toolCall.tool });
        messages = [...messages, { role: "assistant" as const, content: result.text }, { role: "user" as const, content: `Tool result for ${toolCall.tool}: ${safeJsonStringify(toolResult.output)}\nContinue or provide final output.` }];
      }
      const finalRun = db.prepare("SELECT cost_estimate FROM runs WHERE id = ?").get(runId) as { cost_estimate: number } | undefined;
      const cost = Number(finalRun?.cost_estimate ?? 0);
      db.prepare("UPDATE runs SET status = 'completed', output = ?, finished_at = ? WHERE id = ?").run(finalText, nowIso(), runId);
      db.prepare("UPDATE companies SET budget_used = COALESCE(budget_used, 0) + ?, updated_at = ? WHERE id = ?").run(cost, nowIso(), task.company_id);
      db.prepare("UPDATE agents SET budget_used = COALESCE(budget_used, 0) + ?, updated_at = ? WHERE id = ?").run(cost, nowIso(), agent.id);
      db.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?").run(getSetting("mark_task_done_after_run") === "true" ? "done" : "review", nowIso(), task.id);
      db.prepare("INSERT INTO work_products (id, company_id, task_id, run_id, agent_id, type, title, content, created_at) VALUES (?, ?, ?, ?, ?, 'run_output', ?, ?, ?)").run(id("wp"), task.company_id, task.id, runId, agent.id, task.title, finalText, nowIso());
      new MemoryManager().save(task.company_id, agent.id, `Outcome for ${task.title}: ${finalText.slice(0, 1200)}`, runId);
      emitRunEvent(runId, { type: "run_completed", runId });
      audit("run_completed", "run", runId, { output: finalText.slice(0, 1000) });
      return { runId, status: "completed" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Run failed";
      db.prepare("UPDATE runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?").run(message, nowIso(), runId);
      db.prepare("UPDATE tasks SET status = 'blocked', updated_at = ? WHERE id = ?").run(nowIso(), task.id);
      emitRunEvent(runId, { type: "run_failed", runId, error: message });
      audit("run_failed", "run", runId, { error: message });
      throw error;
    }
  }

  private buildPrompt(input: { task: Row; agent: Row; company: Row; tools: unknown[]; memories: unknown[] }) {
    return [
      `You are ${input.agent.name}, role: ${input.agent.role}.`,
      `Company: ${input.company.name}. ${input.company.description ?? ""}`,
      `Task context: ${input.task.title}. ${input.task.description ?? ""}`,
      `Available tools: ${safeJsonStringify(input.tools)}.`,
      `Allowed actions: ${input.agent.allowed_actions ?? "[]"}. Blocked actions: ${input.agent.blocked_actions ?? "[]"}.`,
      "Approval rules: risky actions, external mutations, shell/code execution, file overwrite/delete, email sending, settings changes, high-risk tools, and agent activation require human approval.",
      'If you need a tool, respond with only JSON: {"tool":"tool_name","reason":"why this tool is needed","input":{}}. Otherwise provide the final answer.',
      `Relevant memories: ${safeJsonStringify(input.memories)}`
    ].join("\n\n");
  }

  private addStep(runId: string, stepIndex: number, type: string, content: string, metadata?: unknown) {
    getDb().prepare("INSERT INTO run_steps (id, run_id, step_index, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id("step"), runId, stepIndex, type, content, metadata ? safeJsonStringify(metadata) : null, nowIso());
    emitRunEvent(runId, { type: "run_step", runId, stepIndex, stepType: type, content });
  }

  private assertBudgetAvailable(company: Row, agent: Row) {
    const companyBudget = Number(company.monthly_budget ?? 0);
    const companyUsed = Number(company.budget_used ?? 0);
    if (companyBudget > 0 && companyUsed >= companyBudget) {
      throw new AppError("COMPANY_BUDGET_EXCEEDED", `Company monthly budget is exhausted ($${companyUsed.toFixed(2)} used of $${companyBudget.toFixed(2)}). Increase the budget in Settings before running more tasks.`, 402);
    }
    const agentBudget = Number(agent.budget_limit ?? 0);
    const agentUsed = Number(agent.budget_used ?? 0);
    if (agentBudget > 0 && agentUsed >= agentBudget) {
      throw new AppError("AGENT_BUDGET_EXCEEDED", `${agent.name} has reached the per-agent budget limit ($${agentUsed.toFixed(2)} used of $${agentBudget.toFixed(2)}). Increase the agent budget before running this task.`, 402);
    }
  }

}

function extractToolCall(text: string): { tool: string; reason: string; input: Record<string, unknown> } | null {
  const trimmed = text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  const parsed = safeJsonParse<unknown>(trimmed, null);
  if (parsed && typeof parsed === "object" && "tool" in parsed) {
    const record = parsed as Record<string, unknown>;
    return { tool: String(record.tool), reason: String(record.reason ?? ""), input: typeof record.input === "object" && record.input ? (record.input as Record<string, unknown>) : {} };
  }
  return null;
}
