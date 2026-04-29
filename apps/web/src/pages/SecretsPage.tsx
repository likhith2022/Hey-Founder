import { useEffect, useState } from "react";
import { KeyRound, Plus, Save, SlidersHorizontal } from "lucide-react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";

const modelPresets: Record<string, string[]> = {
  openai: ["auto", "gpt-5.5", "gpt-5.5-mini", "gpt-5.4", "gpt-5.4-mini", "gpt-5.1", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "custom"],
  anthropic: ["auto", "claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4-7-latest", "claude-sonnet-4-6-latest", "custom"],
  gemini: ["auto", "gemini-3.1-pro", "gemini-3-flash", "gemini-3.1-flash-lite", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash", "custom"],
  openrouter: ["auto", "openrouter/auto", "custom"],
  ollama: ["auto", "llama3.2", "mistral", "qwen2.5", "custom"],
  resend: ["api_tool"],
  twitter: ["api_tool"],
  linkedin: ["api_tool"],
  smtp: ["api_tool"],
  serper: ["api_tool"]
};

const roles = [
  ["ceo", "CEO default model"],
  ["manager", "Manager default model"],
  ["worker", "Worker default model"],
  ["reviewer", "Reviewer default model"],
  ["global", "Global fallback model"]
] as const;

export function SecretsPage() {
  const { data, refresh } = useApi(async () => {
    const [secrets, settings] = await Promise.all([api<{ data: any[] }>("/api/secrets").then((r) => r.data), api<any>("/api/settings").then((r) => r.data)]);
    return { secrets, settings };
  }, []);
  const [provider, setProvider] = useState("openai");
  const [value, setValue] = useState("");
  const [defaults, setDefaults] = useState<Record<string, { provider: string; model: string }>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testingDefaults, setTestingDefaults] = useState(false);
  const [defaultResults, setDefaultResults] = useState<any[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  useEffect(() => {
    const incoming = data?.settings?.model_defaults;
    if (incoming) setDefaults(Object.fromEntries(Object.entries(incoming).filter(([, item]) => Boolean(item))) as Record<string, { provider: string; model: string }>);
  }, [data?.settings?.model_defaults]);
  const configured = new Set((data?.secrets ?? []).map((secret) => secret.provider));
  const save = async () => {
    if (provider === "twitter" || provider === "linkedin") {
      const [clientId, clientSecret] = value.split(":");
      await Promise.all([
        api("/api/secrets", { method: "POST", body: JSON.stringify({ name: `${provider}_client_id`, provider, value: clientId }) }),
        api("/api/secrets", { method: "POST", body: JSON.stringify({ name: `${provider}_client_secret`, provider, value: clientSecret }) })
      ]);
    } else if (provider === "smtp") {
      // Expecting host:port:user:pass:from
      const [host, port, user, pass, from] = value.split(":");
      await api("/api/secrets", { method: "POST", body: JSON.stringify({ name: "smtp", provider: "smtp", value: JSON.stringify({ host, port, user, pass, from }) }) });
    } else {
      await api("/api/secrets", { method: "POST", body: JSON.stringify({ name: provider, provider, type: provider === "ollama" ? "base_url" : "api_key", value }) });
    }
    setValue("");
    await refresh();
  };
  const connectSocial = (platform: string) => {
    window.open(`http://localhost:7878/api/auth/social/connect/${platform}`, "social_connect", "width=600,height=600");
  };
  const testProvider = async (name: string) => {
    setTesting(name);
    try {
      const defaultModel = Object.values(defaults).find((item) => item.provider === name)?.model ?? "auto";
      await api("/api/secrets/test-provider", { method: "POST", body: JSON.stringify({ provider: name, model: defaultModel }) });
    } catch {
      // The backend stores invalid status and last error; refresh renders it.
    } finally {
      setTesting(null);
      await refresh();
    }
  };
  const saveDefaults = async () => {
    const body = Object.fromEntries(roles.flatMap(([key]) => {
      const item = defaults[key];
      return item ? [[`default_model_${key}_provider`, item.provider], [`default_model_${key}_model`, item.model]] : [];
    }));
    await api("/api/settings", { method: "PATCH", body: JSON.stringify(body) });
    setSaveMessage("Defaults saved.");
    await refresh();
  };
  const testDefaults = async () => {
    setTestingDefaults(true);
    try {
      const result = await api<{ data: any[] }>("/api/secrets/test-defaults", { method: "POST", body: JSON.stringify({}) });
      setDefaultResults(result.data);
    } finally {
      setTestingDefaults(false);
      await refresh();
    }
  };
  return (
    <div>
      <PageHeader title="API Keys & AI Models" description="Configure your AI brains and automation tool credentials here." />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <KeyRound className="mb-3 h-5 w-5 text-accent" />
          <div className="grid gap-3">
            <select aria-label="Secret Provider" className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {Object.keys(modelPresets).map((p) => <option key={p}>{p}</option>)}
            </select>
            <input 
              className="input" 
              type="password" 
              placeholder={provider === "ollama" ? "http://localhost:11434" : (provider === "twitter" || provider === "linkedin") ? "Client ID : Client Secret" : provider === "smtp" ? "host:port:user:pass:from" : "API key"} 
              value={value} 
              onChange={(e) => setValue(e.target.value)} 
            />
            <Button onClick={save}><Plus className="h-4 w-4" />Save Credentials</Button>
            
            <div className="mt-2 rounded-md bg-slate-900/50 p-2 text-[10px] leading-relaxed text-slate-400">
              <span className="font-semibold text-accent uppercase tracking-wider block mb-1">Setup Guide:</span>
              {provider === "twitter" || provider === "linkedin" ? (
                <>
                  1. Register an app on {provider.charAt(0).toUpperCase() + provider.slice(1)} Developer Portal.<br/>
                  2. Set Redirect URI to <code className="text-emerald-400">http://localhost:7878/api/auth/social/callback</code>.<br/>
                  3. Enter <code className="text-white">ClientID:ClientSecret</code> above, save, then click Connect.
                </>
              ) : provider === "smtp" ? (
                <>
                  Enter format: <code className="text-white">host:port:user:pass:from_email</code><br/>
                  Example: <code className="text-slate-300">smtp.gmail.com:465:me@gmail.com:pw123:me@gmail.com</code>
                </>
              ) : provider === "resend" ? (
                <>
                  Get your API key from <a href="https://resend.com" target="_blank" className="text-emerald-400 hover:underline">resend.com</a>. Simple and recommended for emails.
                </>
              ) : provider === "serper" ? (
                <>
                  Get a free search API key from <a href="https://serper.dev" target="_blank" className="text-emerald-400 hover:underline">serper.dev</a>. Enables real-time Google Search.
                </>
              ) : (
                <>Enter your {provider} API key or Base URL to enable AI model features.</>
              )}
            </div>

            {(provider === "twitter" || provider === "linkedin") && (
              <Button variant="secondary" onClick={() => connectSocial(provider)} disabled={!configured.has(provider)}>
                Connect {provider.charAt(0).toUpperCase() + provider.slice(1)} Account
              </Button>
            )}
          </div>
        </Card>
        <Card><div className="mb-3 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-accent" /><h2 className="font-semibold">Connected Providers</h2></div><div className="grid gap-3 md:grid-cols-2">{Object.entries(modelPresets).map(([name, models]) => {
          const isTool = models.includes("api_tool");
          const status = providerStatus(data?.settings?.provider_statuses?.[name], configured.has(name));
          return <div key={name} role="region" aria-label={`${name} provider`} className="rounded-md border border-line bg-slate-950 p-3"><div className="flex items-center justify-between gap-3"><span className="font-medium capitalize">{name}</span><Badge tone={statusTone(status.status)}>{statusLabel(status.status)}</Badge></div>{!isTool && <div className="mt-3 flex flex-wrap gap-1">{models.filter((model) => model !== "custom").map((model) => <Badge key={model}>{model === "auto" ? "Auto" : model}</Badge>)}<Badge>custom model</Badge></div>}<div className="mt-3 text-xs text-slate-500"><div>{status.last_checked_at ? `Key checked ${new Date(status.last_checked_at).toLocaleString()}` : "Key not tested yet"}</div>{!isTool && <><div>Last tested model: {status.model_tested_model ?? "none"}</div><div>Model test: {status.model_test_status ?? "untested"}</div></>}{selectedBuildModels(data?.settings?.model_defaults).includes(name) && status.status === "verified" && status.model_test_status === "untested" && <div className="mt-1 text-amber-300">Key verified. Selected model not tested.</div>}{status.model_test_error && <div className="mt-1 text-red-300">{status.model_test_error}</div>}{status.warning && <div className="mt-1 text-amber-300">{status.warning}</div>}{status.last_error && <div className="mt-1 text-red-300">{status.last_error}</div>}</div><div className="mt-3 flex justify-end"><Button variant="secondary" disabled={status.status === "not_configured" || testing === name || isTool} onClick={() => testProvider(name)}>{testing === name ? "Testing..." : isTool ? "Ready" : "Test Connection"}</Button></div></div>;
        })}</div></Card>
      </div>
      <Card className="mt-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Default Model Roles</h2><div className="flex gap-2"><Button variant="secondary" onClick={testDefaults} disabled={testingDefaults}>{testingDefaults ? "Testing..." : "Test Current Defaults"}</Button><Button onClick={saveDefaults}><Save className="h-4 w-4" />Save Defaults</Button></div></div>{saveMessage && <p className="mb-3 text-sm text-emerald-300">{saveMessage}</p>}<div className="grid gap-3 md:grid-cols-5">{roles.map(([key, label]) => <DefaultModel key={key} label={label} value={defaults[key]} onChange={(next) => { setSaveMessage(""); setDefaults({ ...defaults, [key]: next }); }} />)}</div>{defaultResults.length > 0 && <div className="mt-4 grid gap-2 md:grid-cols-5">{defaultResults.map((result) => <div key={result.role} className="rounded-md border border-line bg-slate-950 p-2 text-xs"><div className="font-medium capitalize">{result.role}</div><Badge tone={result.status === "verified" ? "green" : result.status === "warning" ? "amber" : "red"}>{result.status}</Badge><div className="mt-1 text-slate-400">{result.model ?? "not configured"}</div>{result.warning && <div className="mt-1 text-amber-300">{result.warning}</div>}{result.error && <div className="mt-1 text-red-300">{result.error}</div>}</div>)}</div>}<p className="mt-3 text-xs text-slate-500">Defaults guide new hires and run-time fallback. Each employee can still override provider and model on their profile.</p></Card>
    </div>
  );
}

function DefaultModel({ label, value, onChange }: { label: string; value?: { provider: string; model: string }; onChange: (value: { provider: string; model: string }) => void }) {
  const provider = value?.provider ?? "openai";
  const models = modelPresets[provider] ?? [];
  const selectedModel = models.includes(value?.model ?? "") ? value?.model ?? "auto" : "custom";
  return <label className="grid gap-1 text-sm"><span className="text-slate-400">{label}</span><select aria-label={`${label} provider`} className="input" value={provider} onChange={(event) => onChange({ provider: event.target.value, model: "auto" })}>{Object.entries(modelPresets).filter(([, models]) => !models.includes("api_tool")).map(([item]) => <option key={item}>{item}</option>)}</select><select aria-label={`${label} model`} className="input" value={selectedModel} onChange={(event) => onChange({ provider, model: event.target.value === "custom" ? "" : event.target.value })}>{models.map((model) => <option key={model} value={model}>{model === "auto" ? "Auto" : model === "custom" ? "Custom model..." : model}</option>)}</select>{selectedModel === "custom" && <input className="input" placeholder="provider/model-name" value={value?.model ?? ""} onChange={(event) => onChange({ provider, model: event.target.value })} />}<span className="text-xs text-slate-500">{(value?.model ?? "auto") === "auto" ? `Auto will use ${resolveAuto(provider, label)} for ${label.split(" ")[0]}` : "Exact model will be tested when provider connection is tested."}</span></label>;
}

function providerStatus(status: any, hasSecret: boolean) {
  if (status?.status) return status;
  return { status: hasSecret ? "unverified" : "not_configured", last_checked_at: null, last_error: null, model_test_status: "untested" };
}

function statusLabel(status: string) {
  if (status === "verified") return "verified";
  if (status === "invalid") return "invalid key/config";
  if (status === "unverified") return "saved, not tested";
  return "not configured";
}

function statusTone(status: string) {
  if (status === "verified") return "green";
  if (status === "invalid") return "red";
  if (status === "unverified") return "amber";
  return "default";
}

function resolveAuto(provider: string, label: string) {
  const role = label.toLowerCase().includes("ceo") ? "ceo" : label.toLowerCase().includes("manager") ? "manager" : label.toLowerCase().includes("reviewer") ? "reviewer" : label.toLowerCase().includes("worker") ? "worker" : "default";
  const map: Record<string, Record<string, string>> = {
    openai: { ceo: "gpt-5.5", manager: "gpt-5.5-mini", worker: "gpt-5.5-mini", reviewer: "gpt-5.5", default: "gpt-5.5-mini" },
    anthropic: { ceo: "claude-opus-4-7", manager: "claude-sonnet-4-6", worker: "claude-haiku-4-5", reviewer: "claude-sonnet-4-6", default: "claude-sonnet-4-6" },
    gemini: { ceo: "gemini-3.1-pro", manager: "gemini-3-flash", worker: "gemini-3.1-flash-lite", reviewer: "gemini-3.1-pro", default: "gemini-3-flash" },
    openrouter: { default: "openrouter/auto" },
    ollama: { ceo: "qwen2.5", manager: "qwen2.5", worker: "llama3.2", reviewer: "qwen2.5", default: "llama3.2" }
  };
  return map[provider]?.[role] ?? map[provider]?.default ?? "provider default";
}

function selectedBuildModels(defaults: any) {
  return Object.values(defaults ?? {}).map((item: any) => item?.provider).filter(Boolean);
}
