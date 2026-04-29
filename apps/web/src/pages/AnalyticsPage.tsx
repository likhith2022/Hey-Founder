import { useMemo } from "react";
import { Activity, Bot, DollarSign, FileText, TrendingUp } from "lucide-react";
import { list, api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";

function Sparkline({ values, color = "#38bdf8" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-8 text-xs text-slate-600">No data</div>;
  const max = Math.max(...values, 1);
  const w = 120; const h = 32;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
      <circle cx={(values.length - 1) * step} cy={h - (values[values.length - 1] / max) * h} r="3" fill={color} />
    </svg>
  );
}

function BarChart({ labels, values, color = "#38bdf8" }: { labels: string[]; values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t-sm transition-all" style={{ height: `${Math.max(4, (v / max) * 80)}px`, backgroundColor: color, opacity: 0.8 }} title={`${labels[i]}: ${v}`} />
          <span className="text-[9px] text-slate-600 truncate w-full text-center">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Metric({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; tone?: "green" | "red" | "amber" }) {
  const colors = { green: "text-emerald-400", red: "text-red-400", amber: "text-amber-400" };
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400">{icon}{label}</div>
          <div className={`mt-2 text-3xl font-bold ${tone ? colors[tone] : "text-slate-100"}`}>{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
    </Card>
  );
}

export function AnalyticsPage({ companyId }: { companyId: string }) {
  const { data } = useApi(async () => {
    const [tasks, runs, products, agents, approvals] = await Promise.all(
      ["tasks", "runs", "work-products", "agents", "approvals"].map((r) => list<any>(r))
    );
    const settings = await api<any>(`/api/settings?company_id=${encodeURIComponent(companyId)}`).then((r) => r.data);
    return {
      tasks: tasks.filter((t) => t.company_id === companyId),
      runs: runs.filter((r) => r.company_id === companyId),
      products: products.filter((p) => p.company_id === companyId),
      agents: agents.filter((a) => a.company_id === companyId),
      approvals: approvals.filter((a) => a.company_id === companyId),
      settings
    };
  }, [companyId]);

  const stats = useMemo(() => {
    if (!data) return null;
    const { tasks, runs, products, agents, approvals } = data;

    // Tasks by status
    const tasksByStatus: Record<string, number> = {};
    tasks.forEach((t) => { tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1; });

    // Done tasks per day (last 7 days)
    const now = Date.now();
    const tasksByDay: number[] = Array(7).fill(0);
    const dayLabels: string[] = Array(7).fill(0).map((_, i) => {
      const d = new Date(now - (6 - i) * 86400000);
      return d.toLocaleDateString("en-US", { weekday: "short" });
    });
    tasks.filter((t) => t.status === "done").forEach((t) => {
      const d = new Date(t.updated_at ?? t.created_at).getTime();
      const daysAgo = Math.floor((now - d) / 86400000);
      if (daysAgo < 7) tasksByDay[6 - daysAgo]++;
    });

    // Cost per agent
    const agentCost: Array<{ name: string; cost: number }> = agents.slice(0, 8).map((a) => ({
      name: a.name.replace(" Agent", "").slice(0, 12),
      cost: Number(a.budget_used ?? 0)
    }));

    // Work products by type
    const productsByType: Record<string, number> = {};
    products.forEach((p) => { const t = p.type || "note"; productsByType[t] = (productsByType[t] || 0) + 1; });

    // Approval turnaround (decided vs created)
    const decided = approvals.filter((a) => a.decided_at && a.created_at);
    const avgTurnaround = decided.length > 0
      ? decided.reduce((sum: number, a: any) => sum + (new Date(a.decided_at).getTime() - new Date(a.created_at).getTime()), 0) / decided.length / 60000
      : 0;

    // Total AI cost
    const totalCost = runs.reduce((sum, r) => sum + Number(r.cost_estimate ?? 0), 0);
    const completedRuns = runs.filter((r) => r.status === "completed").length;
    const failedRuns = runs.filter((r) => r.status === "failed").length;

    // Runs per day
    const runsByDay: number[] = Array(7).fill(0);
    runs.forEach((r) => {
      const d = new Date(r.created_at).getTime();
      const daysAgo = Math.floor((now - d) / 86400000);
      if (daysAgo < 7) runsByDay[6 - daysAgo]++;
    });

    return { tasksByStatus, tasksByDay, dayLabels, agentCost, productsByType, avgTurnaround, totalCost, completedRuns, failedRuns, runsByDay };
  }, [data]);

  if (!stats) return <div className="text-slate-400">Loading analytics...</div>;

  const topTypes = Object.entries(stats.productsByType).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div>
      <PageHeader title="Analytics" description="Performance metrics, cost tracking, and productivity insights for your AI company." />

      {/* Top metrics row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Activity className="h-4 w-4" />} label="Completed Runs" value={stats.completedRuns} sub={`${stats.failedRuns} failed`} tone="green" />
        <Metric icon={<DollarSign className="h-4 w-4" />} label="Total AI Cost" value={`$${stats.totalCost.toFixed(4)}`} sub="across all runs" tone={stats.totalCost > 5 ? "amber" : undefined} />
        <Metric icon={<FileText className="h-4 w-4" />} label="Work Products" value={data?.products.length ?? 0} sub={`${topTypes[0]?.[0] ?? "—"} most common`} />
        <Metric icon={<TrendingUp className="h-4 w-4" />} label="Avg Approval Time" value={stats.avgTurnaround > 0 ? `${stats.avgTurnaround.toFixed(0)}m` : "N/A"} sub="minutes per decision" />
      </div>

      {/* Charts row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Tasks Completed (Last 7 Days)</h2>
          <BarChart labels={stats.dayLabels} values={stats.tasksByDay} color="#34d399" />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Agent Runs (Last 7 Days)</h2>
          <BarChart labels={stats.dayLabels} values={stats.runsByDay} color="#38bdf8" />
        </Card>
      </div>

      {/* Detailed rows */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Task status breakdown */}
        <Card>
          <h2 className="mb-3 font-semibold">Task Status Breakdown</h2>
          <div className="space-y-2">
            {Object.entries(stats.tasksByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-slate-400 capitalize">{status}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 rounded-full bg-slate-700" style={{ width: "80px" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (count / (data?.tasks.length || 1)) * 100)}%`, backgroundColor: status === "done" ? "#34d399" : status === "running" ? "#38bdf8" : status === "blocked" || status === "failed" ? "#f87171" : "#6366f1" }} />
                  </div>
                  <Badge>{count}</Badge>
                </div>
              </div>
            ))}
            {Object.keys(stats.tasksByStatus).length === 0 && <p className="text-sm text-slate-500">No tasks yet.</p>}
          </div>
        </Card>

        {/* Work products by type */}
        <Card>
          <h2 className="mb-3 font-semibold">Work Products by Type</h2>
          <div className="space-y-2">
            {topTypes.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-slate-400 capitalize">{type.replace(/_/g, " ")}</span>
                <Badge>{count}</Badge>
              </div>
            ))}
            {topTypes.length === 0 && <p className="text-sm text-slate-500">No work products yet.</p>}
          </div>
        </Card>

        {/* Agent cost leaderboard */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-accent" />
            <h2 className="font-semibold">Agent Cost Ranking</h2>
          </div>
          <div className="space-y-2">
            {stats.agentCost.filter((a) => a.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 6).map((agent, i) => (
              <div key={agent.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{i + 1}. {agent.name}</span>
                <Badge tone={agent.cost > 1 ? "amber" : "default"}>${agent.cost.toFixed(4)}</Badge>
              </div>
            ))}
            {stats.agentCost.every((a) => a.cost === 0) && <p className="text-sm text-slate-500">No cost data yet — run tasks to track spend.</p>}
          </div>
        </Card>
      </div>

      {/* Sparkline summary */}
      <Card className="mt-4">
        <h2 className="mb-4 font-semibold">7-Day Trend — Tasks Done</h2>
        <div className="flex items-end gap-8">
          <Sparkline values={stats.tasksByDay} color="#34d399" />
          <Sparkline values={stats.runsByDay} color="#38bdf8" />
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />Tasks done</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-sky-400" />Agent runs</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
