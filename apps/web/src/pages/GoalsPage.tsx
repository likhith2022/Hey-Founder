import { useState } from "react";
import { FileText, Plus, ScrollText, Wand2 } from "lucide-react";
import { api, create, list } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";

export function GoalsPage({ companyId }: { companyId: string }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_at: "", status: "active" });
  const { data, refresh } = useApi(async () => {
    const [goals, projects, tasks, products, audit, agents] = await Promise.all(["goals", "projects", "tasks", "work-products", "audit", "agents"].map((resource) => list<any>(resource)));
    return { goals: goals.filter((item) => item.company_id === companyId), projects: projects.filter((item) => item.company_id === companyId), tasks: tasks.filter((item) => item.company_id === companyId), products: products.filter((item) => item.company_id === companyId), audit: audit.filter((item) => item.company_id === companyId), agents: agents.filter((item) => item.company_id === companyId) };
  }, [companyId]);
  const plan = async (goalId: string) => {
    await api(`/api/goals/${goalId}/plan`, { method: "POST" });
    await refresh();
  };
  const createGoal = async () => {
    if (!form.title.trim()) return;
    await create("goals", { company_id: companyId, title: form.title.trim(), description: form.description, priority: form.priority, due_at: form.due_at || null, status: form.status });
    setCreating(false);
    setForm({ title: "", description: "", priority: "medium", due_at: "", status: "active" });
    await refresh();
  };
  const onlyCeo = (data?.agents ?? []).filter((agent) => agent.status === "active" && !/ceo/i.test(`${agent.name} ${agent.role}`)).length === 0;
  return (
    <div>
      <PageHeader title="Goals" description="Company goals become projects, tasks, work products, and audit trails." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create Goal</Button>} />
      <div className="grid gap-4">
        {(data?.goals ?? []).map((goal) => {
          const projects = data?.projects.filter((project) => project.goal_id === goal.id) ?? [];
          const goalTasks = data?.tasks.filter((task) => task.goal_id === goal.id) ?? [];
          return (
            <Card key={goal.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{goal.title}</h2><Badge tone={goal.status === "active" ? "green" : "default"}>{goal.status}</Badge><Badge tone={goal.priority === "high" ? "red" : "amber"}>{goal.priority}</Badge></div><p className="mt-2 text-sm text-slate-400">{goal.description}</p></div>
                <div className="flex flex-wrap gap-2"><Button onClick={() => plan(goal.id)}><Wand2 className="h-4 w-4" />Ask CEO to Plan</Button><Button variant="secondary"><FileText className="h-4 w-4" />View Projects/Tasks</Button><Button variant="secondary"><FileText className="h-4 w-4" />View work products</Button><Button variant="secondary"><ScrollText className="h-4 w-4" />View audit trail</Button></div>
              </div>
              {onlyCeo && <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">Your company only has a CEO Agent. Build your AI company first or manually hire employees.</div>}
              <div className="mt-4 grid gap-3">
                {projects.map((project) => {
                  const tasks = goalTasks.filter((task) => task.project_id === project.id);
                  return <div key={project.id} className="rounded-md border border-line bg-slate-950 p-3"><div className="flex items-center justify-between"><span className="font-medium">{project.title}</span><Badge>{tasks.length} tasks</Badge></div><div className="mt-3 grid gap-2">{tasks.map((task) => <div key={task.id} className="flex items-center justify-between rounded-md border border-line bg-panel px-3 py-2 text-sm"><span>{task.title}</span><Badge tone={task.status === "done" ? "green" : task.status === "blocked" || task.status === "failed" ? "red" : "default"}>{task.status}</Badge></div>)}</div></div>;
                })}
                {projects.length === 0 && <div className="rounded-md border border-dashed border-line p-4 text-sm text-slate-400">No projects yet. Ask the CEO Agent to plan this goal.</div>}
              </div>
            </Card>
          );
        })}
        {(data?.goals ?? []).length === 0 && <Card className="border-sky-400/30 bg-sky-400/5"><h2 className="text-lg font-semibold">Create your first company goal</h2><p className="mt-2 text-sm text-slate-300">Give the CEO Agent a mission. It will turn this into projects, tasks, and work products.</p><Button className="mt-4" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create Goal</Button></Card>}
      </div>
      {creating && <GoalModal form={form} setForm={setForm} onCancel={() => setCreating(false)} onSave={createGoal} />}
    </div>
  );
}

function GoalModal({ form, setForm, onCancel, onSave }: { form: { title: string; description: string; priority: string; due_at: string; status: string }; setForm: (form: { title: string; description: string; priority: string; due_at: string; status: string }) => void; onCancel: () => void; onSave: () => void }) {
  return <div className="fixed inset-0 z-30 grid place-items-center bg-black/70 p-4"><Card className="w-full max-w-xl"><h2 className="text-lg font-semibold">Create Goal</h2><div className="mt-4 grid gap-3"><Field label="Title"><input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field><Field label="Description"><textarea className="input min-h-24" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field><div className="grid gap-3 md:grid-cols-3"><Field label="Priority"><select className="input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{["low", "medium", "high"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Due date"><input className="input" type="date" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} /></Field><Field label="Status"><select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{["active", "paused", "completed", "archived"].map((item) => <option key={item}>{item}</option>)}</select></Field></div></div><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button disabled={!form.title.trim()} onClick={onSave}>Create Goal</Button></div></Card></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm"><span className="text-slate-400">{label}</span>{children}</label>;
}
