import { useEffect, useMemo, useState } from "react";
import { Archive, Bot, Briefcase, Eye, Network, Plus, Save, UserRoundCog } from "lucide-react";
import { api, create, list, patch } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";
import { agentBlueprints } from "../constants";

const providers: Record<string, string[]> = {
  openai: ["auto", "gpt-5.5", "gpt-5.5-mini", "gpt-5.4", "gpt-5.4-mini", "gpt-5.1", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "custom"],
  anthropic: ["auto", "claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4-7-latest", "claude-sonnet-4-6-latest", "custom"],
  gemini: ["auto", "gemini-3.1-pro", "gemini-3-flash", "gemini-3.1-flash-lite", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash", "custom"],
  openrouter: ["auto", "openrouter/auto", "custom"],
  ollama: ["auto", "llama3.2", "mistral", "qwen2.5", "custom"]
};

const blankForm = { model_mode: "role_default", model_provider: "", model_name: "", permission_level: 1, budget_limit: 0, tools: ["file_tool", "web_research", "document_tool"], allowed_actions: "research, draft, summarize, create_internal_work_product", blocked_actions: "send_email, delete_files, payments", status: "active" };

export function AgentsPage({ companyId }: { companyId: string }) {
  const { data, refresh } = useApi(async () => {
    const [agents, departments, tasks, tools, runs, memories, audit, projects, goals, settings] = await Promise.all([
      list<any>("agents"),
      list<any>("departments"),
      list<any>("tasks"),
      list<any>("tools"),
      list<any>("runs"),
      list<any>("memory"),
      list<any>("audit"),
      list<any>("projects"),
      list<any>("goals"),
      api<any>(`/api/settings?company_id=${encodeURIComponent(companyId)}`).then((r) => r.data)
    ]);
    return { agents: agents.filter((item) => item.company_id === companyId), departments: departments.filter((item) => item.company_id === companyId), tasks: tasks.filter((item) => item.company_id === companyId), tools, runs: runs.filter((item) => item.company_id === companyId), memories: memories.filter((item) => item.company_id === companyId), audit: audit.filter((item) => item.company_id === companyId), projects: projects.filter((item) => item.company_id === companyId), goals: goals.filter((item) => item.company_id === companyId), settings };
  }, [companyId]);
  const [modal, setModal] = useState<"hire" | "edit" | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [assigning, setAssigning] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>(blankForm);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", project_id: "", goal_id: "" });
  const agents = data?.agents ?? [];
  const departments = data?.departments ?? [];
  const tools = data?.tools ?? [];
  const byId = Object.fromEntries(agents.map((agent) => [agent.id, agent]));
  const departmentName = (id?: string) => departments.find((dep) => dep.id === id)?.name ?? "Unassigned";
  const defaults = data?.settings?.model_defaults ?? {};
  const onlyCeo = agents.length === 1 && agents.some((agent) => /ceo/i.test(agent.name));
  const pendingAgents = agents.filter((agent) => agent.status === "pending_approval");

  const beginHire = () => {
    setForm({ ...blankForm });
    setModal("hire");
  };
  const beginEdit = (agent: any) => {
    setSelected(agent);
    setForm({
      ...agent,
      model_mode: agent.model_mode ?? (agent.model_provider && agent.model_name ? "custom" : "role_default"),
      tools: parseList(agent.tools),
      allowed_actions: parseList(agent.allowed_actions).join(", "),
      blocked_actions: parseList(agent.blocked_actions).join(", "),
      budget_limit: Number(agent.budget_limit ?? 0)
    });
    setModal("edit");
  };
  const updateRole = (role: string) => {
    setForm({ ...form, role });
  };
  const saveAgent = async () => {
    const body = agentPayload(companyId, form);
    if (modal === "edit" && selected) await patch("agents", selected.id, body);
    else await create("agents", body);
    setModal(null);
    setSelected(null);
    await refresh();
  };
  const assignTask = async () => {
    if (!assigning || !taskForm.title.trim()) return;
    await create("tasks", { company_id: companyId, assigned_agent_id: assigning.id, title: taskForm.title, description: taskForm.description, priority: taskForm.priority, project_id: taskForm.project_id || null, goal_id: taskForm.goal_id || null, status: "todo" });
    setAssigning(null);
    setTaskForm({ title: "", description: "", priority: "medium", project_id: "", goal_id: "" });
    await refresh();
  };

  return (
    <div>
      <PageHeader title="AI Employees" description="Hire, inspect, edit, and assign local AI employees without exposing raw IDs." action={<Button onClick={beginHire}><Plus className="h-4 w-4" />Hire AI Employee</Button>} />
      <Card className="mb-4">
        <div className="mb-3 flex items-center gap-2"><Network className="h-4 w-4 text-accent" /><h2 className="font-semibold">Org Chart</h2></div>
        <div className="grid gap-3">
          {agents.filter((agent) => /ceo/i.test(agent.name)).map((ceo) => <OrgNode key={ceo.id} agent={ceo} departments={departments} agents={agents} />)}
          {!agents.some((agent) => /ceo/i.test(agent.name)) && <p className="text-sm text-slate-400">No CEO agent yet. Hire one to anchor the company org chart.</p>}
        </div>
      </Card>
      <div className="mb-4 flex flex-wrap gap-2">
        {["active", "pending_approval", "draft", "archived"].map((status) => <Badge key={status} tone={status === "active" ? "green" : status === "pending_approval" ? "amber" : "default"}>{status}: {agents.filter((agent) => agent.status === status).length}</Badge>)}
      </div>
      {onlyCeo && <Card className="mb-4"><p className="text-sm text-slate-400">No AI employees yet. Ask the CEO Agent to design your company.</p></Card>}
      {pendingAgents.length > 0 && <Card className="mb-4"><h2 className="mb-3 font-semibold">Waiting for founder approval</h2><div className="grid gap-2 md:grid-cols-2">{pendingAgents.map((agent) => <div key={agent.id} className="rounded-md border border-line bg-slate-950 p-3"><div className="flex items-center justify-between"><span className="font-medium">{agent.name}</span><Badge tone="amber">Waiting for founder approval</Badge></div><p className="mt-1 text-sm text-slate-400">{agent.role}</p><p className="mt-2 text-xs text-slate-500">{agent.creation_reason}</p></div>)}</div></Card>}
      <div className="mb-8 grid gap-6 xl:grid-cols-3 lg:grid-cols-2">
        {agents.map((agent) => {
          const agentTools = parseList(agent.tools);
          const taskCount = (data?.tasks ?? []).filter((task) => task.assigned_agent_id === agent.id).length;
          const isActive = agent.status === "active";
          
          return (
            <Card key={agent.id} className="group relative overflow-hidden bg-slate-900/40 border-line/50 hover:border-accent/30 transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 ${
                    isActive ? "bg-accent/10 text-accent border border-accent/20" : "bg-slate-950 text-slate-700 border border-line"
                  }`}>
                    <Bot className="h-7 w-7" />
                  </div>
                  {isActive && <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-black text-white truncate">{agent.name}</h2>
                    <Badge tone={isActive ? "green" : agent.status === "pending_approval" ? "amber" : "default"} className="text-[10px] px-2 py-0.5">
                      {agent.status}
                    </Badge>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5 line-clamp-1">{agent.role}</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-slate-600 uppercase tracking-tighter">Department</span>
                  <span className="text-slate-300">{departmentName(agent.department_id)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-slate-600 uppercase tracking-tighter">Intelligence</span>
                  <span className="text-sky-400 truncate max-w-[150px]">{resolvedModelLabel(agent, defaults)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-slate-600 uppercase tracking-tighter">Active Tasks</span>
                  <span className={taskCount > 0 ? "text-white" : "text-slate-700"}>{taskCount}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-1.5">
                {agentTools.slice(0, 3).map((tool) => (
                  <Badge key={tool} className="bg-slate-950 border-line text-[9px] uppercase font-black text-slate-500 px-2">
                    {tool}
                  </Badge>
                ))}
                {agentTools.length > 3 && <Badge className="bg-slate-950 border-line text-[9px] font-black text-slate-700">+{agentTools.length - 3}</Badge>}
              </div>

              <div className="mt-6 pt-6 border-t border-line/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelected(agent)} className="p-2 rounded-lg bg-slate-950 border border-line text-slate-400 hover:text-white transition-all">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => beginEdit(agent)} className="p-2 rounded-lg bg-slate-950 border border-line text-slate-400 hover:text-white transition-all">
                    <UserRoundCog className="h-4 w-4" />
                  </button>
                </div>
                <Button variant="secondary" size="sm" className="h-9 px-4 text-xs font-black bg-slate-950 border-line hover:bg-slate-900" onClick={() => setAssigning(agent)}>
                  <Plus className="h-3.5 w-3.5 mr-2" /> Assign Mission
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      {agents.length === 0 && <Card><p className="text-sm text-slate-400">No AI employees yet. Hire a CEO Agent, then add managers and specialists by department.</p></Card>}
      {selected && !modal && <AgentDrawer agent={selected} data={data} departments={departments} agents={agents} onClose={() => setSelected(null)} />}
      {assigning && <AssignTaskModal agent={assigning} data={data} form={taskForm} setForm={setTaskForm} onCancel={() => setAssigning(null)} onSave={assignTask} />}
      {modal && <AgentModal mode={modal} form={form} setForm={setForm} departments={departments} agents={agents} tools={tools} defaults={defaults} onRole={updateRole} onSave={saveAgent} onCancel={() => { setModal(null); setSelected(null); }} />}
    </div>
  );
}

function AgentModal({ mode, form, setForm, departments, agents, tools, defaults, onRole, onSave, onCancel }: any) {
  const role = roleType(form);
  const preview = roleDefaultLabel(role, defaults);
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/70 p-4">
      <Card className="max-h-[90vh] w-full max-w-4xl overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{mode === "edit" ? "Edit AI Employee" : "Hire AI Employee"}</h2>
          <Button variant="secondary" onClick={onCancel}>Close</Button>
        </div>

        {mode === "hire" && (
          <div className="mt-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-accent">Candidate Market (Templates)</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {agentBlueprints.map((bp) => (
                <button 
                  key={bp.id} 
                  className="group flex flex-col items-start rounded-md border border-line bg-slate-950 p-3 text-left transition-all hover:border-accent hover:bg-slate-900"
                  onClick={() => setForm({ ...form, ...bp, id: undefined })}
                >
                  <span className="font-semibold group-hover:text-accent">{bp.name}</span>
                  <span className="mt-1 text-[10px] leading-tight text-slate-500">{bp.description}</span>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {bp.tools.slice(0, 2).map(t => <Badge key={t} className="px-1 py-0 text-[8px]">{t}</Badge>)}
                    {bp.tools.length > 2 && <span className="text-[8px] text-slate-600">+{bp.tools.length - 2}</span>}
                  </div>
                </button>
              ))}
            </div>
            <div className="my-6 border-b border-line" />
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Name"><input className="input" value={form.name ?? ""} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Role"><input className="input" value={form.role ?? ""} onChange={(event) => onRole(event.target.value)} /></Field>
          <Field label="Department"><select className="input" value={form.department_id ?? ""} onChange={(event) => setForm({ ...form, department_id: event.target.value })}><option value="">Unassigned</option>{departments.map((dep: any) => <option key={dep.id} value={dep.id}>{dep.name}</option>)}</select></Field>
          <Field label="Manager"><select className="input" value={form.manager_id ?? ""} onChange={(event) => setForm({ ...form, manager_id: event.target.value })}><option value="">Founder/CEO</option>{agents.filter((agent: any) => agent.id !== form.id).map((agent: any) => <option key={agent.id} value={agent.id}>{agent.name} - {agent.role}</option>)}</select></Field>
          <Field label="Model mode"><select className="input" value={form.model_mode ?? "role_default"} onChange={(event) => setForm({ ...form, model_mode: event.target.value, model_provider: event.target.value === "role_default" ? "" : (form.model_provider || "openai"), model_name: event.target.value === "role_default" ? "" : (form.model_name || "auto") })}><option value="role_default">Use role default</option><option value="custom">Custom model override</option></select></Field>
          {form.model_mode === "custom" ? <><Field label="Provider"><select aria-label="Custom provider" className="input" value={form.model_provider || "openai"} onChange={(event) => setForm({ ...form, model_provider: event.target.value, model_name: "auto" })}>{Object.keys(providers).map((provider) => <option key={provider}>{provider}</option>)}</select></Field><Field label="Model"><select aria-label="Custom model" className="input" value={modelSelectValue(form.model_provider || "openai", form.model_name || "auto")} onChange={(event) => setForm({ ...form, model_name: event.target.value === "custom" ? "" : event.target.value })}>{providers[form.model_provider || "openai"]?.map((model) => <option key={model} value={model}>{model === "auto" ? "Auto" : model === "custom" ? "Custom model..." : model}</option>)}</select></Field>{modelSelectValue(form.model_provider || "openai", form.model_name || "auto") === "custom" && <Field label="Custom model string"><input className="input" value={form.model_name ?? ""} onChange={(event) => setForm({ ...form, model_name: event.target.value })} /></Field>}</> : <div className="rounded-md border border-line bg-slate-950 p-3 text-sm text-slate-300 md:col-span-2">This agent will use {preview}</div>}
          <Field label="Permission level"><input className="input" type="number" min={0} max={5} value={form.permission_level ?? 1} onChange={(event) => setForm({ ...form, permission_level: event.target.value })} /></Field>
          <Field label="Budget limit"><input className="input" type="number" min={0} step="0.01" value={form.budget_limit ?? 0} onChange={(event) => setForm({ ...form, budget_limit: event.target.value })} /></Field>
          <Field label="Tools"><div className="flex flex-wrap gap-2">{tools.map((tool: any) => <button type="button" key={tool.id} className={`rounded-full border px-3 py-1 text-xs ${form.tools?.includes(tool.name) ? "border-sky-300 bg-sky-300 text-slate-950" : "border-line bg-slate-950 text-slate-300"}`} onClick={() => setForm({ ...form, tools: form.tools?.includes(tool.name) ? form.tools.filter((name: string) => name !== tool.name) : [...(form.tools ?? []), tool.name] })}>{tool.name}</button>)}</div></Field>
          <Field label="Status"><select className="input" value={form.status ?? "active"} onChange={(event) => setForm({ ...form, status: event.target.value })}>{["active", "draft", "pending_approval", "archived"].map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Allowed actions"><input className="input" value={form.allowed_actions ?? ""} onChange={(event) => setForm({ ...form, allowed_actions: event.target.value })} /></Field>
          <Field label="Blocked actions"><input className="input" value={form.blocked_actions ?? ""} onChange={(event) => setForm({ ...form, blocked_actions: event.target.value })} /></Field>
          <label className="grid gap-1 text-sm md:col-span-2"><span className="text-slate-400">Prompt template</span><textarea className="input min-h-28" value={form.system_prompt ?? ""} onChange={(event) => setForm({ ...form, system_prompt: event.target.value })} /></label>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button disabled={!form.name || !form.role} onClick={onSave}><Save className="h-4 w-4" />Save</Button></div>
      </Card>
    </div>
  );
}

function AgentDrawer({ agent, data, departments, agents, onClose }: any) {
  const tasks = (data?.tasks ?? []).filter((task: any) => task.assigned_agent_id === agent.id);
  const runs = (data?.runs ?? []).filter((run: any) => run.agent_id === agent.id);
  const memories = (data?.memories ?? []).filter((memory: any) => memory.agent_id === agent.id);
  const audit = (data?.audit ?? []).filter((event: any) => event.actor_id === agent.id || event.resource_id === agent.id).slice(0, 10);
  const manager = agents.find((item: any) => item.id === agent.manager_id);
  return <div className="fixed inset-0 z-30 flex justify-end bg-black/60"><Card className="h-full w-full max-w-2xl overflow-auto rounded-none border-y-0 border-r-0"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{agent.name}</h2><p className="mt-1 text-sm text-slate-400">{agent.role}</p></div><Button variant="secondary" onClick={onClose}>Close</Button></div><div className="mt-4 grid gap-2 text-sm md:grid-cols-2"><Info label="Department" value={departments.find((dep: any) => dep.id === agent.department_id)?.name ?? "Unassigned"} /><Info label="Manager" value={manager?.name ?? "Founder/CEO"} /><Info label="Model" value={resolvedModelLabel(agent, data?.settings?.model_defaults)} /><Info label="Permission" value={`Level ${agent.permission_level ?? 1}`} /><Info label="Budget" value={`$${Number(agent.budget_used ?? 0).toFixed(2)} / $${Number(agent.budget_limit ?? 0).toFixed(2)}`} /></div><Section title="Tools">{parseList(agent.tools).map((tool) => <Badge key={tool}>{tool}</Badge>)}</Section><Section title="Allowed Actions">{parseList(agent.allowed_actions).map((action) => <Badge key={action}>{action}</Badge>)}</Section><Section title="Blocked Actions">{parseList(agent.blocked_actions).map((action) => <Badge key={action} tone="red">{action}</Badge>)}</Section><ListSection title="Assigned Tasks" rows={tasks} render={(task: any) => <><span>{task.title}</span><Badge>{task.status}</Badge></>} /><ListSection title="Recent Runs" rows={runs.slice(0, 8)} render={(run: any) => <><span>{run.status}</span><Badge>${Number(run.cost_estimate ?? 0).toFixed(2)}</Badge></>} /><ListSection title="Memories" rows={memories.slice(0, 8)} render={(memory: any) => <span className="line-clamp-2">{memory.content}</span>} /><ListSection title="Audit Activity" rows={audit} render={(event: any) => <><span>{event.action}</span><span className="text-slate-500">{event.created_at}</span></>} /></Card></div>;
}

function AssignTaskModal({ agent, data, form, setForm, onCancel, onSave }: any) {
  return <div className="fixed inset-0 z-30 grid place-items-center bg-black/70 p-4"><Card className="w-full max-w-xl"><h2 className="text-lg font-semibold">Assign Task to {agent.name}</h2><div className="mt-4 grid gap-3"><Field label="Task title"><input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field><Field label="Description"><textarea className="input min-h-24" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field><div className="grid gap-3 md:grid-cols-3"><Field label="Priority"><select className="input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{["low", "medium", "high", "urgent"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Project"><select className="input" value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })}><option value="">Optional</option>{(data?.projects ?? []).map((project: any) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></Field><Field label="Goal"><select className="input" value={form.goal_id} onChange={(event) => setForm({ ...form, goal_id: event.target.value })}><option value="">Optional</option>{(data?.goals ?? []).map((goal: any) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></Field></div></div><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button disabled={!form.title.trim()} onClick={onSave}>Create Task</Button></div></Card></div>;
}

function OrgNode({ agent, departments, agents }: { agent: any; departments: any[]; agents: any[] }) {
  const children = agents.filter((item) => item.manager_id === agent.id);
  return <div className="rounded-md border border-line bg-slate-950 p-3"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{agent.name}</span><Badge>{departments.find((dep) => dep.id === agent.department_id)?.name ?? "Unassigned"}</Badge><Badge tone={agent.status === "active" ? "green" : "amber"}>{agent.status}</Badge><Badge>{agent.model_mode === "custom" ? "Custom" : "Role default"}</Badge><Badge>{parseList(agent.tools).length} tools</Badge><Badge>Level {agent.permission_level}</Badge></div>{children.length > 0 && <div className="ml-4 mt-3 grid gap-2 border-l border-line pl-4">{children.map((child) => <OrgNode key={child.id} agent={child} departments={departments} agents={agents} />)}</div>}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-5"><h3 className="mb-2 font-semibold">{title}</h3><div className="flex flex-wrap gap-2">{children}</div></div>;
}

function ListSection({ title, rows, render }: { title: string; rows: any[]; render: (row: any) => React.ReactNode }) {
  return <div className="mt-5"><h3 className="mb-2 font-semibold">{title}</h3>{rows.length ? <div className="grid gap-2">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-slate-950 p-3 text-sm">{render(row)}</div>)}</div> : <p className="text-sm text-slate-400">Nothing here yet.</p>}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm"><span className="text-slate-400">{label}</span>{children}</label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-slate-500">{label}</span><span className="truncate text-right text-slate-200">{value}</span></div>;
}

function parseList(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function split(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function agentPayload(companyId: string, form: Record<string, any>) {
  return {
    company_id: companyId,
    department_id: form.department_id || null,
    manager_id: form.manager_id || null,
    name: form.name,
    role: form.role,
    system_prompt: form.system_prompt || form.role,
    model_mode: form.model_mode ?? "role_default",
    model_provider: form.model_mode === "custom" ? (form.model_provider || "openai") : null,
    model_name: form.model_mode === "custom" ? (form.model_name || "auto") : null,
    tools: JSON.stringify(form.tools ?? []),
    permission_level: Number(form.permission_level ?? 1),
    budget_limit: Number(form.budget_limit ?? 0),
    allowed_actions: JSON.stringify(split(form.allowed_actions ?? "")),
    blocked_actions: JSON.stringify(split(form.blocked_actions ?? "")),
    status: form.status ?? "active"
  };
}

function roleType(agent: { name?: string; role?: string }) {
  const text = `${agent.name ?? ""} ${agent.role ?? ""}`.toLowerCase();
  if (text.includes("ceo")) return "ceo";
  if (text.includes("qa") || text.includes("review")) return "reviewer";
  if (text.includes("manager") || text.includes("lead")) return "manager";
  return "worker";
}

function roleDefaultLabel(role: string, defaults: any) {
  const item = defaults?.[role] ?? defaults?.global;
  const label = role === "ceo" ? "CEO default" : role === "reviewer" ? "Reviewer default" : role === "manager" ? "Manager default" : "Worker default";
  return item ? (item.model === "auto" ? `${label}: Auto → ${resolveAuto(item.provider, role)}` : `${label}: ${item.provider} / ${item.model}`) : `${label}: not configured`;
}

function resolvedModelLabel(agent: any, defaults: any) {
  if ((agent.model_mode ?? "custom") === "custom" && agent.model_provider && agent.model_name) return agent.model_name === "auto" ? `Custom: Auto → ${resolveAuto(agent.model_provider, roleType(agent))}` : `Custom: ${agent.model_provider}/${agent.model_name}`;
  return roleDefaultLabel(roleType(agent), defaults);
}

function modelSelectValue(provider: string, model: string) {
  return providers[provider]?.includes(model) ? model : "custom";
}

function resolveAuto(provider: string, role: string) {
  const map: Record<string, Record<string, string>> = {
    openai: { ceo: "gpt-5.5", manager: "gpt-5.5-mini", worker: "gpt-5.5-mini", reviewer: "gpt-5.5", default: "gpt-5.5-mini" },
    anthropic: { ceo: "claude-opus-4-7", manager: "claude-sonnet-4-6", worker: "claude-haiku-4-5", reviewer: "claude-sonnet-4-6", default: "claude-sonnet-4-6" },
    gemini: { ceo: "gemini-3.1-pro", manager: "gemini-3-flash", worker: "gemini-3.1-flash-lite", reviewer: "gemini-3.1-pro", default: "gemini-3-flash" },
    openrouter: { default: "openrouter/auto" },
    ollama: { ceo: "qwen2.5", manager: "qwen2.5", worker: "llama3.2", reviewer: "qwen2.5", default: "llama3.2" },
    mock: { default: "software-company-builder" }
  };
  return map[provider]?.[role] ?? map[provider]?.default ?? "provider default";
}

function budgetTone(agent: any) {
  const limit = Number(agent.budget_limit ?? 0);
  const used = Number(agent.budget_used ?? 0);
  if (!limit) return "default";
  if (used >= limit) return "red";
  if (used / limit > 0.8) return "amber";
  return "green";
}
