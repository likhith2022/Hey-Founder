import { useState } from "react";
import { BookOpen, Search, Plus, Save, Trash2, Tag, ChevronRight } from "lucide-react";
import { list, api, create, patch } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";

export function WikiPage({ companyId }: { companyId: string }) {
  const { data: pages, refresh } = useApi(async () => {
    const all = await list<any>("wiki");
    return all.filter((p: any) => p.company_id === companyId);
  }, [companyId]);

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general" });
  const [search, setSearch] = useState("");

  const selectedPage = pages?.find((p: any) => p.id === selectedPageId);

  const startNew = () => {
    setForm({ title: "", content: "", category: "general" });
    setSelectedPageId(null);
    setEditing(true);
  };

  const startEdit = () => {
    if (!selectedPage) return;
    setForm({ title: selectedPage.title, content: selectedPage.content || "", category: selectedPage.category || "general" });
    setEditing(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    if (selectedPageId) {
      await patch("wiki", selectedPageId, form);
    } else {
      const created = (await create("wiki", { ...form, company_id: companyId })) as any;
      setSelectedPageId(created.id);
    }
    setEditing(false);
    await refresh();
  };

  const deletePage = async (id: string) => {
    if (!confirm("Delete this knowledge page?")) return;
    await api(`/api/wiki/${id}`, { method: "DELETE" });
    setSelectedPageId(null);
    await refresh();
  };

  const filtered = (pages ?? []).filter((p: any) => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    p.content?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-8">
      {/* Wiki Header */}
      <div className="flex items-center justify-between border-b border-line bg-slate-900/30 px-8 py-5 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <BookOpen className="h-6 w-6" />
            </div>
            Company Wiki
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Institutional knowledge & SOPs</p>
        </div>
        <Button onClick={startNew} className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-[0_0_15px_rgba(56,189,248,0.2)]">
          <Plus className="mr-2 h-4 w-4" /> New Article
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Navigation Sidebar */}
        <aside className="w-80 shrink-0 flex flex-col border-r border-line bg-slate-950/50">
          <div className="p-4 border-b border-line/50">
            <div className="relative group">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 group-focus-within:text-sky-400 transition-colors" />
              <input 
                className="w-full rounded-xl border border-line bg-slate-900/50 pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:border-sky-400/50 focus:outline-none transition-all" 
                placeholder="Find knowledge..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
            {filtered.map((page: any) => (
              <button
                key={page.id}
                onClick={() => { setSelectedPageId(page.id); setEditing(false); }}
                className={`group flex w-full flex-col gap-1 rounded-xl px-4 py-3 text-left transition-all ${
                  selectedPageId === page.id 
                    ? "bg-sky-400/10 border border-sky-400/20 shadow-inner" 
                    : "hover:bg-slate-900/60"
                }`}
              >
                <span className={`text-sm font-bold truncate ${selectedPageId === page.id ? "text-sky-400" : "text-slate-300"}`}>
                  {page.title}
                </span>
                <div className="flex items-center gap-2">
                  <Badge tone="default" className="text-[9px] uppercase tracking-tighter h-4 px-1.5 opacity-60">
                    {page.category || "general"}
                  </Badge>
                  <span className="text-[10px] text-slate-600 font-medium">
                    {new Date(page.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-20 text-center">
                <Search className="h-8 w-8 text-slate-800 mx-auto mb-3" />
                <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">No matching articles</p>
              </div>
            )}
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 bg-slate-950/40 relative">
          <div className="absolute inset-0 overflow-y-auto p-12">
            <div className="max-w-3xl mx-auto">
              {editing ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Article Title</label>
                    <input 
                      className="w-full bg-transparent text-4xl font-black text-white outline-none placeholder:text-slate-800"
                      placeholder="The Future of Our Company..."
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                  
                  <div className="flex items-center gap-4 py-4 border-y border-line/30">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-slate-500" />
                      <input 
                        className="bg-transparent text-sm font-bold text-sky-400 outline-none placeholder:text-slate-700"
                        placeholder="Add Category (e.g. Research)"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                      />
                    </div>
                  </div>

                  <textarea 
                    className="w-full min-h-[500px] bg-transparent text-slate-300 outline-none resize-none leading-relaxed text-xl placeholder:text-slate-800"
                    placeholder="Document your Institutional Knowledge here..."
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                  />

                  <div className="flex justify-end gap-3 pt-8 border-t border-line/30">
                    <Button variant="secondary" onClick={() => setEditing(false)} className="px-6">Discard</Button>
                    <Button onClick={save} className="px-8 bg-sky-500 text-slate-950 font-bold"><Save className="mr-2 h-4 w-4" /> Save Article</Button>
                  </div>
                </div>
              ) : selectedPage ? (
                <article className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Badge tone="default" className="bg-sky-500/10 text-sky-400 border-sky-500/20 px-3 py-1 text-xs font-black uppercase">
                          {selectedPage.category || "general"}
                        </Badge>
                        <span className="text-xs text-slate-500 font-medium">Last updated {new Date(selectedPage.updated_at).toLocaleDateString()}</span>
                      </div>
                      <h1 className="text-5xl font-black text-white leading-tight">{selectedPage.title}</h1>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="secondary" onClick={startEdit} className="bg-slate-900 border-line hover:bg-slate-800 transition-all">Edit Article</Button>
                      <button onClick={() => deletePage(selectedPage.id)} className="p-2.5 rounded-xl bg-slate-900 border border-line text-slate-600 hover:text-rose-400 hover:border-rose-400/30 transition-all">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="prose prose-invert max-w-none">
                    <div className="h-px w-20 bg-sky-500/50 mb-10" />
                    <div className="whitespace-pre-wrap text-slate-300 leading-relaxed text-xl font-medium tracking-tight">
                      {selectedPage.content || "This article has no content yet."}
                    </div>
                  </div>
                </article>
              ) : (
                <div className="flex flex-col items-center justify-center py-40 text-center">
                  <div className="h-24 w-24 rounded-3xl bg-slate-900 border border-line flex items-center justify-center mb-6 shadow-2xl">
                    <BookOpen className="h-10 w-10 text-slate-700" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-300">Knowledge Repository</h3>
                  <p className="mt-2 text-slate-500 max-w-xs mx-auto">Select an article from the sidebar to view your company's collective intelligence.</p>
                  <Button variant="secondary" className="mt-8 px-8 border-line hover:border-sky-400/50 hover:text-sky-400 transition-all" onClick={startNew}>
                    <Plus className="mr-2 h-4 w-4" /> Create First Article
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
