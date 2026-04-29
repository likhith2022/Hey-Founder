import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { safeJsonStringify } from "../utils/json.js";
import { audit } from "../api/helpers.js";
import { ApprovalGate } from "./ApprovalGate.js";
import { AppError } from "../utils/errors.js";

export type AgentConfig = {
  companyId: string;
  departmentId?: string | null;
  managerId?: string | null;
  name: string;
  role: string;
  systemPrompt: string;
  tools?: string[];
  permissionLevel?: number;
  allowedActions?: string[];
  blockedActions?: string[];
  modelProvider?: string;
  modelName?: string;
};

export class AgentFactory {
  validateAgentConfig(config: AgentConfig) {
    if (!config.name || !config.role || !config.systemPrompt) throw new AppError("INVALID_AGENT", "Agent name, role, and prompt are required", 400);
    if ((config.permissionLevel ?? 1) > 2) throw new AppError("INVALID_AGENT_PERMISSION", "New agents must start with conservative permissions", 400);
  }

  createHumanAgent(config: AgentConfig) {
    this.validateAgentConfig(config);
    return this.insertAgent(config, "human", "active", null, null);
  }

  proposeAgentFromCEO(config: AgentConfig, ceoAgentId: string, reason: string) {
    this.validateAgentConfig(config);
    const proposed = this.insertAgent({ ...config, permissionLevel: Math.min(config.permissionLevel ?? 1, 1), tools: (config.tools ?? []).filter((tool) => !["http_api", "code_sandbox"].includes(tool)) }, "agent", "pending_approval", ceoAgentId, reason);
    const gate = new ApprovalGate();
    gate.checkAndCreate({ companyId: config.companyId, agentId: proposed.id, approvalType: "create_agent", actionType: "activate_agent", description: `Activate CEO-proposed agent ${config.name}`, riskLevel: "medium", payload: proposed });
    return proposed;
  }

  activateApprovedAgent(agentId: string) {
    const row = getDb().prepare("SELECT * FROM agents WHERE id = ?").get(agentId);
    if (!row) throw new AppError("NOT_FOUND", "Agent not found", 404);
    getDb().prepare("UPDATE agents SET status = 'active', updated_at = ? WHERE id = ?").run(nowIso(), agentId);
    audit("agent_activated", "agent", agentId, { status: "active" }, row);
  }

  archiveAgent(agentId: string) {
    getDb().prepare("UPDATE agents SET status = 'archived', updated_at = ? WHERE id = ?").run(nowIso(), agentId);
    audit("agent_archived", "agent", agentId);
  }

  private insertAgent(config: AgentConfig, createdByType: "human" | "agent", status: string, createdByAgentId: string | null, reason: string | null) {
    const agentId = id("agent");
    const at = nowIso();
    const row = {
      id: agentId,
      company_id: config.companyId,
      department_id: config.departmentId ?? null,
      manager_id: config.managerId ?? null,
      name: config.name,
      role: config.role,
      system_prompt: config.systemPrompt,
      model_mode: config.modelProvider && config.modelName ? "custom" : "role_default",
      model_provider: config.modelProvider ?? null,
      model_name: config.modelName ?? null,
      tools: safeJsonStringify(config.tools ?? ["file_tool", "web_research", "document_tool"]),
      permission_level: config.permissionLevel ?? 1,
      allowed_actions: safeJsonStringify(config.allowedActions ?? ["research", "draft", "create_internal_work_product"]),
      blocked_actions: safeJsonStringify(config.blockedActions ?? ["send_email", "delete_files", "payments", "contracts"]),
      created_by_type: createdByType,
      created_by_agent_id: createdByAgentId,
      creation_reason: reason,
      status,
      created_at: at,
      updated_at: at
    };
    getDb().prepare("INSERT INTO agents (id, company_id, department_id, manager_id, name, role, system_prompt, model_mode, model_provider, model_name, tools, permission_level, allowed_actions, blocked_actions, created_by_type, created_by_agent_id, creation_reason, status, created_at, updated_at) VALUES (@id, @company_id, @department_id, @manager_id, @name, @role, @system_prompt, @model_mode, @model_provider, @model_name, @tools, @permission_level, @allowed_actions, @blocked_actions, @created_by_type, @created_by_agent_id, @creation_reason, @status, @created_at, @updated_at)").run(row);
    audit("agent_created", "agent", agentId, row);
    return row;
  }
}
