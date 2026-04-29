import { useMemo, useState } from "react";
import { Activity, Filter } from "lucide-react";
import { list } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";

export function AuditLogsPage({ companyId }: { companyId: string }) {
  const { data } = useApi(() => list<any>("audit"), []);
  const [action, setAction] = useState("all");
  const [resource, setResource] = useState("all");
  const rows = useMemo(() => (data ?? []).filter((event) => (!event.company_id || event.company_id === companyId) && (action === "all" || event.action === action) && (resource === "all" || event.resource_type === resource)), [data, companyId, action, resource]);
  const actions = Array.from(new Set((data ?? []).map((event) => event.action).filter(Boolean)));
  const resources = Array.from(new Set((data ?? []).map((event) => event.resource_type).filter(Boolean)));
  return (
    <div>
      <PageHeader title="Audit Logs" description="Filterable local event timeline for approvals, runs, settings, files, backups, and safety blocks." />
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400"><Filter className="h-4 w-4 text-accent" />Filters</div>
          <label className="grid gap-1 text-sm"><span className="text-slate-400">Action</span><select className="input" value={action} onChange={(event) => setAction(event.target.value)}><option value="all">All actions</option>{actions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="grid gap-1 text-sm"><span className="text-slate-400">Resource</span><select className="input" value={resource} onChange={(event) => setResource(event.target.value)}><option value="all">All resources</option>{resources.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
      </Card>
      <Card>
        {rows.length ? <div className="relative grid gap-3 before:absolute before:left-3 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-line">{rows.slice(0, 120).map((event) => <div key={event.id} className="relative ml-8 rounded-md border border-line bg-slate-950 p-3"><span className="absolute -left-[26px] top-4 grid h-3 w-3 place-items-center rounded-full bg-sky-300" /><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-accent" /><span className="font-medium">{event.action}</span><Badge>{event.resource_type || "system"}</Badge></div><span className="text-xs text-slate-500">{event.created_at}</span></div><div className="mt-2 grid gap-1 text-sm text-slate-400 md:grid-cols-3"><span>Actor: {event.actor_type || "local system"}</span><span>Resource: {event.resource_id || "n/a"}</span><span>Company scoped: {event.company_id ? "yes" : "global"}</span></div>{event.metadata && <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-md bg-black/30 p-2 text-xs text-slate-500">{event.metadata}</pre>}</div>)}</div> : <p className="text-sm text-slate-400">No audit events match the current filters.</p>}
      </Card>
    </div>
  );
}
