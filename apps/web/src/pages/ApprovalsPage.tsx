import { Check, ShieldAlert, X } from "lucide-react";
import { api, list } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";

const sections = [
  ["Agent hires pending", (approval: any) => approval.approval_type === "create_agent"],
  ["Tool actions pending", (approval: any) => approval.approval_type === "tool_call"],
  ["External communication pending", (approval: any) => /email|communication|post/i.test(`${approval.action_type} ${approval.action_description}`)],
  ["High-risk system actions", (approval: any) => approval.risk_level === "high" || /settings|shell|http|payment|contract/i.test(`${approval.action_type} ${approval.action_description}`)]
] as const;

export function ApprovalsPage({ companyId }: { companyId: string }) {
  const { data, refresh } = useApi(async () => {
    const [approvals, agents, audit] = await Promise.all(["approvals", "agents", "audit"].map((resource) => list<any>(resource)));
    return { approvals: approvals.filter((item) => item.company_id === companyId), agents: agents.filter((item) => item.company_id === companyId), audit: audit.filter((item) => item.company_id === companyId) };
  }, [companyId]);
  const decide = async (id: string, decision: "approved" | "rejected") => {
    await api(`/api/approvals/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) });
    await refresh();
  };
  const pending = data?.approvals.filter((approval) => approval.status === "pending") ?? [];
  return (
    <div>
      <PageHeader title="Approval Board" description="Review agent hires, tool calls, external communication, and high-risk system actions before they execute." />
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map(([title, predicate]) => {
          const approvals = pending.filter(predicate);
          return <Card key={title}><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><Badge tone={approvals.length ? "amber" : "green"}>{approvals.length}</Badge></div><div className="space-y-3">{approvals.map((approval) => <ApprovalCard key={approval.id} approval={approval} agent={data?.agents.find((agent) => agent.id === approval.agent_id)} audit={data?.audit ?? []} onApprove={() => decide(approval.id, "approved")} onReject={() => decide(approval.id, "rejected")} />)}{approvals.length === 0 && <p className="text-sm text-slate-400">Nothing waiting here.</p>}</div></Card>;
        })}
      </div>
      <Card className="mt-4"><h2 className="mb-3 font-semibold">Recent Decisions</h2><div className="grid gap-2">{(data?.approvals ?? []).filter((approval) => approval.status !== "pending").slice(0, 8).map((approval) => <div key={approval.id} className="flex items-center justify-between rounded-md border border-line bg-slate-950 px-3 py-2 text-sm"><span>{approval.action_description}</span><Badge tone={approval.status === "approved" ? "green" : "red"}>{approval.status}</Badge></div>)}</div></Card>
    </div>
  );
}

function ApprovalCard({ approval, agent, audit, onApprove, onReject }: { approval: any; agent?: any; audit: any[]; onApprove: () => void; onReject: () => void }) {
  const payload = parsePayload(approval.payload);
  return <div className="rounded-md border border-line bg-slate-950 p-3"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" /><div className="min-w-0 flex-1"><div className="font-medium">{payload.name || approval.action_description || approval.action_type}</div><div className="mt-1 text-sm text-slate-400">Requester: {agent?.name ?? "System"} · {approval.action_type}</div><div className="mt-2 flex flex-wrap gap-2"><Badge tone={approval.risk_level === "high" ? "red" : approval.risk_level === "medium" ? "amber" : "default"}>{approval.risk_level}</Badge><Badge>{approval.approval_type}</Badge>{payload.role && <Badge>{payload.role}</Badge>}{payload.model_provider && <Badge>{payload.model_provider}/{payload.model_name || "default"}</Badge>}</div>{approval.approval_type === "create_agent" && <div className="mt-3 grid gap-2 rounded-md border border-line bg-panel p-3 text-sm"><Info label="Employee" value={payload.name} /><Info label="Role" value={payload.role} /><Info label="Department" value={payload.department_name || "Proposed department"} /><Info label="Manager" value={payload.manager_name || "CEO Agent"} /><Info label="Permission" value={`Level ${payload.permission_level ?? 1}`} /><Info label="Tools" value={listValue(payload.tools)} /><Info label="Allowed" value={listValue(payload.allowed_actions)} /><Info label="Blocked" value={listValue(payload.blocked_actions)} /><p className="text-xs text-slate-400">{payload.creation_reason || payload.reason}</p></div>}<pre className="mt-3 max-h-24 overflow-auto rounded-md border border-line bg-panel p-2 text-xs text-slate-400">{approval.payload}</pre><div className="mt-2 text-xs text-slate-500">Audit events: {audit.filter((event) => event.resource_id === approval.id || event.resource_id === approval.agent_id).length}</div></div></div><div className="mt-3 flex justify-end gap-2"><Button onClick={onApprove}><Check className="h-4 w-4" />Approve</Button><Button variant="danger" onClick={onReject}><X className="h-4 w-4" />Reject</Button></div></div>;
}

function parsePayload(value: string) {
  try {
    return JSON.parse(value ?? "{}");
  } catch {
    return {};
  }
}

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.join(", ") : value;
    } catch {
      return value;
    }
  }
  return "None";
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-slate-500">{label}</span><span className="text-right text-slate-200">{value || "n/a"}</span></div>;
}
