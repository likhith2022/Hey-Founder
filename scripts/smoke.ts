import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { WebResearchTool } from "../apps/server/src/tools/WebResearchTool.js";
import { GeminiProvider } from "../apps/server/src/ai/gemini.js";
import { extractJsonObject } from "../apps/server/src/utils/extractJson.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = mkdtempSync(join(tmpdir(), "ai-company-os-smoke-"));
const port = 9787;
const ollamaPort = 19787;
const baseUrl = `http://127.0.0.1:${port}`;
let cookie = "";

const checks: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  checks.push(message);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0] ?? cookie;
  const json = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} failed: ${response.status} ${json.message ?? ""}`);
  return json;
}

async function expectFailure(path: string, init: RequestInit, status: number, label: string) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("Cookie", cookie);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  assert(response.status === status, `${label} returned expected ${status}`);
  return response.json().catch(() => ({}));
}

async function waitForHealth(server: ChildProcess) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (server.exitCode !== null) throw new Error(`Server exited early with ${server.exitCode}`);
    try {
      const health = await fetch(`${baseUrl}/api/health`);
      if (health.ok) return;
    } catch {
      // Retry until Fastify is listening.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Server did not become healthy");
}

function startMockOllama(): Promise<Server> {
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/chat") {
      req.resume();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: { content: "Smoke run completed. Created a concise operational work product." }, eval_count: 12, prompt_eval_count: 18 }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => server.listen(ollamaPort, "127.0.0.1", () => resolve(server)));
}

async function main() {
  const mockOllama = await startMockOllama();
  const server = spawn(process.execPath, ["dist/server.js"], {
    cwd: join(root, "apps/server"),
    env: { ...process.env, NODE_ENV: "test", DATA_DIR: dataDir, PORT: String(port), HOST: "127.0.0.1", MAX_CONCURRENT_RUNS: "1" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const logs: string[] = [];
  server.stdout?.on("data", (chunk) => logs.push(String(chunk)));
  server.stderr?.on("data", (chunk) => logs.push(String(chunk)));

  try {
    await waitForHealth(server);

    const setupStatus = await request<{ setupRequired: boolean }>("/api/setup/status");
    assert(setupStatus.setupRequired, "setup wizard reports setup required on a clean database");

    const setup = await request<{ companyId: string }>("/api/setup", {
      method: "POST",
      body: JSON.stringify({ companyName: "Smoke Test Co", description: "Local smoke company", industry: "Software", productsServices: "Local AI operating system", targetCustomers: "Small teams", currentProblems: "Needs focus", mainGoals: "Build the right AI company", preferredTone: "Clear and practical", riskTolerance: "low", externalActionsRequireApproval: true, password: "correct horse battery staple" })
    });
    assert(Boolean(setup.companyId), "setup creates a local company");

    await request("/api/auth/logout", { method: "POST" });
    await expectFailure("/api/settings", {}, 401, "local admin auth protects settings");
    await expectFailure("/api/auth/login", { method: "POST", body: JSON.stringify({ password: "wrong local password" }) }, 401, "wrong password fails");
    await request("/api/auth/login", { method: "POST", body: JSON.stringify({ password: "correct horse battery staple" }) });
    const settings = await request<{ data: { company: { id: string; name: string; industry: string; risk_tolerance: string } } }>("/api/settings");
    assert(settings.data.company.name === "Smoke Test Co", "local admin login restores access");
    const reset = spawnSync("corepack", ["pnpm", "exec", "tsx", "scripts/resetAdminPassword.ts", "new smoke password"], { cwd: root, env: { ...process.env, DATA_DIR: dataDir }, encoding: "utf8" });
    assert(reset.status === 0 && reset.stdout.includes("Local admin password reset successfully."), "admin:reset-password changes password");
    await expectFailure("/api/settings", {}, 401, "sessions are cleared after admin password reset");
    await expectFailure("/api/auth/login", { method: "POST", body: JSON.stringify({ password: "correct horse battery staple" }) }, 401, "old password fails after reset");
    await request("/api/auth/login", { method: "POST", body: JSON.stringify({ password: "new smoke password" }) });
    const resetSettings = await request<{ data: { company: { name: string } } }>("/api/settings");
    assert(resetSettings.data.company.name === "Smoke Test Co", "new password works after reset");
    assert(settings.data.company.industry === "Software" && settings.data.company.risk_tolerance === "low", "business profile fields are saved");
    const secondCompany = await request<{ data: any }>("/api/companies", { method: "POST", body: JSON.stringify({ name: "Second Local Co", description: "Second company for switcher coverage" }) });
    assert(Boolean(secondCompany.data.id) && secondCompany.data.id !== setup.companyId, "can create a second local company");

    const departments = await request<{ data: any[] }>("/api/departments");
    const agents = await request<{ data: any[] }>("/api/agents");
    const tools = await request<{ data: any[] }>("/api/tools");
    assert(departments.data.filter((dep) => dep.company_id === setup.companyId).length === 1 && departments.data.some((dep) => dep.name === "Executive"), "fresh setup creates only Executive department");
    assert(agents.data.filter((agent) => agent.company_id === setup.companyId).length === 1 && agents.data.some((agent) => agent.name === "CEO Agent"), "fresh setup creates only CEO Agent");
    assert(!agents.data.some((agent) => /Operations Manager|Sales Manager|Marketing Manager|Support Manager|Research Agent|Document Agent|Finance Assistant|QA Review/i.test(agent.name)), "setup does not create prebuilt worker agents");
    assert(tools.data.length >= 6, "seed data creates default tools");
    const ceo = agents.data.find((agent) => agent.name === "CEO Agent");
    assert(ceo?.model_mode === "role_default", "CEO Agent defaults to role_default after setup");
    await request("/api/settings", { method: "PATCH", body: JSON.stringify({ default_model_ceo_provider: "gemini", default_model_ceo_model: "auto" }) });
    const ceoDefaultSettings = await request<{ data: { model_defaults: any; model_default_keys: any } }>("/api/settings");
    assert(ceoDefaultSettings.data.model_defaults.ceo.provider === "gemini" && ceoDefaultSettings.data.model_defaults.ceo.model === "auto", "setting CEO default model changes resolved CEO default");
    assert(ceoDefaultSettings.data.model_default_keys.default_model_ceo_provider === "gemini" && ceoDefaultSettings.data.model_default_keys.default_model_ceo_model === "auto", "canonical CEO default keys are persisted");
    const missingBuild = await expectFailure(`/api/companies/${setup.companyId}/build-company`, { method: "POST" }, 400, "build-company without provider key returns helpful error");
    assert((missingBuild as any).error === "MISSING_PROVIDER_KEY", "missing provider key message is clear");
    await request("/api/secrets", { method: "POST", body: JSON.stringify({ name: "gemini", provider: "gemini", type: "api_key", value: "fake-gemini-key" }) });
    const unverifiedSecrets = await request<{ data: any[]; provider_statuses: any }>("/api/secrets");
    assert(unverifiedSecrets.provider_statuses.gemini.status === "unverified", "saving fake provider key sets status unverified");
    const unverifiedBuild = await expectFailure(`/api/companies/${setup.companyId}/build-company`, { method: "POST" }, 400, "build-company blocks unverified provider");
    assert((unverifiedBuild as any).error === "PROVIDER_NOT_VERIFIED", "unverified provider returns structured error");
    const statusDb = new Database(join(dataDir, "ai-company-os.sqlite"));
    statusDb.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('provider_status_gemini', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(JSON.stringify({ status: "invalid", last_checked_at: new Date().toISOString(), last_error: "Invalid API key or provider authorization failed." }));
    statusDb.close();
    const invalidBuild = await expectFailure(`/api/companies/${setup.companyId}/build-company`, { method: "POST" }, 400, "build-company blocks invalid provider");
    assert((invalidBuild as any).error === "PROVIDER_INVALID", "invalid provider returns structured error");
    const invalidMock = await expectFailure("/api/secrets/test-provider", { method: "POST", body: JSON.stringify({ provider: "mock", model: "provider-failure" }) }, 502, "invalid provider test sets status invalid");
    assert((invalidMock as any).status === "invalid", "failed provider test returns invalid status");
    const validMock = await request<{ ok: boolean; status: string; model: string }>("/api/secrets/test-provider", { method: "POST", body: JSON.stringify({ provider: "mock", model: "auto" }) });
    assert(validMock.ok && validMock.status === "verified" && validMock.model === "software-company-builder", "valid mock provider test sets status verified and resolves auto model");
    const ceoResolution = await request<{ data: any }>(`/api/debug/model-resolution?agentId=${encodeURIComponent(ceo.id)}`);
    assert(ceoResolution.data.provider === "gemini" && ceoResolution.data.name === "gemini-pro-latest", "CEO Agent role_default resolves from canonical CEO default");
    const defaultsDb = new Database(join(dataDir, "ai-company-os.sqlite"));
    defaultsDb.prepare("DELETE FROM settings WHERE key IN ('default_model_ceo_provider', 'default_model_ceo_model', 'default_model_ceo')").run();
    defaultsDb.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('default_model_global_provider', 'mock', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
    defaultsDb.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('default_model_global_model', 'auto', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
    defaultsDb.close();
    const globalResolution = await request<{ data: any }>(`/api/debug/model-resolution?agentId=${encodeURIComponent(ceo.id)}`);
    assert(globalResolution.data.source === "global_default" && globalResolution.data.provider === "mock", "global fallback resolves if CEO default is missing");
    await request("/api/settings", { method: "PATCH", body: JSON.stringify({ default_model_ceo_provider: "mock", default_model_ceo_model: "provider-failure" }) });
    const failedBuild = await expectFailure(`/api/companies/${setup.companyId}/build-company`, { method: "POST" }, 502, "build-company provider failure returns structured error");
    assert((failedBuild as any).error === "PROVIDER_REQUEST_FAILED" && (failedBuild as any).provider === "mock" && (failedBuild as any).model === "provider-failure", "build-company provider failure includes provider and model");
    await request("/api/settings", { method: "PATCH", body: JSON.stringify({ default_model_ceo_provider: "mock", default_model_ceo_model: "auto" }) });
    const defaultTests = await request<{ data: any[] }>("/api/secrets/test-defaults", { method: "POST", body: JSON.stringify({}) });
    assert(defaultTests.data.some((item) => item.role === "ceo" && item.ok === true), "test current defaults verifies resolved CEO default model");
    const build = await request<{ data: { departments: any[]; agents: any[] } }>(`/api/companies/${setup.companyId}/build-company`, { method: "POST" });
    assert(build.data.departments.length >= 4 && build.data.agents.length >= 7, "mock CEOCompanyBuilder proposes business-specific departments and employees");
    const okTest = await request<{ ok: boolean; status: string }>("/api/secrets/test-provider", { method: "POST", body: JSON.stringify({ provider: "mock", model: "ok-test" }) });
    assert(okTest.ok && okTest.status === "verified", "provider test verifies OK-like non-empty response");
    const nonstandardTest = await request<{ ok: boolean; status: string; warning?: string }>("/api/secrets/test-provider", { method: "POST", body: JSON.stringify({ provider: "mock", model: "nonstandard-test" }) });
    assert(nonstandardTest.ok && nonstandardTest.status === "verified" && Boolean(nonstandardTest.warning), "provider test verifies non-empty nonstandard response with warning");
    const emptyTest = await expectFailure("/api/secrets/test-provider", { method: "POST", body: JSON.stringify({ provider: "mock", model: "empty-response" }) }, 502, "provider test invalidates empty response");
    assert((emptyTest as any).status === "invalid", "empty provider test response is invalid");
    const authTest = await expectFailure("/api/secrets/test-provider", { method: "POST", body: JSON.stringify({ provider: "mock", model: "auth-failure" }) }, 502, "provider test invalidates auth failure");
    assert((authTest as any).status === "invalid", "auth provider test response is invalid");
    const extracted = extractJsonObject("Here is the plan:\n```json\n{\"departments\":[{\"name\":\"Ops\"}],\"agents\":[]}\n```\nThanks");
    assert(Boolean(extracted) && (extracted as any).departments?.[0]?.name === "Ops", "robust JSON extraction handles prose and fenced JSON");
    await request(`/api/agents/${ceo.id}`, { method: "PATCH", body: JSON.stringify({ model_mode: "custom", model_provider: "mock", model_name: "software-company-builder" }) });
    const ceoCustom = await request<{ data: any }>(`/api/agents/${ceo.id}`);
    assert(ceoCustom.data.model_mode === "custom" && ceoCustom.data.model_provider === "mock", "custom override takes priority over role default");
    const afterBuildAgents = await request<{ data: any[] }>("/api/agents");
    const proposedAgents = afterBuildAgents.data.filter((agent) => agent.company_id === setup.companyId && agent.created_by_type === "agent");
    assert(proposedAgents.length >= 7 && proposedAgents.every((agent) => agent.status === "pending_approval"), "CEO-created employees remain pending_approval");
    const buildApprovals = await request<{ data: any[] }>("/api/approvals");
    const firstCreateApproval = buildApprovals.data.find((approval) => approval.company_id === setup.companyId && approval.approval_type === "create_agent" && approval.status === "pending");
    assert(Boolean(firstCreateApproval), "CEO-created employee creates approval request");
    await request(`/api/approvals/${firstCreateApproval.id}/decide`, { method: "POST", body: JSON.stringify({ decision: "approved", note: "Smoke approval" }) });
    const activatedFromBuild = await request<{ data: any }>(`/api/agents/${firstCreateApproval.agent_id}`);
    assert(activatedFromBuild.data.status === "active", "approval activates CEO-built employee");
    const rejectApproval = (await request<{ data: any[] }>("/api/approvals")).data.find((approval) => approval.company_id === setup.companyId && approval.approval_type === "create_agent" && approval.status === "pending");
    assert(Boolean(rejectApproval), "another CEO-created employee can be rejected");
    await request(`/api/approvals/${rejectApproval.id}/decide`, { method: "POST", body: JSON.stringify({ decision: "rejected", note: "Smoke rejection" }) });
    const rejectedAgent = await request<{ data: any }>(`/api/agents/${rejectApproval.agent_id}`);
    assert(rejectedAgent.data.status === "archived", "rejection archives CEO-built employee");
    const differentModelAgent = await request<{ data: any }>("/api/agents", { method: "POST", body: JSON.stringify({ company_id: setup.companyId, name: "Smoke Different Model Agent", role: "Uses a different model than the CEO", system_prompt: "Test agent", model_provider: "anthropic", model_name: "claude-3-5-haiku-latest", tools: JSON.stringify(["document_tool"]), permission_level: 1 }) });
    assert(ceo?.model_name !== differentModelAgent.data.model_name, "can create agent with a different model than CEO");

    const secretValue = `http://127.0.0.1:${ollamaPort}`;
    await request("/api/secrets", { method: "POST", body: JSON.stringify({ name: "ollama", provider: "ollama", type: "base_url", value: secretValue }) });
    const secrets = await request<{ data: any[] }>("/api/secrets");
    assert(secrets.data.some((s) => s.provider === "ollama" && s.provider_status.status === "unverified" && s.configured === false), "secret save reports saved but not tested");
    assert(!JSON.stringify(secrets).includes(secretValue), "secret list does not expose decrypted values");
    const ollamaTest = await request<{ ok: boolean; status: string }>("/api/secrets/test-provider", { method: "POST", body: JSON.stringify({ provider: "ollama", model: "llama3.2" }) });
    assert(ollamaTest.ok && ollamaTest.status === "verified", "valid local provider test sets status verified");
    await request("/api/settings", { method: "PATCH", body: JSON.stringify({ default_model_worker_provider: "ollama", default_model_worker_model: "smoke-default-model", default_model_global_provider: "ollama", default_model_global_model: "smoke-global-model" }) });
    const modelSettings = await request<{ data: { model_defaults: any } }>("/api/settings");
    assert(modelSettings.data.model_defaults.worker.model === "smoke-default-model", "model default persistence stores worker model");
    await request("/api/settings", { method: "PATCH", body: JSON.stringify({ default_model_worker_provider: "ollama", default_model_worker_model: "auto" }) });
    const autoWorker = await request<{ data: any }>("/api/agents", { method: "POST", body: JSON.stringify({ company_id: setup.companyId, name: "Smoke Auto Worker", role: "Worker auto model", system_prompt: "Test auto worker model", model_mode: "role_default", tools: JSON.stringify(["document_tool"]), permission_level: 1 }) });
    assert(autoWorker.data.model_mode === "role_default", "agent card/model resolver supports role default auto");

    const freshGoals = await request<{ data: any[] }>("/api/goals");
    assert(freshGoals.data.filter((item) => item.company_id === setup.companyId).length === 0, "fresh company has no goals");
    const goal = await request<{ data: any }>("/api/goals", {
      method: "POST",
      body: JSON.stringify({ company_id: setup.companyId, title: "Launch a smoke-tested local workflow", description: "Validate the core API flow.", priority: "high" })
    });
    assert(Boolean(goal.data.id), "goal creation succeeds");
    assert(goal.data.company_id === setup.companyId, "created goal belongs to selected company");

    const plan = await request<{ data: { projects: string[]; tasks: string[] } }>(`/api/goals/${goal.data.id}/plan`, { method: "POST" });
    assert(plan.data.projects.length > 0 && plan.data.tasks.length > 0, "CEO planning creates projects and tasks");

    const plannedAgents = await request<{ data: any[] }>("/api/agents");
    const pendingAgent = plannedAgents.data.find((agent) => agent.created_by_type === "agent" && agent.status === "pending_approval");
    assert(Boolean(pendingAgent), "CEO-created agent starts as pending_approval");

    await expectFailure(`/api/agents/${pendingAgent.id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }, 403, "CEO-created agent cannot be directly activated");

    const approvals = await request<{ data: any[] }>("/api/approvals");
    const approval = approvals.data.find((item) => item.agent_id === pendingAgent.id && item.status === "pending");
    assert(Boolean(approval), "CEO-created agent creates approval request");
    await request(`/api/approvals/${approval.id}/decide`, { method: "POST", body: JSON.stringify({ decision: "approved", note: "Smoke approval" }) });
    const activated = await request<{ data: any }>(`/api/agents/${pendingAgent.id}`);
    assert(activated.data.status === "active", "approval activates CEO-created agent");

    const task = (await request<{ data: any[] }>("/api/tasks")).data.find((item) => plan.data.tasks.includes(item.id));
    assert(Boolean(task), "planned task exists");
    const inheritedAgent = await request<{ data: any }>("/api/agents", { method: "POST", body: JSON.stringify({ company_id: setup.companyId, name: "Smoke Default Model Worker", role: "Worker who inherits defaults", system_prompt: "Test default model inheritance", tools: JSON.stringify(["document_tool"]), permission_level: 1 }) });
    const inheritedTask = await request<{ data: any }>("/api/tasks", { method: "POST", body: JSON.stringify({ company_id: setup.companyId, assigned_agent_id: inheritedAgent.data.id, title: "Use inherited model", description: "Should use worker default model.", status: "todo" }) });
    const inheritedRun = await request<{ data: { runId: string; status: string } }>("/api/runs/run-task", { method: "POST", body: JSON.stringify({ taskId: inheritedTask.data.id }) });
    assert(inheritedRun.data.status === "completed", "agent without model inherits role default model");
    await request(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ assigned_agent_id: activated.data.id }) });
    await request(`/api/agents/${activated.data.id}`, { method: "PATCH", body: JSON.stringify({ model_mode: "custom", model_provider: "ollama", model_name: "auto" }) });
    const customAuto = await request<{ data: any }>(`/api/agents/${activated.data.id}`);
    assert(customAuto.data.model_mode === "custom" && customAuto.data.model_name === "auto", "custom override auto is saved for runtime resolution");
    const run = await request<{ data: { runId: string; status: string } }>("/api/runs/run-task", { method: "POST", body: JSON.stringify({ taskId: task.id }) });
    assert(run.data.status === "completed", "task run completes through local mock provider");

    const db = new Database(join(dataDir, "ai-company-os.sqlite"));
    const runSteps = db.prepare("SELECT COUNT(*) AS count FROM run_steps WHERE run_id = ?").get(run.data.runId) as { count: number };
    const workProducts = db.prepare("SELECT COUNT(*) AS count FROM work_products WHERE run_id = ?").get(run.data.runId) as { count: number };
    const memories = db.prepare("SELECT COUNT(*) AS count FROM memories WHERE source_run_id = ?").get(run.data.runId) as { count: number };
    const auditLogs = db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE resource_id = ? OR action IN ('run_started','run_completed')").get(run.data.runId) as { count: number };
    assert(runSteps.count > 0, "task run creates run steps");
    assert(workProducts.count > 0, "task run creates work product");
    assert(memories.count > 0, "task run creates memory");
    assert(auditLogs.count > 0, "task run creates audit log");
    db.prepare("UPDATE companies SET monthly_budget = 1, budget_used = 1 WHERE id = ?").run(setup.companyId);
    await expectFailure("/api/runs/run-task", { method: "POST", body: JSON.stringify({ taskId: task.id }) }, 402, "company budget blocks task runs when exhausted");
    db.prepare("UPDATE companies SET monthly_budget = 0, budget_used = 0 WHERE id = ?").run(setup.companyId);
    db.prepare("UPDATE agents SET budget_limit = 1, budget_used = 1 WHERE id = ?").run(activated.data.id);
    await expectFailure("/api/runs/run-task", { method: "POST", body: JSON.stringify({ taskId: task.id }) }, 402, "agent budget blocks task runs when exhausted");
    db.prepare("UPDATE agents SET budget_limit = 0, budget_used = 0 WHERE id = ?").run(activated.data.id);

    await request("/api/settings", { method: "PATCH", body: JSON.stringify({ emergency_stopped: 1 }) });
    db.prepare("INSERT INTO jobs (id, type, payload, status, attempts, max_attempts, created_at, updated_at) VALUES ('job_smoke', 'daily_report', ?, 'queued', 0, 3, datetime('now'), datetime('now'))").run(JSON.stringify({ companyId: setup.companyId }));
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const job = db.prepare("SELECT status FROM jobs WHERE id = 'job_smoke'").get() as { status: string };
    assert(job.status === "paused", "emergency stop pauses queued jobs");

    const stoppedRun = await expectFailure("/api/runs/run-task", { method: "POST", body: JSON.stringify({ taskId: task.id }) }, 423, "emergency stop blocks direct task runs");
    assert(JSON.stringify(stoppedRun).includes("Emergency stop"), "emergency stop returns clear error");
    await request("/api/settings", { method: "PATCH", body: JSON.stringify({ emergency_stopped: 0 }) });

    const backup = await request<{ data: { path: string } }>("/api/backup", { method: "POST" });
    assert(Boolean(backup.data.path), "backup endpoint creates backup directory");

    await expectFailure("/api/files", { method: "POST", body: JSON.stringify({ path: "../outside.txt", name: "outside.txt" }) }, 400, "file path traversal is blocked");

    await new WebResearchTool().execute({ url: "http://localhost:1234" }).then(
      () => {
        throw new Error("web research localhost should be blocked");
      },
      (error) => assert(String(error.message).includes("blocked"), "web research blocks localhost/private targets")
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404, headers: { "Content-Type": "application/json" } })) as typeof fetch;
    await new GeminiProvider("fake-key").generateText({ model: "gemini-1.5-flash", messages: [{ role: "user", content: "hello" }] }).then(
      () => {
        throw new Error("Gemini 404 should fail with structured provider error");
      },
      (error: any) => {
        assert(error.code === "PROVIDER_REQUEST_FAILED", "mock Gemini 404 returns structured provider error");
        assert(error.details?.provider === "gemini" && error.details?.model === "gemini-1.5-flash", "mock Gemini 404 includes provider and model metadata");
      }
    );
    globalThis.fetch = originalFetch;

    const fullLogs = logs.join("\n");
    assert(!fullLogs.includes(secretValue), "server logs do not leak saved secrets");
    console.log(`Smoke passed (${checks.length} checks)`);
  } finally {
    server.kill("SIGTERM");
    mockOllama.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
