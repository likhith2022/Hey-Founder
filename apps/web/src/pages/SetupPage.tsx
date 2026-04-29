import { useState } from "react";
import { Building2 } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export function SetupPage() {
  const [form, setForm] = useState({ companyName: "", description: "", industry: "", productsServices: "", targetCustomers: "", currentProblems: "", mainGoals: "", preferredTone: "", riskTolerance: "medium", externalActionsRequireApproval: true, password: "" });
  const [error, setError] = useState("");
  const submit = async () => {
    try {
      const result = await api<{ companyId: string }>("/api/setup", { method: "POST", body: JSON.stringify(form) });
      localStorage.setItem("companyId", result.companyId);
      location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    }
  };
  const update = (key: string, value: string | boolean) => setForm({ ...form, [key]: value });
  return (
    <div className="grid min-h-screen place-items-center bg-surface p-6 text-slate-100">
      <Card className="w-full max-w-3xl">
        <Building2 className="mb-4 h-8 w-8 text-accent" />
        <h1 className="text-2xl font-semibold">Build your local AI company</h1>
        <p className="mt-1 text-sm text-slate-400">Tell the CEO Agent what business it is running. Setup creates only the CEO Agent; the CEO will later propose the right departments and employees for founder approval.</p>
        {error && <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Field label="Company name"><input className="input" placeholder="Company name" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} /></Field>
          <Field label="Industry"><input className="input" placeholder="Software, agency, ecommerce..." value={form.industry} onChange={(e) => update("industry", e.target.value)} /></Field>
          <Field label="Business description"><textarea className="input min-h-24" placeholder="What does this business do?" value={form.description} onChange={(e) => update("description", e.target.value)} /></Field>
          <Field label="Products/services"><textarea className="input min-h-24" placeholder="What do you sell or plan to sell?" value={form.productsServices} onChange={(e) => update("productsServices", e.target.value)} /></Field>
          <Field label="Target customers"><textarea className="input min-h-24" placeholder="Who buys or uses this?" value={form.targetCustomers} onChange={(e) => update("targetCustomers", e.target.value)} /></Field>
          <Field label="Current business problems"><textarea className="input min-h-24" placeholder="What is slowing the business down?" value={form.currentProblems} onChange={(e) => update("currentProblems", e.target.value)} /></Field>
          <Field label="Main goals"><textarea className="input min-h-24" placeholder="What should the company accomplish first?" value={form.mainGoals} onChange={(e) => update("mainGoals", e.target.value)} /></Field>
          <Field label="Preferred tone/style"><textarea className="input min-h-24" placeholder="Direct, premium, technical, friendly..." value={form.preferredTone} onChange={(e) => update("preferredTone", e.target.value)} /></Field>
          <Field label="Risk tolerance"><select className="input" value={form.riskTolerance} onChange={(e) => update("riskTolerance", e.target.value)}>{["low", "medium", "high"].map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Local admin password"><input className="input" placeholder="Local admin password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-2"><input type="checkbox" checked={form.externalActionsRequireApproval} onChange={(e) => update("externalActionsRequireApproval", e.target.checked)} />External actions should always require founder approval</label>
          <div className="md:col-span-2"><Button onClick={submit} disabled={!form.companyName || form.password.length < 10}>Create CEO Agent</Button></div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm"><span className="text-slate-400">{label}</span>{children}</label>;
}
