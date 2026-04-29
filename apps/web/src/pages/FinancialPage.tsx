import { useMemo, useState } from "react";
import { DollarSign, TrendingUp, Wallet, ArrowUpCircle, ArrowDownCircle, Plus, Trash2 } from "lucide-react";
import { list, api, create, patch, remove } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/layout/PageHeader";

export function FinancialPage({ companyId }: { companyId: string }) {
  const { data, refresh } = useApi(async () => {
    const [ledger, runs] = await Promise.all([
      list<any>("ledger"),
      list<any>("runs")
    ]);
    return {
      ledger: ledger.filter((item: any) => item.company_id === companyId),
      runs: runs.filter((item: any) => item.company_id === companyId)
    };
  }, [companyId]);

  const [form, setForm] = useState({ type: "revenue", amount: "", description: "" });
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => {
    if (!data) return null;
    const aiBurn = data.runs.reduce((sum: number, r: any) => sum + Number(r.cost_estimate ?? 0), 0);
    const manualRevenue = data.ledger.filter((item: any) => item.type === "revenue").reduce((sum: number, item: any) => sum + item.amount, 0);
    const manualExpense = data.ledger.filter((item: any) => item.type === "expense").reduce((sum: number, item: any) => sum + item.amount, 0);
    
    return {
      aiBurn,
      manualRevenue,
      manualExpense,
      totalExpense: aiBurn + manualExpense,
      netProfit: manualRevenue - (aiBurn + manualExpense)
    };
  }, [data]);

  const saveEntry = async () => {
    if (!form.amount || !form.description) return;
    setLoading(true);
    try {
      await create("ledger", {
        company_id: companyId,
        type: form.type,
        amount: Number(form.amount),
        description: form.description
      });
      setForm({ type: "revenue", amount: "", description: "" });
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    await api(`/api/ledger/${id}`, { method: "DELETE" });
    await refresh();
  };

  if (!stats) return <div className="p-8 text-slate-400">Calculating financials...</div>;

  return (
    <div>
      <PageHeader title="Financial Command Center" description="Track AI burn, manual revenue, and overall company profitability." />
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2 text-sm text-slate-400"><DollarSign className="h-4 w-4" /> Total Revenue</div>
          <div className="mt-2 text-3xl font-bold text-emerald-400">${stats.manualRevenue.toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-500">From manual entries</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-sm text-slate-400"><Wallet className="h-4 w-4" /> Total Burn</div>
          <div className="mt-2 text-3xl font-bold text-red-400">${stats.totalExpense.toFixed(4)}</div>
          <div className="mt-1 text-xs text-slate-500">${stats.aiBurn.toFixed(4)} AI + ${stats.manualExpense.toFixed(2)} manual</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-sm text-slate-400"><TrendingUp className="h-4 w-4" /> Net Profit</div>
          <div className={`mt-2 text-3xl font-bold ${stats.netProfit >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
            ${stats.netProfit.toFixed(4)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Cash flow status</div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_350px]">
        <Card>
          <h2 className="mb-4 font-semibold">Ledger Entries</h2>
          <div className="space-y-2">
            {data?.ledger.sort((a: any, b: any) => b.id.localeCompare(a.id)).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border border-line bg-slate-950 p-3 text-sm">
                <div className="flex items-center gap-3">
                  {item.type === "revenue" ? <ArrowUpCircle className="h-5 w-5 text-emerald-400" /> : <ArrowDownCircle className="h-5 w-5 text-red-400" />}
                  <div>
                    <div className="font-medium text-slate-200">{item.description}</div>
                    <div className="text-xs text-slate-500">{new Date(item.created_at || Date.now()).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-mono font-bold ${item.type === 'revenue' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.type === 'revenue' ? '+' : '-'}${item.amount.toFixed(2)}
                  </span>
                  <button onClick={() => deleteEntry(item.id)} className="text-slate-600 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {data?.ledger.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No entries yet. Log your first revenue below.</p>}
          </div>
        </Card>

        <Card className="h-fit">
          <h2 className="mb-4 font-semibold">New Entry</h2>
          <div className="grid gap-3">
            <label className="grid gap-1 text-xs text-slate-400">
              Type
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="revenue">Revenue (+)</option>
                <option value="expense">Expense (-)</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              Amount ($)
              <input type="number" className="input" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              Description
              <input className="input" placeholder="Consulting fee, OpenAI bill, etc." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <Button onClick={saveEntry} disabled={loading} className="mt-2">
              <Plus className="mr-2 h-4 w-4" /> {loading ? "Adding..." : "Add Entry"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
