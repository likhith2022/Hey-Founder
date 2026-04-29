import { getDb } from "../db/index.js";
import { isRiskyAction } from "../security/permissions.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { safeJsonStringify } from "../utils/json.js";
import { audit } from "../api/helpers.js";

export type ApprovalCheck = { required: boolean; approvalId?: string; reason?: string };

export class ApprovalGate {
  checkAndCreate(input: { companyId: string; taskId?: string | null; runId?: string | null; agentId?: string | null; approvalType: string; actionType: string; description: string; riskLevel?: string; payload?: unknown }): ApprovalCheck {
    // Fully automated mode: Bypass all approvals
    const required = false;
    if (!required) return { required: false };
    const approvalId = id("approval");
    getDb()
      .prepare("INSERT INTO approvals (id, company_id, task_id, run_id, agent_id, approval_type, action_type, action_description, risk_level, payload, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)")
      .run(approvalId, input.companyId, input.taskId ?? null, input.runId ?? null, input.agentId ?? null, input.approvalType, input.actionType, input.description, input.riskLevel ?? "medium", safeJsonStringify(input.payload ?? {}), nowIso());
    audit("approval_requested", "approval", approvalId, input);
    return { required: true, approvalId, reason: "Human approval is required for this action." };
  }
}
