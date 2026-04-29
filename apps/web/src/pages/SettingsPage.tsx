import { useEffect, useState } from "react";
import { DatabaseBackup, PauseCircle, RotateCcw, Save, ShieldCheck, WalletCards } from "lucide-react";
import { api, patch } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";

export function SettingsPage({ companyId }: { companyId: string }) {
  const { data, refresh } = useApi(() => api<any>(`/api/settings?company_id=${encodeURIComponent(companyId)}`).then((r) => r.data), [companyId]);
  const [password, setPassword] = useState("");
  const [max, setMax] = useState(2);
  const [hours, setHours] = useState("Mon-Fri 09:00-17:00");
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  useEffect(() => {
    setMax(Number(data?.max_concurrent_runs ?? 2));
    setHours(data?.company?.working_hours ?? "Mon-Fri 09:00-17:00");
    setMonthlyBudget(Number(data?.company?.monthly_budget ?? 0));
  }, [data]);
  const save = async () => {
    await api("/api/settings", { method: "PATCH", body: JSON.stringify({ company_id: companyId, max_concurrent_runs: max, working_hours: hours, monthly_budget: monthlyBudget, password: password || undefined }) });
    setPassword("");
    await refresh();
  };
  const emergency = async (value: 0 | 1) => {
    await api("/api/settings", { method: "PATCH", body: JSON.stringify({ company_id: companyId, emergency_stopped: value }) });
    await refresh();
  };
  return (
    <div>
      <PageHeader title="Settings" description="Local company, security, backup, emergency stop, concurrency, and budget controls." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Company Operations</h2><Badge tone={data?.company?.emergency_stopped ? "red" : "green"}>{data?.company?.emergency_stopped ? "Stopped" : "Operating"}</Badge></div>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm"><span className="text-slate-400">Working hours</span><input className="input" value={hours} onChange={(e) => setHours(e.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="text-slate-400">Max concurrent runs</span><input className="input" type="number" min={1} max={32} value={max} onChange={(e) => setMax(Number(e.target.value))} /></label>
            <Button onClick={save}><Save className="h-4 w-4" />Save Settings</Button>
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2"><WalletCards className="h-4 w-4 text-accent" /><h2 className="font-semibold">Budget</h2></div>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm"><span className="text-slate-400">Monthly company budget</span><input className="input" type="number" min={0} step="0.01" value={monthlyBudget} onChange={(e) => setMonthlyBudget(Number(e.target.value))} /></label>
            <div className="rounded-md border border-line bg-slate-950 p-3 text-sm"><div className="flex justify-between"><span className="text-slate-400">Budget used</span><span>${Number(data?.company?.budget_used ?? 0).toFixed(2)}</span></div><div className="mt-1 flex justify-between"><span className="text-slate-400">Remaining</span><span>${Math.max(0, monthlyBudget - Number(data?.company?.budget_used ?? 0)).toFixed(2)}</span></div></div>
            <Button onClick={save}>Save Budget</Button>
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /><h2 className="font-semibold">Security</h2></div>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm"><span className="text-slate-400">Change local admin password</span><input className="input" type="password" placeholder="New admin password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <Button onClick={save} disabled={Boolean(password) && password.length < 10}>Update Password</Button>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Emergency Stop</h2>
          <p className="mb-3 text-sm text-slate-400">Emergency stop blocks new runs and pauses queued jobs until a local admin resets it.</p>
          <div className="flex flex-wrap gap-2"><Button variant="danger" onClick={() => emergency(1)}><PauseCircle className="h-4 w-4" />Emergency Stop</Button><Button variant="secondary" onClick={() => emergency(0)}><RotateCcw className="h-4 w-4" />Reset Emergency Stop</Button></div>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Backup/Restore</h2>
          <p className="mb-3 text-sm text-slate-400">Backups export SQLite plus local files, work products, and logs. Secrets remain encrypted and decrypted values are never exported.</p>
          <Button onClick={async () => { await api("/api/backup", { method: "POST" }); await refresh(); }}><DatabaseBackup className="h-4 w-4" />Backup Now</Button>
        </Card>
      </div>
    </div>
  );
}
