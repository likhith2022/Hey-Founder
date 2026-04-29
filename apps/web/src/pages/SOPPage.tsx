import { useState } from "react";
import { ClipboardList, Play, Plus, Trash2 } from "lucide-react";
import { api, list } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";

type SOPStep = { title: string; description: string; agent_role_hint: string; priority: string };

const blankStep = (): SOPStep => ({ title: "", description: "", agent_role_hint: "", priority: "medium" });

export function SOPPage({ companyId }: { companyId: string }) {
  const { data, refresh } = useApi(async () => {
    const products = await list<any>("work-products");
    return { sops: products.filter((p) => p.company_id === companyId && p.type === "sop") };
  }, [companyId]);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<SOPStep[]>([blankStep()]);
  const [runResult, setRunResult] = useState<Record<string, string>>({});

  const createSOP = async () => {
    if (!name.trim() || steps.some((s) => !s.title.trim())) return;
    await api("/api/sops", { method: "POST", body: JSON.stringify({ company_id: companyId, name, steps: steps.filter((s) => s.title.trim()) }) });
    setCreating(false);
    setName("");
    setSteps([blankStep()]);
    await refresh();
  };

  const runSOP = async (sopId: string) => {
    setRunResult((prev) => ({ ...prev, [sopId]: "Running..." }));
    try {
      const result = await api<any>(`/api/sops/${sopId}/run`, { method: "POST", body: JSON.stringify({ company_id: companyId }) });
      setRunResult((prev) => ({ ...prev, [sopId]: `✅ Queued ${result.data?.tasks?.length ?? "?"} tasks` }));
      await refresh();
    } catch (err) {
      setRunResult((prev) => ({ ...prev, [sopId]: `❌ ${err instanceof Error ? err.message : "Run failed"}` }));
    }
  };

  const sops = data?.sops ?? [];

  return (
    <div>
      <PageHeader
        title="SOP Automations"
        description="Create and run Standard Operating Procedures — each SOP becomes a sequence of tasks assigned to the right agents."
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create SOP</Button>}
      />

      {sops.length === 0 && !creating && (
        <Card className="border-dashed border-line bg-transparent text-center py-12">
          <ClipboardList className="mx-auto h-8 w-8 text-slate-600 mb-3" />
          <p className="text-slate-400 text-sm">No SOPs yet. Create one to automate recurring workflows.</p>
          <Button className="mt-4" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create First SOP</Button>
        </Card>
      )}

      <div className="grid gap-4">
        {sops.map((sop) => {
          let sopData: any = {};
          try { sopData = JSON.parse(sop.content); } catch { /* ignore */ }
          const steps: SOPStep[] = sopData?.steps ?? [];
          return (
            <Card key={sop.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-accent" />
                  <div>
                    <h2 className="font-semibold">{sop.title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{steps.length} steps · created {sop.created_at?.slice(0, 10)}</p>
                  </div>
                </div>
                <Button onClick={() => void runSOP(sop.id)}>
                  <Play className="h-4 w-4" />Run SOP
                </Button>
              </div>
              {runResult[sop.id] && (
                <div className={`mt-3 rounded-md px-3 py-2 text-sm ${runResult[sop.id].startsWith("✅") ? "bg-emerald-950/40 text-emerald-200 border border-emerald-500/30" : runResult[sop.id].startsWith("❌") ? "bg-red-950/40 text-red-200 border border-red-500/30" : "bg-slate-900 text-slate-400"}`}>
                  {runResult[sop.id]}
                </div>
              )}
              <div className="mt-4 grid gap-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-md border border-line bg-slate-950 px-3 py-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs text-accent font-semibold">{i + 1}</span>
                    <div>
                      <div className="text-sm font-medium">{step.title}</div>
                      {step.description && <div className="text-xs text-slate-500 mt-0.5">{step.description}</div>}
                      <div className="mt-1 flex gap-1">
                        {step.priority && <Badge>{step.priority}</Badge>}
                        {step.agent_role_hint && <Badge>{step.agent_role_hint}</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create SOP modal */}
      {creating && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/70 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-semibold">Create SOP</h2>
            <p className="mt-1 text-sm text-slate-400">Define a sequence of steps. Running this SOP creates tasks and assigns them to agents.</p>
            <div className="mt-4">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-400">SOP Name</span>
                <input className="input" placeholder="e.g. Weekly Marketing Review" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            </div>
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">Steps</h3>
              {steps.map((step, i) => (
                <div key={i} className="rounded-md border border-line bg-slate-950 p-3">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-sm font-medium text-slate-300">Step {i + 1}</span>
                    {steps.length > 1 && (
                      <button onClick={() => setSteps(steps.filter((_, idx) => idx !== i))} className="text-slate-600 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="grid gap-1 text-sm md:col-span-2">
                      <span className="text-slate-400">Step title</span>
                      <input className="input" placeholder="e.g. Draft weekly social posts" value={step.title} onChange={(e) => setSteps(steps.map((s, idx) => idx === i ? { ...s, title: e.target.value } : s))} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-400">Description (optional)</span>
                      <input className="input" placeholder="What should the agent do?" value={step.description} onChange={(e) => setSteps(steps.map((s, idx) => idx === i ? { ...s, description: e.target.value } : s))} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-400">Agent hint (optional)</span>
                      <input className="input" placeholder="e.g. marketing, sales, ops" value={step.agent_role_hint} onChange={(e) => setSteps(steps.map((s, idx) => idx === i ? { ...s, agent_role_hint: e.target.value } : s))} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-400">Priority</span>
                      <select className="input" value={step.priority} onChange={(e) => setSteps(steps.map((s, idx) => idx === i ? { ...s, priority: e.target.value } : s))}>
                        {["low", "medium", "high"].map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              ))}
              <Button variant="secondary" onClick={() => setSteps([...steps, blankStep()])}>
                <Plus className="h-4 w-4" />Add Step
              </Button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setCreating(false); setName(""); setSteps([blankStep()]); }}>Cancel</Button>
              <Button disabled={!name.trim() || steps.every((s) => !s.title.trim())} onClick={createSOP}>Create SOP</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
