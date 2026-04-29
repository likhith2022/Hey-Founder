import { Activity, BarChart2, Bot, Briefcase, Building2, CalendarClock, CheckSquare, ChevronRight, ClipboardList, Database, DollarSign, FileArchive, FileText, Gauge, KeyRound, LucideIcon, MemoryStick, MessageSquare, Network, Plus, ScrollText, Settings, ShieldCheck, Target, TrendingUp, Users, Wrench } from "lucide-react";
import { useState } from "react";
import { api } from "../../api/client";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export type PageKey = "board" | "desk" | "chat" | "agents" | "departments" | "goals" | "projects" | "tasks" | "runs" | "approvals" | "schedules" | "tools" | "secrets" | "memory" | "files" | "work-products" | "audit" | "settings" | "analytics" | "sops" | "sales" | "financials" | "wiki";
export type CompanySummary = { id: string; name: string; description?: string; emergency_stopped?: number; autopilot_level?: number };

const items: Array<{ key: PageKey; label: string; icon: LucideIcon; group?: string }> = [
  { key: "chat", label: "Home", icon: MessageSquare, group: "command" },
  { key: "desk", label: "Dashboard", icon: Gauge, group: "company" },
  { key: "financials", label: "Financials", icon: DollarSign, group: "company" },
  { key: "wiki", label: "Company Wiki", icon: ScrollText, group: "company" },
  { key: "board", label: "Organization", icon: Network, group: "company" },
  { key: "agents", label: "My Team", icon: Bot, group: "team" },
  { key: "goals", label: "Projects & Goals", icon: Target, group: "work" },
  { key: "sales", label: "Leads & Prospects", icon: Users, group: "work" },
  { key: "tasks", label: "Tasks", icon: CheckSquare, group: "work" },
  { key: "work-products", label: "Results & Deliverables", icon: FileText, group: "work" },
  { key: "secrets", label: "API Keys", icon: KeyRound, group: "ops" },
  { key: "settings", label: "Settings", icon: Settings, group: "ops" }
];

export function Layout({ page, setPage, children, emergency, companies, selectedCompanyId, onCompanyChange, onCompaniesChanged }: { page: PageKey; setPage: (page: PageKey) => void; children: React.ReactNode; emergency?: boolean; companies: CompanySummary[]; selectedCompanyId: string; onCompanyChange: (id: string) => void; onCompaniesChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const selected = companies.find((company) => company.id === selectedCompanyId);
  const createCompany = async () => {
    const created = await api<{ data: CompanySummary }>("/api/companies", { method: "POST", body: JSON.stringify({ name, description, autopilot_level: 0, working_hours: "Mon-Fri 09:00-17:00" }) });
    setName("");
    setDescription("");
    setOpen(false);
    await onCompaniesChanged();
    onCompanyChange(created.data.id);
  };
  return (
    <div className="min-h-screen bg-surface text-slate-100">
      {emergency && <div className="border-b border-red-500/30 bg-red-950/70 px-4 py-2 text-sm text-red-100">Emergency stop is active. New jobs are paused until reset by the local admin.</div>}
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <aside className="sticky top-0 h-screen border-r border-line bg-slate-950 p-5 flex flex-col gap-6 overflow-y-auto no-scrollbar">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 group cursor-pointer">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent/40 shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] group-hover:scale-110 transition-transform">
              <Database className="h-6 w-6 text-slate-950" />
            </div>
            <div className="font-bold tracking-tight text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Hey Founder!</div>
          </div>

          {/* Company Selector */}
          <div className="relative rounded-2xl border border-line/50 bg-slate-900/40 p-4 backdrop-blur-sm shadow-xl">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-slate-500">
              <Building2 className="h-3 w-3" />
              Active Org
            </div>
            <div className="relative group">
              <select 
                className="w-full appearance-none rounded-xl border border-line bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-200 focus:border-accent/50 focus:outline-none transition-all cursor-pointer" 
                value={selectedCompanyId} 
                onChange={(event) => onCompanyChange(event.target.value)} 
                aria-label="Switch Company"
              >
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
              <ChevronRight className="absolute right-3 top-2.5 h-4 w-4 rotate-90 text-slate-600 pointer-events-none group-hover:text-slate-400 transition-colors" />
            </div>
            <div className="mt-3 truncate text-[11px] font-medium text-slate-500 px-1 italic opacity-80">"{selected?.description || "Local company workspace"}"</div>
            <Button className="mt-4 w-full bg-slate-800 border-line hover:bg-slate-700 hover:border-slate-600 text-xs font-bold" variant="secondary" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Venture
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = page === item.key;
              const isChat = item.key === "chat";
              
              return (
                <button 
                  key={item.key} 
                  onClick={() => setPage(item.key)} 
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? isChat 
                        ? "bg-accent text-slate-950 shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]" 
                        : "bg-slate-800 text-white border border-line/50 shadow-lg"
                      : "text-slate-500 hover:bg-slate-900/60 hover:text-slate-200"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 ${isActive ? "" : "text-slate-600 group-hover:text-slate-400"}`} />
                  <span className="flex-1">{item.label}</span>
                  {isChat && !isActive && <div className="h-2 w-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)]" />}
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <button 
            onClick={() => fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => location.reload())}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/20"
          >
            <Activity className="h-4.5 w-4.5" />
            Terminate Session
          </button>
        </aside>
        <main className="min-w-0 p-8 bg-slate-950"> {children} </main>
      </div>
      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/70 p-4">
          <Card className="w-full max-w-md">
            <h2 className="text-lg font-semibold">Create Company</h2>
            <p className="mt-1 text-sm text-slate-400">Add another local company workspace. Data stays on this machine.</p>
            <div className="mt-4 grid gap-3">
              <input className="rounded-md border border-line bg-slate-950 px-3 py-2" placeholder="Company name" value={name} onChange={(event) => setName(event.target.value)} />
              <textarea className="min-h-24 rounded-md border border-line bg-slate-950 px-3 py-2" placeholder="Mission or description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!name.trim()} onClick={createCompany}>Create</Button></div>
          </Card>
        </div>
      )}
    </div>
  );
}
