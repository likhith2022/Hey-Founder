import { useState } from "react";
import { CheckCircle, DollarSign, Plus, RefreshCw, User, Mail, Link as LinkIcon, ExternalLink, Trash2, Send } from "lucide-react";
import { api, list, create, patch, remove } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";

type Lead = { 
  id: string; 
  name: string; 
  company_name: string; 
  email?: string; 
  linkedin_url?: string;
  source_url?: string;
  status: LeadStatus; 
  notes?: string; 
  created_at: string;
};
type LeadStatus = "new" | "contacted" | "interested" | "qualified" | "closed_won" | "closed_lost";

const PIPELINE: Array<{ status: LeadStatus; label: string; color: string }> = [
  { status: "new", label: "New Leads", color: "default" },
  { status: "contacted", label: "Contacted", color: "amber" },
  { status: "interested", label: "Interested", color: "sky" },
  { status: "qualified", label: "Qualified", color: "green" },
  { status: "closed_won", label: "Won", color: "green" },
  { status: "closed_lost", label: "Lost", color: "red" }
];

function statusColor(status: LeadStatus): any {
  return PIPELINE.find((p) => p.status === status)?.color ?? "default";
}

export function SalesPage({ companyId }: { companyId: string }) {
  const { data: leads, refresh } = useApi(async () => {
    const all = await list<any>("leads");
    return all.filter((l: any) => l.company_id === companyId);
  }, [companyId]);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", company_name: "", email: "", notes: "", linkedin_url: "" });
  const [loading, setLoading] = useState(false);
  const [outreachLead, setOutreachLead] = useState<Lead | null>(null);
  const [outreachForm, setOutreachForm] = useState({ subject: "", body: "" });

  const addLead = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    await create("leads", { ...form, company_id: companyId, status: "new" });
    setAdding(false);
    setForm({ name: "", company_name: "", email: "", notes: "", linkedin_url: "" });
    setLoading(false);
    await refresh();
  };

  const updateStatus = async (id: string, newStatus: LeadStatus) => {
    await patch("leads", id, { status: newStatus });
    await refresh();
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    await api(`/api/leads/${id}`, { method: "DELETE" });
    await refresh();
  };

  const startOutreach = (lead: Lead) => {
    setOutreachLead(lead);
    setOutreachForm({
      subject: `Partnership exploration with ${lead.company_name}`,
      body: `Hi ${lead.name},\n\nI saw your work at ${lead.company_name} and was impressed by...`
    });
  };

  const sendOutreach = async () => {
    if (!outreachLead) return;
    setLoading(true);
    await api("/api/runs/run-task", {
      method: "POST",
      body: JSON.stringify({
        taskId: "__direct_tool__",
        tool: "email_outreach",
        input: { to: outreachLead.email || "test@example.com", ...outreachForm, lead_id: outreachLead.id },
        companyId
      })
    });
    setOutreachLead(null);
    setLoading(false);
    await refresh();
  };

  const totalWon = (leads ?? []).filter((l: any) => l.status === "closed_won").length;
  const winRate = (leads ?? []).length > 0 ? Math.round((totalWon / leads!.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Leads & Prospects"
        description="Autonomous sales pipeline. Use your Lead Hunter agent to find prospects, then initiate outreach with one click."
        action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-2" />Add Lead</Button>}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card><div className="text-sm text-slate-400 flex items-center gap-2"><User className="h-4 w-4 text-sky-400" />Total Prospects</div><div className="mt-2 text-3xl font-bold">{leads?.length ?? 0}</div></Card>
        <Card><div className="text-sm text-slate-400 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400" />Deals Won</div><div className="mt-2 text-3xl font-bold text-emerald-400">{totalWon}</div></Card>
        <Card><div className="text-sm text-slate-400 flex items-center gap-2"><DollarSign className="h-4 w-4 text-amber-400" />Win Rate</div><div className="mt-2 text-3xl font-bold">{winRate}%</div></Card>
      </div>

      {/* Kanban pipeline */}
      <div className="flex gap-6 overflow-x-auto pb-8 no-scrollbar -mx-6 px-6">
        {PIPELINE.map((col) => {
          const colLeads = (leads ?? []).filter((l: any) => l.status === col.status);
          return (
            <div key={col.status} className="flex flex-col gap-4 min-w-[320px] w-[320px]">
              {/* Column Header */}
              <div className="flex items-center justify-between bg-slate-900/40 border border-line/50 rounded-xl px-4 py-3 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full shadow-[0_0_8px] ${
                    col.color === 'amber' ? 'bg-amber-400 shadow-amber-400/50' :
                    col.color === 'sky' ? 'bg-sky-400 shadow-sky-400/50' :
                    col.color === 'green' ? 'bg-emerald-400 shadow-emerald-400/50' :
                    col.color === 'red' ? 'bg-rose-400 shadow-rose-400/50' :
                    'bg-slate-400 shadow-slate-400/50'
                  }`} />
                  <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">{col.label}</h2>
                </div>
                <Badge tone={col.color as any}>{colLeads.length}</Badge>
              </div>

              {/* Column Body */}
              <div className="flex-1 space-y-3 min-h-[500px] rounded-2xl bg-slate-950/20 p-2 border border-line/30 border-dashed">
                {colLeads.map((lead: any) => (
                  <Card key={lead.id} className="p-4 border-line/50 bg-slate-900/40 hover:border-accent/40 hover:bg-slate-900/60 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => deleteLead(lead.id)} className="text-slate-600 hover:text-rose-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div>
                      <div className="font-bold text-slate-100 group-hover:text-accent transition-colors">{lead.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-medium">{lead.company_name}</div>
                    </div>
                    
                    {lead.email && (
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/50 rounded-md px-2 py-1 border border-line/30">
                        <Mail className="h-3 w-3 text-slate-500" /> 
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-line/30">
                      <div className="flex gap-1.5">
                        {lead.linkedin_url && (
                          <a href={lead.linkedin_url} target="_blank" className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-sky-400 hover:bg-sky-400/10 transition-all">
                            <LinkIcon className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {lead.source_url && (
                          <a href={lead.source_url} target="_blank" className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-all">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <Button size="sm" className="h-8 text-[11px] px-3 font-bold bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white border-sky-500/20" onClick={() => startOutreach(lead)}>
                        <Send className="h-3 w-3 mr-1.5" /> Outreach
                      </Button>
                    </div>

                    <div className="mt-3">
                      <select
                        className="w-full rounded-lg border border-line bg-slate-950/50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 focus:border-accent/40 focus:outline-none cursor-pointer hover:bg-slate-950 transition-colors"
                        value={lead.status}
                        onChange={(e) => void updateStatus(lead.id, e.target.value as LeadStatus)}
                      >
                        {PIPELINE.map((p) => <option key={p.status} value={p.status}>{p.label}</option>)}
                      </select>
                    </div>
                  </Card>
                ))}
                {colLeads.length === 0 && (
                  <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-line/20 text-slate-700">
                    <p className="text-[10px] font-bold uppercase tracking-widest">No Leads</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Lead Modal */}
      {adding && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-accent/20">
            <h2 className="text-lg font-bold text-slate-100">Add Manual Prospect</h2>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1 text-xs text-slate-400 uppercase font-bold">Name <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="grid gap-1 text-xs text-slate-400 uppercase font-bold">Company <input className="input mt-1" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></label>
              <label className="grid gap-1 text-xs text-slate-400 uppercase font-bold">Email <input className="input mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label className="grid gap-1 text-xs text-slate-400 uppercase font-bold">LinkedIn <input className="input mt-1" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></label>
              <label className="grid gap-1 text-xs text-slate-400 uppercase font-bold">Notes <textarea className="input mt-1 min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
              <Button disabled={!form.name.trim() || loading} onClick={addLead}>{loading ? "Adding..." : "Add to Pipeline"}</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Outreach Modal */}
      {outreachLead && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg shadow-2xl border-sky-500/20">
            <div className="flex items-center gap-3 border-b border-line pb-4 mb-4">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-500/10 text-sky-400"><Mail className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Send Outreach</h2>
                <p className="text-xs text-slate-500">To: {outreachLead.name} ({outreachLead.email || "No email provided"})</p>
              </div>
            </div>
            <div className="grid gap-4">
              <label className="grid gap-1 text-xs text-slate-400 uppercase font-bold">Subject <input className="input mt-1" value={outreachForm.subject} onChange={(e) => setOutreachForm({ ...outreachForm, subject: e.target.value })} /></label>
              <label className="grid gap-1 text-xs text-slate-400 uppercase font-bold">Message <textarea className="input mt-1 min-h-[200px]" value={outreachForm.body} onChange={(e) => setOutreachForm({ ...outreachForm, body: e.target.value })} /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOutreachLead(null)}>Cancel</Button>
              <Button disabled={loading} onClick={sendOutreach}>
                {loading ? "Sending..." : "Send Email Now"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
