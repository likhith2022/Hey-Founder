import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { create, list, patch } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";

export type Field = { key: string; label: string; type?: "text" | "textarea" | "number" | "select" | "chips"; options?: string[]; required?: boolean; default?: string | number };

export function ResourcePage({ resource, title, description, fields, columns, emptyState, helper, companyId, extraActions }: { resource: string; title: string; description: string; fields: Field[]; columns: string[]; emptyState?: string; helper?: React.ReactNode; companyId?: string; extraActions?: (row: any, refresh: () => Promise<void>, reportError: (message: string) => void) => React.ReactNode }) {
  const { data, loading, error, refresh } = useApi(() => list<any>(resource), [resource]);
  const [refs, setRefs] = useState<Record<string, any[]>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const rows = (data ?? []).filter((row) => !companyId || !("company_id" in row) || row.company_id === companyId);
  const activeCompanyId = useMemo(() => companyId || localStorage.getItem("companyId") || (rows.find((r) => r.company_id)?.company_id ?? ""), [companyId, rows]);
  useEffect(() => {
    void Promise.all(["departments", "agents", "goals", "projects", "tools"].map((name) => list<any>(name).then((items) => [name, items] as const).catch(() => [name, []] as const))).then((entries) => setRefs(Object.fromEntries(entries)));
  }, []);

  const startCreate = () => {
    setEditing(null);
    setForm(Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.key === "company_id" ? activeCompanyId : "")])));
    setOpen(true);
  };
  const startEdit = (row: any) => {
    setEditing(row);
    setForm(Object.fromEntries(fields.map((f) => [f.key, row[f.key] ?? ""])));
    setOpen(true);
  };
  const submit = async () => {
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, fields.find((f) => f.key === k)?.type === "number" ? Number(v) : normalizeValue(k, v)]));
    if (!editing && fields.some((field) => field.key === "company_id")) body.company_id = activeCompanyId;
    if (editing) await patch(resource, editing.id, body);
    else await create(resource, body);
    setOpen(false);
    await refresh();
  };

  return (
    <div>
      <PageHeader title={title} description={description} action={<div className="flex gap-2"><Button variant="secondary" onClick={refresh}><RefreshCw className="h-4 w-4" />Refresh</Button><Button onClick={startCreate}><Plus className="h-4 w-4" />Create</Button></div>} />
      {helper && <Card className="mb-4 border-sky-400/20 bg-sky-400/5 text-sm text-slate-300">{helper}</Card>}
      {error && <Card className="mb-4 border-red-500/40 text-red-200">{error}</Card>}
      {actionError && <Card className="mb-4 border-amber-500/40 bg-amber-500/10 text-sm text-amber-100">{actionError}</Card>}
      <Card>
        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>{columns.map((col) => <th key={col} className="border-b border-line px-3 py-2">{label(col)}</th>)}<th className="border-b border-line px-3 py-2">Actions</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td className="px-3 py-6 text-slate-400" colSpan={columns.length + 1}>Loading...</td></tr>}
              {!loading && rows.length === 0 && <tr><td className="px-3 py-6 text-slate-400" colSpan={columns.length + 1}>{emptyState ?? "No records yet."}</td></tr>}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line/60">
                  {columns.map((col) => <td key={col} className="max-w-[320px] truncate px-3 py-3">{renderCell(row[col], col)}</td>)}
                  <td className="px-3 py-3"><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => startEdit(row)}>Edit</Button>{extraActions?.(row, async () => { setActionError(null); await refresh(); }, (message) => setActionError(message))}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {open && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-4">
          <Card className="w-full max-w-2xl">
            <h2 className="mb-4 text-lg font-semibold">{editing ? `Edit ${title}` : `Create ${title}`}</h2>
            <div className="grid gap-3">
              {fields.filter((field) => field.key !== "company_id").map((field) => (
                <label key={field.key} className="grid gap-1 text-sm">
                  <span className="text-slate-400">{field.label}</span>
                  {renderInput(field, form, setForm, refs, activeCompanyId)}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Save</Button></div>
          </Card>
        </div>
      )}
    </div>
  );
}

function label(key: string) {
  return key.replaceAll("_", " ");
}

function renderCell(value: unknown, key: string) {
  if (/_id$/.test(key)) return value ? "Linked" : "Unassigned";
  if (key === "status" || key === "risk_level" || key === "priority") {
    const text = String(value ?? "");
    const tone = /active|completed|done|low|approved/.test(text) ? "green" : /pending|medium|review|running/.test(text) ? "amber" : /failed|high|blocked|rejected/.test(text) ? "red" : "default";
    return <Badge tone={tone as any}>{text || "unset"}</Badge>;
  }
  if (typeof value === "string" && value.length > 120) return value.slice(0, 120) + "...";
  return String(value ?? "");
}

function normalizeValue(key: string, value: string | number) {
  if (["tools", "allowed_actions", "blocked_actions"].includes(key)) {
    if (String(value).trim().startsWith("[")) return value;
    return JSON.stringify(String(value).split(",").map((item) => item.trim()).filter(Boolean));
  }
  return value;
}

function renderInput(field: Field, form: Record<string, string | number>, setForm: (form: Record<string, string | number>) => void, refs: Record<string, any[]>, companyId: string) {
  const common = "rounded-md border border-line bg-slate-950 px-3 py-2";
  const value = form[field.key] ?? "";
  const refRows = {
    department_id: refs.departments?.filter((row) => row.company_id === companyId),
    manager_id: refs.agents?.filter((row) => row.company_id === companyId),
    assigned_agent_id: refs.agents?.filter((row) => row.company_id === companyId),
    agent_id: refs.agents?.filter((row) => row.company_id === companyId),
    owner_agent_id: refs.agents?.filter((row) => row.company_id === companyId),
    goal_id: refs.goals?.filter((row) => row.company_id === companyId),
    project_id: refs.projects?.filter((row) => row.company_id === companyId)
  }[field.key];
  if (refRows) {
    return <select className={common} value={value} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}><option value="">Unassigned</option>{refRows.map((row) => <option key={row.id} value={row.id}>{row.name || row.title} {row.role ? `- ${row.role}` : ""}</option>)}</select>;
  }
  if (field.key === "tools") {
    const options = (refs.tools ?? []).map((tool) => tool.name);
    const selected = parseList(String(value || field.default || ""));
    return <div className="flex flex-wrap gap-2">{options.map((option) => <button type="button" key={option} className={`rounded-full border px-3 py-1 text-xs ${selected.includes(option) ? "border-sky-300 bg-sky-300 text-slate-950" : "border-line bg-slate-950 text-slate-300"}`} onClick={() => {
      const next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
      setForm({ ...form, [field.key]: JSON.stringify(next) });
    }}>{option}</button>)}</div>;
  }
  if (field.type === "chips" || ["allowed_actions", "blocked_actions"].includes(field.key)) return <input className={common} value={parseList(String(value)).join(", ")} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder="Comma-separated actions" />;
  if (field.type === "textarea") return <textarea className={`min-h-24 ${common}`} value={value} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />;
  if (field.type === "select") return <select className={common} value={value} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  return <input className={common} type={field.type === "number" ? "number" : "text"} value={value} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />;
}

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}
