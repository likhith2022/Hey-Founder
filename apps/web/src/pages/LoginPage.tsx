import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async () => {
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
      location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };
  return (
    <div className="grid min-h-screen place-items-center bg-surface p-6 text-slate-100">
      <Card className="w-full max-w-md">
        <LockKeyhole className="mb-4 h-8 w-8 text-accent" />
        <h1 className="text-2xl font-semibold">Local admin login</h1>
        {error && <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"><div>{error}</div>{/incorrect/i.test(error) && <div className="mt-3 text-xs leading-5 text-red-100"><p>Password is incorrect. If this is your local machine, you can reset it from terminal:</p><code className="mt-2 block rounded border border-red-400/30 bg-slate-950 p-2 text-red-100">corepack pnpm admin:reset-password "new-password"</code><p className="mt-2">After reset, restart the app and login with the new password.</p></div>}</div>}
        <div className="mt-5 grid gap-3">
          <input className="rounded-md border border-line bg-slate-950 px-3 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
          <Button onClick={submit}>Unlock Dashboard</Button>
        </div>
      </Card>
    </div>
  );
}
