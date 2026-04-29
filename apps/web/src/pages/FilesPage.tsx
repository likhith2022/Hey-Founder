import { useState } from "react";
import { File, Upload } from "lucide-react";
import { api, list } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";

export function FilesPage({ companyId: _companyId }: { companyId: string }) {
  const { data, refresh } = useApi(() => list<any>("files"), []);
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const upload = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    await api("/api/files/upload", { method: "POST", body: form });
    setFile(null);
    await refresh();
  };
  const preview = async (row: any) => {
    setSelected(row);
    setError("");
    setContent("");
    try {
      const result = await api<{ data: { content: string } }>(`/api/files/${row.id}/content`);
      setContent(result.data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  };
  return (
    <div>
      <PageHeader title="Files" description="Upload and preview local text files stored under data/files with traversal protection." action={<div className="flex flex-wrap gap-2"><input className="input max-w-xs" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><Button onClick={upload} disabled={!file}><Upload className="h-4 w-4" />Upload</Button></div>} />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>{(data ?? []).length ? <div className="grid gap-2">{(data ?? []).map((item) => <button key={item.id} className={`rounded-md border p-3 text-left ${selected?.id === item.id ? "border-sky-300 bg-sky-950/40" : "border-line bg-slate-950"}`} onClick={() => preview(item)}><div className="flex items-center gap-2"><File className="h-4 w-4 text-accent" /><span className="font-medium">{item.name}</span></div><div className="mt-2 flex flex-wrap gap-2"><Badge>{item.mime_type || "unknown"}</Badge><Badge>{Number(item.size ?? 0)} bytes</Badge></div></button>)}</div> : <p className="text-sm text-slate-400">No files yet. Upload product notes, research briefs, brand voice docs, or target-customer notes for agents to read.</p>}</Card>
        <Card>{selected ? <div><h2 className="mb-2 font-semibold">{selected.name}</h2>{error ? <p className="text-sm text-red-300">{error}</p> : <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-md border border-line bg-slate-950 p-4 text-sm text-slate-200">{content || "Loading preview..."}</pre>}</div> : <p className="text-sm text-slate-400">Select a file to preview readable text content.</p>}</Card>
      </div>
    </div>
  );
}
