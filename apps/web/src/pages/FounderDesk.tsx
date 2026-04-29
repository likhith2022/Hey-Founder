import { AlertTriangle, PauseCircle, Sparkles, ChevronRight } from "lucide-react";
import { useState } from "react";
import { api, list } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";

export function FounderDesk({ companyId, onOpenModelManager }: { companyId: string; onOpenModelManager?: () => void }) {
  const [buildError, setBuildError] = useState<any>(null);
  const { data, refresh } = useApi(async () => {
    const [settings, agents, tasks, runs, approvals, products] = await Promise.all([api<any>("/api/settings"), list<any>("agents"), list<any>("tasks"), list<any>("runs"), list<any>("approvals"), list<any>("work-products")]);
    return { settings: settings.data, agents: agents.filter((item) => item.company_id === companyId), tasks: tasks.filter((item) => item.company_id === companyId), runs: runs.filter((item) => item.company_id === companyId), approvals: approvals.filter((item) => item.company_id === companyId), products: products.filter((item) => item.company_id === companyId) };
  }, [companyId]);
  const company = data?.settings.company;
  const onlyCeo = (data?.agents ?? []).filter((agent) => agent.status === "active").length === 1 && (data?.agents ?? []).some((agent) => /ceo/i.test(agent.name));
  const stats = [
    ["Active agents", data?.agents.filter((a) => a.status === "active").length ?? 0],
    ["Draft/pending agents", data?.agents.filter((a) => ["draft", "pending_approval"].includes(a.status)).length ?? 0],
    ["Active tasks", data?.tasks.filter((t) => !["done", "archived"].includes(t.status)).length ?? 0],
    ["Running tasks", data?.tasks.filter((t) => t.status === "running").length ?? 0],
    ["Pending approvals", data?.approvals.filter((a) => a.status === "pending").length ?? 0],
    ["Failed runs", data?.runs.filter((r) => r.status === "failed").length ?? 0]
  ];
  return (
    <div>
      <PageHeader title="Founder Desk" description={company ? `${company.name} executive brief` : "Local company executive brief"} action={<Button variant="danger" onClick={async () => { await api("/api/settings", { method: "PATCH", body: JSON.stringify({ emergency_stopped: 1 }) }); await refresh(); }}><PauseCircle className="h-4 w-4" />Emergency Stop</Button>} />
      {onlyCeo && <Card className="mb-4 border-sky-400/40 bg-sky-950/20"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-sm text-sky-200"><Sparkles className="h-4 w-4" />Build your AI company</div><p className="text-sm text-slate-300">Your CEO Agent will analyze your business and propose the right departments and AI employees.</p>{buildError && <ProviderError error={buildError} onOpenModelManager={onOpenModelManager} />}</div><Button onClick={async () => { setBuildError(null); try { await api(`/api/companies/${companyId}/build-company`, { method: "POST" }); await refresh(); } catch (error) { setBuildError(error); } }}>Ask CEO to Build Company</Button></div></Card>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900/40 border-line/50">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Active Agents</div>
          <div className="text-3xl font-black text-white">{data?.agents.filter((a) => a.status === "active").length ?? 0}</div>
          <div className="mt-1 text-[10px] text-slate-600 font-bold uppercase tracking-tight">
            {data?.agents.filter((a) => ["draft", "pending_approval"].includes(a.status)).length ?? 0} In Pipeline
          </div>
        </Card>
        <Card className="bg-slate-900/40 border-line/50">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Active Tasks</div>
          <div className="text-3xl font-black text-white">{data?.tasks.filter((t) => !["done", "archived"].includes(t.status)).length ?? 0}</div>
          <div className="mt-1 text-[10px] text-sky-500 font-bold uppercase tracking-tight">
            {data?.tasks.filter((t) => t.status === "running").length ?? 0} Executing Now
          </div>
        </Card>
        <Card className="bg-slate-900/40 border-line/50">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Approvals</div>
          <div className={`text-3xl font-black ${data?.approvals.filter((a) => a.status === "pending").length ? "text-amber-400" : "text-white"}`}>
            {data?.approvals.filter((a) => a.status === "pending").length ?? 0}
          </div>
          <div className="mt-1 text-[10px] text-slate-600 font-bold uppercase tracking-tight">Pending Decision</div>
        </Card>
        <Card className="bg-slate-900/40 border-line/50">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Budget Burn</div>
          <div className="text-3xl font-black text-white">${Number(company?.budget_used ?? 0).toFixed(2)}</div>
          <div className="mt-1 text-[10px] text-slate-600 font-bold uppercase tracking-tight">
            ${Number(company?.monthly_budget ?? 0).toFixed(2)} Monthly Cap
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="border-sky-500/20 bg-sky-500/5 backdrop-blur-sm">
            <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400 mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> 
              Company Status
            </h2>
            <p className="text-slate-300 font-medium leading-relaxed">
              {data?.approvals.some((approval) => approval.status === "pending") 
                ? "Founder attention required: Critical tasks are paused awaiting your authorization." 
                : "Operational Efficiency Optimal: All systems reporting green with no critical blockers."}
            </p>
          </Card>

          <Card className="bg-slate-900/20 border-line/30">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Autopilot Intel</h2>
              <Badge tone={company?.autopilot_level > 0 ? "amber" : "default"} className="px-3 py-1 font-black">Level {company?.autopilot_level ?? 0}</Badge>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500/70" />
                <h3 className="text-xs font-bold text-slate-300">Daily CEO Briefing</h3>
              </div>
              <div className="rounded-xl bg-slate-950 p-4 border border-line/50 max-h-48 overflow-auto">
                <pre className="whitespace-pre-wrap text-[13px] text-slate-400 font-medium leading-relaxed">
                  {data?.products.find((p) => p.type === "daily_report")?.content ?? "No daily report available. Ask CEO to summarize today's work."}
                </pre>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-slate-900/20 border-line/30 h-full">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Pipeline Pulse</h2>
            <div className="space-y-4">
              <section>
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 px-1">Critical Approvals</h3>
                <div className="space-y-2">
                  {(data?.approvals ?? []).filter((a) => a.status === "pending").slice(0, 3).map((a) => (
                    <div key={a.id} className="rounded-lg border border-line bg-slate-900/50 p-3 text-xs font-medium text-slate-300 flex items-center justify-between">
                      <span className="truncate mr-4">{a.action_description}</span>
                      <ChevronRight className="h-4 w-4 text-slate-700 shrink-0" />
                    </div>
                  ))}
                  {!(data?.approvals ?? []).some((a) => a.status === "pending") && <p className="text-xs text-slate-600 font-medium px-1">All clear. No pending approvals.</p>}
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 px-1">Running Tasks</h3>
                <div className="space-y-2">
                  {(data?.tasks ?? []).filter((t) => t.status === "running").slice(0, 3).map((t) => (
                    <div key={t.id} className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs font-bold text-sky-400 flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}
                  {!(data?.tasks ?? []).some((t) => t.status === "running") && <p className="text-xs text-slate-600 font-medium px-1">No tasks currently executing.</p>}
                </div>
              </section>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6 bg-slate-900/10 border-line/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Latest Work Products</h2>
          <Button variant="secondary" className="h-8 text-xs font-bold">View Archive</Button>
        </div>
        {(data?.products ?? []).length === 0 ? (
          <div className="py-12 text-center border border-dashed border-line/30 rounded-2xl">
            <p className="text-sm text-slate-600 font-medium">Your team's output will appear here. Start a task to begin.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(data?.products ?? []).slice(0, 6).map((p) => (
              <div key={p.id} className="rounded-xl border border-line bg-slate-950 p-4 hover:border-accent/30 transition-all cursor-pointer group">
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-tighter mb-1">{p.type}</div>
                <div className="font-bold text-slate-100 mb-2 truncate group-hover:text-accent transition-colors">{p.title || "Untitled Product"}</div>
                <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{p.content}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ProviderError({ error, onOpenModelManager }: { error: any; onOpenModelManager?: () => void }) {
  return <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100"><div>{error?.message ?? "Provider request failed."}</div>{(error?.provider || error?.model) && <div className="mt-1 text-xs text-red-200">Provider: {error.provider ?? "unknown"} · Model: {error.model ?? "unknown"}</div>}{error?.providerStatus && <div className="mt-1 text-xs text-red-200">Provider status: {error.providerStatus}</div>}{error?.lastError && <div className="mt-1 text-xs text-red-200">Last error: {error.lastError}</div>}<div className="mt-1 text-xs text-red-200">Go to Secrets → Model Manager and verify API key and model.</div>{onOpenModelManager && <Button variant="secondary" className="mt-3" onClick={onOpenModelManager}>Open Model Manager</Button>}</div>;
}
