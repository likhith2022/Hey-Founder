import { useState } from "react";
import { list } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useRunEvents } from "../hooks/useRunEvents";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";

export function RunsPage() {
  const { data, refresh } = useApi(() => list<any>("runs"), []);
  const [selected, setSelected] = useState<string | null>(null);
  const events = useRunEvents(selected);
  return <div><PageHeader title="Runs" description="Run history, live Server-Sent Events, and cost estimates." action={<Button variant="secondary" onClick={refresh}>Refresh</Button>} /><div className="grid gap-4 lg:grid-cols-[1fr_420px]"><Card><table className="w-full text-left text-sm"><tbody>{(data ?? []).map((r) => <tr key={r.id} className="border-b border-line"><td className="py-3"><Badge>{r.status}</Badge></td><td><Badge>${Number(r.cost_estimate ?? 0).toFixed(2)}</Badge></td><td>{r.id}</td><td>{r.created_at}</td><td><Button variant="secondary" onClick={() => setSelected(r.id)}>Watch</Button></td></tr>)}</tbody></table></Card><Card><h2 className="mb-3 font-semibold">Live events</h2><pre className="max-h-[520px] overflow-auto whitespace-pre-wrap text-xs text-slate-300">{events.map((e) => JSON.stringify(e, null, 2)).join("\n\n") || "Select a run to watch live events."}</pre></Card></div></div>;
}
