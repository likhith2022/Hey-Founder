import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { api, list, patch } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";

const columns = [
  ["backlog", "Backlog"],
  ["todo", "Todo"],
  ["running", "In Progress"],
  ["review", "Review"],
  ["done", "Done"],
  ["blocked", "Blocked"],
  ["failed", "Failed"]
];

export function TasksPage({ companyId }: { companyId: string }) {
  const { data, refresh } = useApi(async () => {
    const [tasks, agents, projects, runs] = await Promise.all(["tasks", "agents", "projects", "runs"].map((resource) => list<any>(resource)));
    return { tasks: tasks.filter((task) => task.company_id === companyId), agents: agents.filter((agent) => agent.company_id === companyId), projects: projects.filter((project) => project.company_id === companyId), runs: runs.filter((run) => run.company_id === companyId) };
  }, [companyId]);
  const runTask = async (taskId: string) => {
    try {
      await api("/api/runs/run-task", { method: "POST", body: JSON.stringify({ taskId }) });
    } catch (error) {
      window.dispatchEvent(new CustomEvent("task-error", { detail: error instanceof Error ? error.message : "Task run failed" }));
    } finally {
      await refresh();
    }
  };
  return (
    <div>
      <PageHeader title="Task Board" description="Run the company through a board of backlog, active work, review, done, blocked, and failed tasks." />
      <TaskError />
      {(data?.runs ?? []).find((run) => run.status === "failed" && run.error) && <Card className="mb-4 border-amber-500/40 bg-amber-500/10 text-sm text-amber-100">{(data?.runs ?? []).find((run) => run.status === "failed" && run.error)?.error}</Card>}
      <div className="grid gap-4 xl:grid-cols-7 lg:grid-cols-3 md:grid-cols-2">
        {columns.map(([status, label]) => {
          const tasks = data?.tasks.filter((task) => normalizeStatus(task.status) === status) ?? [];
          return (
            <Card key={status} className="min-h-64 p-3">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{label}</h2><Badge>{tasks.length}</Badge></div>
              <div className="space-y-3">
                {tasks.map((task) => {
                  const agent = data?.agents.find((item) => item.id === task.assigned_agent_id);
                  const project = data?.projects.find((item) => item.id === task.project_id);
                  const latestRun = data?.runs.filter((run) => run.task_id === task.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
                  return (
                    <div key={task.id} className="rounded-md border border-line bg-slate-950 p-3">
                      <div className="font-medium">{task.title}</div>
                      <div className="mt-2 flex flex-wrap gap-1"><Badge tone={task.priority === "high" ? "red" : task.priority === "medium" ? "amber" : "default"}>{task.priority}</Badge>{task.requires_approval ? <Badge tone="amber">approval</Badge> : null}{latestRun ? <Badge tone={latestRun.status === "completed" ? "green" : latestRun.status === "failed" ? "red" : "amber"}>{latestRun.status}</Badge> : null}</div>
                      <div className="mt-3 space-y-1 text-xs text-slate-400"><div>Agent: {agent?.name ?? "Unassigned"}</div><div>Project: {project?.title ?? "No project"}</div></div>
                      <div className="mt-3 flex gap-2">
                        <select className="min-w-0 flex-1 rounded-md border border-line bg-slate-900 px-2 py-1 text-xs" value={task.status} onChange={async (event) => { await patch("tasks", task.id, { status: event.target.value }); await refresh(); }}>{columns.map(([value, text]) => <option key={value} value={value === "running" ? "running" : value}>{text}</option>)}</select>
                        <Button onClick={() => runTask(task.id)}><Play className="h-4 w-4" />Run</Button>
                      </div>
                    </div>
                  );
                })}
                {tasks.length === 0 && <p className="rounded-md border border-dashed border-line p-3 text-xs text-slate-500">No {label.toLowerCase()} tasks.</p>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function normalizeStatus(status: string) {
  if (status === "todo") return "todo";
  if (status === "running") return "running";
  if (["review", "done", "blocked", "failed", "backlog"].includes(status)) return status;
  return "backlog";
}

function TaskError() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const handler = ((event: CustomEvent<string>) => setMessage(event.detail)) as EventListener;
    window.addEventListener("task-error", handler);
    return () => window.removeEventListener("task-error", handler);
  }, []);
  return message ? <Card className="mb-4 border-amber-500/40 bg-amber-500/10 text-sm text-amber-100">{message}</Card> : null;
}
