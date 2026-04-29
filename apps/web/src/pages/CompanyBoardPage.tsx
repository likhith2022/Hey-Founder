import React, { useState } from "react";
import { Bot, Briefcase, Clock, FileText, Network, ShieldCheck, Sparkles, ChevronRight, Cpu, Zap, Settings2, Trash2, Plus } from "lucide-react";
import { api, list, patch } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";


export function CompanyBoardPage({ companyId, onOpenModelManager }: { companyId: string; onOpenModelManager?: () => void }) {
  const [buildError, setBuildError] = useState<any>(null);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const onMouseLeave = () => setIsDragging(false);
  const onMouseUp = () => setIsDragging(false);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      const newScale = Math.min(Math.max(0.2, scale + delta), 2);
      setScale(newScale);
    }
  };

  const resetView = () => {
    setPosition({ x: 0, y: 0 });
    setScale(1);
  };

  const { data, loading, refresh } = useApi(async () => {
    const [companies, departments, agents, goals, approvals, runs, products] = await Promise.all([
      list<any>("companies"),
      list<any>("departments"),
      list<any>("agents"),
      list<any>("goals"),
      list<any>("approvals"),
      list<any>("runs"),
      list<any>("work-products")
    ]);
    const settings = await api<any>(`/api/settings?company_id=${encodeURIComponent(companyId)}`).then((r) => r.data);
    return { companies, departments, agents, goals, approvals, runs, products, settings };
  }, [companyId]);

  if (loading || !data) return <div className="text-slate-400 p-8">Loading organizational intelligence...</div>;

  const company = data.companies.find((item) => item.id === companyId) ?? data.companies[0];
  const scoped = {
    departments: data.departments.filter((item) => item.company_id === company?.id),
    agents: data.agents.filter((item) => item.company_id === company?.id),
    goals: data.goals.filter((item) => item.company_id === company?.id),
    approvals: data.approvals.filter((item) => item.company_id === company?.id),
    runs: data.runs.filter((item) => item.company_id === company?.id),
    products: data.products.filter((item) => item.company_id === company?.id),
  };

  const ceo = scoped.agents.find((agent) => /ceo/i.test(agent.name) || /ceo/i.test(agent.role));

  const updateAgentModel = async (agentId: string, modelData: any) => {
    await patch("agents", agentId, modelData);
    setSelectedAgent(null);
    await refresh();
  };

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Organization Chart" 
        description="The full intelligence hierarchy. Monitor and configure AI models for every department and employee."
      />

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric icon={<Bot className="h-4 w-4" />} label="Digital Employees" value={scoped.agents.filter(a => a.status === 'active').length} />
        <Metric icon={<Network className="h-4 w-4" />} label="Departments" value={scoped.departments.length} />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Active Approvals" value={scoped.approvals.filter(a => a.status === 'pending').length} />
        <Metric icon={<Zap className="h-4 w-4" />} label="Running Tasks" value={scoped.runs.filter(r => r.status === 'running').length} />
      </div>

      {/* Visual Tree Section */}
      <Card className="bg-slate-950/50 border-line/30 overflow-hidden relative min-h-[600px] cursor-grab active:cursor-grabbing">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.1),transparent_50%)] pointer-events-none" />
        
        {/* Navigation Controls */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <Badge className="bg-slate-900 border-line text-[10px] font-black uppercase text-slate-500">
            {Math.round(scale * 100)}% Zoom
          </Badge>
          <button 
            onClick={resetView}
            className="p-1.5 rounded-lg bg-slate-900 border border-line text-slate-400 hover:text-white transition-all shadow-xl"
            title="Reset View"
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>

        <div 
          onMouseDown={onMouseDown}
          onMouseLeave={onMouseLeave}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
          onWheel={onWheel}
          className="absolute inset-0 z-10 select-none overflow-hidden"
        >
          <div 
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            className="flex flex-col items-center p-20 min-w-max h-full justify-center"
          >
            <div className="inline-flex flex-col items-center">
              {/* CEO / Root Node */}
        {ceo ? (
          <div className="relative z-10 flex flex-col items-center">
            <OrgNode 
              agent={ceo} 
              isRoot 
              modelLabel={resolvedModelLabel(ceo, data.settings?.model_defaults)}
              onClick={() => setSelectedAgent(ceo)}
            />
            
            {/* Connection Line to Departments */}
            {scoped.departments.length > 0 && (
              <div className="w-px h-12 bg-gradient-to-b from-sky-500 to-slate-800" />
            )}

            {/* Departments Row */}
            <div className="relative flex justify-center gap-12">
              {scoped.departments.length > 1 && (
                <div className="absolute top-0 left-0 right-0 h-px bg-slate-800" />
              )}
              
              {scoped.departments.map((dept) => (
                <div key={dept.id} className="flex flex-col items-center">
                  {/* Vertical connector to horizontal line */}
                  <div className="w-px h-6 bg-slate-800" />
                  
                  {/* Department Badge */}
                  <div className="bg-slate-900 border border-line px-4 py-2 rounded-full shadow-lg mb-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                      <Briefcase className="h-3 w-3" />
                      {dept.name}
                    </span>
                  </div>

                  {/* Agents in Department */}
                  <div className="flex flex-col gap-4">
                    {scoped.agents
                      .filter(a => a.department_id === dept.id && a.id !== ceo.id)
                      .map(agent => (
                        <div key={agent.id} className="flex flex-col items-center">
                          <div className="w-px h-4 bg-slate-800" />
                          <OrgNode 
                            agent={agent} 
                            modelLabel={resolvedModelLabel(agent, data.settings?.model_defaults)}
                            onClick={() => setSelectedAgent(agent)}
                          />
                        </div>
                      ))}
                    {scoped.agents.filter(a => a.department_id === dept.id && a.id !== ceo.id).length === 0 && (
                      <div className="text-[10px] text-slate-700 italic">No staff assigned</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
            <div className="flex flex-col items-center justify-center py-40">
              <Bot className="h-16 w-16 text-slate-800 mb-4" />
              <h3 className="text-xl font-bold text-slate-400">Empty Organization</h3>
              <p className="text-sm text-slate-600 mt-1 mb-6">Your company is waiting for its first CEO.</p>
              <Button onClick={() => setBuildError(null)}>Build Org via AI</Button>
            </div>
          )}
          </div>
        </div>
      </div>
    </Card>

      {/* Quick Access Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-slate-900/20 border-line/30">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Company Mission
          </h2>
          <div className="p-4 rounded-xl bg-slate-950 border border-line/50">
            <h3 className="text-lg font-bold text-white mb-2">{company?.name}</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-medium">
              {company?.description || "Define your mission to align your AI workforce."}
            </p>
          </div>
        </Card>

        <Card className="bg-slate-900/20 border-line/30">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Operational Audit
          </h2>
          <div className="space-y-2">
            {scoped.runs.slice(0, 3).map(run => (
              <div key={run.id} className="flex items-center justify-between p-3 rounded-lg border border-line bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${run.status === 'running' ? 'bg-sky-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-xs font-bold text-slate-300 truncate max-w-[200px]">{run.intent}</span>
                </div>
                <Badge tone={run.status === 'failed' ? 'red' : run.status === 'running' ? 'sky' : 'default'} className="text-[9px]">
                  {run.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Agent Detail / Model Configuration Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg shadow-2xl border-accent/20 bg-slate-900 overflow-hidden">
            <div className="relative h-24 bg-gradient-to-r from-accent/20 to-sky-500/20 p-6 flex items-end">
              <div className="absolute top-4 right-4">
                <button onClick={() => setSelectedAgent(null)} className="text-slate-400 hover:text-white transition-colors">
                  <Plus className="h-6 w-6 rotate-45" />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-950 border border-accent/30 flex items-center justify-center shadow-2xl translate-y-4">
                  <Bot className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">{selectedAgent.name}</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedAgent.role}</p>
                </div>
              </div>
            </div>

            <div className="p-8 pt-12 space-y-6">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5" /> Intelligence Configuration
                  </h3>
                  <Badge tone={selectedAgent.model_mode === 'custom' ? 'amber' : 'default'}>
                    {selectedAgent.model_mode === 'custom' ? 'Custom Override' : 'System Default'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-600 uppercase">Provider</label>
                    <select 
                      className="w-full bg-slate-950 border border-line rounded-xl px-4 py-2 text-sm font-bold text-slate-300 focus:outline-none"
                      value={selectedAgent.model_provider || 'openai'}
                      onChange={(e) => setSelectedAgent({...selectedAgent, model_provider: e.target.value, model_mode: 'custom'})}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="ollama">Ollama (Local)</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-600 uppercase">Model Name</label>
                    <input 
                      className="w-full bg-slate-950 border border-line rounded-xl px-4 py-2 text-sm font-bold text-slate-300 focus:outline-none"
                      value={selectedAgent.model_name || 'auto'}
                      onChange={(e) => setSelectedAgent({...selectedAgent, model_name: e.target.value, model_mode: 'custom'})}
                      placeholder="e.g. gpt-4o, auto"
                    />
                  </div>
                </div>
              </section>

              <div className="pt-6 border-t border-line flex justify-between gap-4">
                <Button variant="secondary" onClick={() => updateAgentModel(selectedAgent.id, { model_mode: 'default' })} className="border-line text-xs font-bold">
                  Reset to Default
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setSelectedAgent(null)} className="px-6">Cancel</Button>
                  <Button onClick={() => updateAgentModel(selectedAgent.id, { 
                    model_mode: 'custom', 
                    model_provider: selectedAgent.model_provider, 
                    model_name: selectedAgent.model_name 
                  })} className="px-8 bg-accent text-slate-950 font-black">
                    Update Model
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function OrgNode({ agent, isRoot, modelLabel, onClick }: { agent: any; isRoot?: boolean; modelLabel: string; onClick: () => void }) {
  const isCeo = /ceo|founder/i.test(`${agent.name} ${agent.role}`);
  return (
    <div 
      onClick={onClick}
      className={`group cursor-pointer relative flex flex-col items-center w-64 p-4 rounded-2xl border transition-all duration-300 hover:scale-105 hover:shadow-2xl ${
        isRoot 
          ? "bg-gradient-to-br from-slate-900 to-slate-950 border-sky-500/40 shadow-[0_0_20px_rgba(56,189,248,0.15)]" 
          : "bg-slate-900/60 border-line/50 hover:border-accent/40"
      }`}
    >
      <div className={`absolute -top-3 px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
        isRoot ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-400"
      }`}>
        {agent.role}
      </div>
      
      <div className="flex items-center gap-3 w-full">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
          isRoot ? "bg-sky-500/10 text-sky-400" : "bg-slate-950 text-slate-500 group-hover:text-accent"
        }`}>
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-white truncate">{agent.name}</div>
          <div className="text-[10px] text-slate-500 font-bold uppercase truncate tracking-tighter">
            {agent.model_mode === 'custom' ? 'Customized' : 'Optimal Mode'}
          </div>
        </div>
        <Settings2 className="h-4 w-4 text-slate-700 group-hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-all" />
      </div>

      <div className="mt-3 w-full pt-2 border-t border-line/30 flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Cpu className="h-3 w-3 text-slate-600 shrink-0" />
          <span className="text-[9px] text-slate-500 font-bold truncate max-w-[120px]">{modelLabel}</span>
        </div>
        <div className={`h-1.5 w-1.5 rounded-full ${agent.status === 'active' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="bg-slate-950/40 border-line/50 py-4 px-6 flex items-center gap-4">
      <div className="h-10 w-10 rounded-xl bg-slate-900 border border-line flex items-center justify-center text-slate-500">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</div>
        <div className="text-xl font-black text-white">{value}</div>
      </div>
    </Card>
  );
}

function resolvedModelLabel(agent: any, defaults: any) {
  const role = /ceo|founder/i.test(`${agent.name} ${agent.role}`) ? "ceo" : /qa|review|tester/i.test(`${agent.name} ${agent.role}`) ? "reviewer" : /manager|lead|director/i.test(`${agent.name} ${agent.role}`) ? "manager" : "worker";
  if (agent.model_mode === "custom" && agent.model_provider && agent.model_name) return agent.model_name === "auto" ? `${resolveAuto(agent.model_provider, role)}` : `${agent.model_provider}/${agent.model_name}`;
  const item = defaults?.[role] ?? defaults?.global;
  return item ? (item.model === "auto" ? `${resolveAuto(item.provider, role)}` : `${item.provider}/${item.model}`) : "Not Configured";
}

function resolveAuto(provider: string, role: string) {
  const map: Record<string, Record<string, string>> = {
    openai: { ceo: "gpt-5.5", manager: "gpt-5.5-mini", worker: "gpt-5.5-mini", reviewer: "gpt-5.5", default: "gpt-5.5-mini" },
    anthropic: { ceo: "claude-3-opus", manager: "claude-3-sonnet", worker: "claude-3-haiku", reviewer: "claude-3-sonnet", default: "claude-3-sonnet" },
    gemini: { ceo: "gemini-pro-latest", manager: "gemini-flash-latest", worker: "gemini-flash-latest", reviewer: "gemini-pro-latest", default: "gemini-flash-latest" },
    openrouter: { default: "auto" },
    ollama: { ceo: "qwen2.5", manager: "qwen2.5", worker: "llama3.2", reviewer: "qwen2.5", default: "llama3.2" },
    mock: { default: "mock" }
  };
  return map[provider]?.[role] ?? map[provider]?.default ?? provider;
}
