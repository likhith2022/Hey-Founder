import { test, expect, type Page } from "@playwright/test";

test.setTimeout(120000);

const demoPassword = "demo-local-password";
const fakeSecret = "sk-test-secret-should-not-leak-123";

async function login(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Unlock Dashboard" }).click();
  await expect(page.getByText("corepack pnpm admin:reset-password")).toBeVisible();
  await page.getByPlaceholder("Password").fill(demoPassword);
  await page.getByRole("button", { name: "Unlock Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
}

async function clickNav(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
}

test("core local-first demo UI flow and safety checks", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await login(page);
  await expect(page.getByLabel("Switch Company")).toBeVisible();
  await expect(page.getByText("NovaStack AI operating center")).toBeVisible();
  await page.getByRole("button", { name: "Create Company" }).click();
  await page.getByPlaceholder("Company name").fill("Acme Local Lab");
  await page.getByPlaceholder("Mission or description").fill("Second company switcher test");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Acme Local Lab operating center")).toBeVisible();
  await page.getByLabel("Switch Company").selectOption({ label: "NovaStack AI" });
  await expect(page.getByText("NovaStack AI operating center")).toBeVisible();
  await expect(page.getByRole("heading", { name: "CEO Agent" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Budget" })).toBeVisible();
  await expect(page.getByText("Build your AI company").first()).toBeVisible();
  await page.getByRole("button", { name: "Ask CEO to Build Company" }).first().click();
  await expect(page.getByText("Add a provider key in Secrets before asking CEO to build the company.").first()).toBeVisible();
  await page.getByRole("button", { name: "Open Model Manager" }).first().click();
  await expect(page.getByText("Provider Models")).toBeVisible();
  await page.getByLabel("Secret Provider").selectOption("gemini");
  await page.getByPlaceholder("API key").fill(fakeSecret);
  await page.getByRole("button", { name: "Add / Replace API Key" }).click();
  await expect(page.getByRole("region", { name: "gemini provider" }).getByText("saved, not tested")).toBeVisible();
  await page.getByLabel("CEO default model provider").selectOption("gemini");
  await page.getByLabel("CEO default model model").selectOption("auto");
  await page.getByRole("button", { name: "Save Defaults" }).click();
  await expect(page.getByText("Defaults saved.")).toBeVisible();
  await page.reload();
  await clickNav(page, "Secrets");
  await expect(page.getByText("Provider Models")).toBeVisible();
  await expect(page.getByLabel("CEO default model provider")).toHaveValue("gemini");
  await expect(page.getByLabel("CEO default model model")).toHaveValue("auto");
  await page.getByRole("region", { name: "gemini provider" }).getByRole("button", { name: "Test Connection" }).click();
  await expect(page.getByRole("region", { name: "gemini provider" }).getByText("invalid key/config")).toBeVisible({ timeout: 20000 });
  await clickNav(page, "Company Board");
  await page.getByRole("button", { name: "Ask CEO to Build Company" }).first().click();
  await expect(page.getByText(/Gemini is marked invalid/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Model Manager" })).toBeVisible();
  const agentsAtStart = await (await page.request.get("/api/agents")).json();
  const ceoAgent = agentsAtStart.data.find((agent: any) => agent.name === "CEO Agent");
  expect(agentsAtStart.data.filter((agent: any) => agent.company_id === ceoAgent.company_id)).toHaveLength(1);
  expect(ceoAgent.model_mode).toBe("role_default");
  await page.request.patch("/api/settings", { data: { default_model_ceo_provider: "mock", default_model_ceo_model: "auto" } });
  await page.getByRole("button", { name: "Ask CEO to Build Company" }).first().click();
  await expect(page.getByText("CEO proposed company structure")).toBeVisible();
  await expect(page.getByText("Product Manager Agent")).toBeVisible();
  await expect(page.getByText("pending approval").first()).toBeVisible();
  await clickNav(page, "Founder Desk");
  await expect(page.getByText("Today’s Company Status")).toBeVisible();
  await expect(page.getByRole("button", { name: "Emergency Stop" })).toBeVisible();
  await clickNav(page, "AI Employees");
  await expect(page.getByRole("button", { name: "Hire AI Employee" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Org Chart" })).toBeVisible();
  await expect(page.getByText("Waiting for founder approval").first()).toBeVisible();
  await page.getByRole("button", { name: "View" }).first().click();
  await expect(page.getByRole("heading", { name: "Assigned Tasks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Runs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Memories" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("region", { name: "Agent CEO Agent" }).getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit AI Employee" })).toBeVisible();
  await expect(page.getByLabel("Model mode")).toHaveValue("role_default");
  await expect(page.getByText("This agent will use CEO default: Auto → software-company-builder")).toBeVisible();
  await page.getByLabel("Budget limit").fill("5");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Edit AI Employee" })).toHaveCount(0);
  await page.getByRole("button", { name: "Assign Task" }).first().click();
  await page.getByLabel("Task title").fill("E2E assigned card task");
  await page.getByLabel("Description").fill("Created from the agent card assign task flow.");
  await page.getByRole("button", { name: "Create Task" }).click();
  const assignedTasks = await (await page.request.get("/api/tasks")).json();
  expect(assignedTasks.data.some((task: any) => task.title === "E2E assigned card task")).toBeTruthy();

  await clickNav(page, "Secrets");
  await expect(page.getByText("Provider Models")).toBeVisible();
  await page.request.patch("/api/settings", { data: { default_model_worker_provider: "ollama", default_model_worker_model: "auto", default_model_manager_provider: "mock", default_model_manager_model: "auto", default_model_global_provider: "mock", default_model_global_model: "auto" } });
  const defaultSettings = await (await page.request.get("/api/settings")).json();
  expect(defaultSettings.data.model_defaults.worker.provider).toBe("ollama");
  await clickNav(page, "AI Employees");
  await page.getByRole("button", { name: "Hire AI Employee" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("E2E Default Model Worker");
  await page.getByRole("textbox", { name: "Role" }).fill("Landing page worker");
  await expect(page.getByText("This agent will use Worker default: Auto → llama3.2")).toBeVisible();
  await page.getByLabel("Model mode").selectOption("custom");
  const hireProvider = page.getByLabel("Custom provider", { exact: true });
  const hireModel = page.getByLabel("Custom model", { exact: true });
  await hireProvider.selectOption("anthropic");
  await hireModel.selectOption("auto");
  await page.getByRole("button", { name: "Save" }).click();
  const agentsAfterHire = await (await page.request.get("/api/agents")).json();
  const overridden = agentsAfterHire.data.find((agent: any) => agent.name === "E2E Default Model Worker");
  expect(overridden.model_provider).toBe("anthropic");
  expect(overridden.model_name).toBe("auto");

  await page.getByLabel("Switch Company").selectOption({ label: "Acme Local Lab" });
  await clickNav(page, "Goals");
  await expect(page.getByRole("button", { name: "Create Goal" }).first()).toBeVisible();
  await expect(page.getByText("Create your first company goal")).toBeVisible();
  await page.getByRole("button", { name: "Create Goal" }).first().click();
  await page.getByLabel("Title").fill("E2E first company goal");
  await page.getByLabel("Description").fill("Created from the empty Goals page.");
  await page.getByLabel("Priority").selectOption("high");
  await page.getByRole("button", { name: "Create Goal" }).last().click();
  await expect(page.getByRole("heading", { name: "E2E first company goal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask CEO to Plan" })).toBeVisible();
  await page.getByLabel("Switch Company").selectOption({ label: "NovaStack AI" });
  await expect(page.getByText("Build and launch a landing page for an AI email assistant")).toBeVisible();
  await page.getByRole("button", { name: "Ask CEO to Plan" }).click();
  await expect(page.getByText("Build and launch a landing page for an AI email assistant")).toBeVisible();

  const projectsBefore = await page.request.get("/api/projects");
  const projectCountBefore = (await projectsBefore.json()).data.length;
  const tasksBefore = await page.request.get("/api/tasks");
  const taskCountBefore = (await tasksBefore.json()).data.length;
  await page.getByRole("button", { name: "Ask CEO to Plan" }).click();
  const projectsAfter = await page.request.get("/api/projects");
  const tasksAfter = await page.request.get("/api/tasks");
  expect((await projectsAfter.json()).data.length).toBe(projectCountBefore);
  expect((await tasksAfter.json()).data.length).toBe(taskCountBefore);

  await clickNav(page, "Projects");
  await expect(page.getByText("Strategy for Build and launch a landing page for an AI email assistant")).toBeVisible();
  await expect(page.getByText("Execution for Build and launch a landing page for an AI email assistant")).toBeVisible();

  await clickNav(page, "Tasks");
  await expect(page.getByText("Clarify target outcome and constraints")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run", exact: true }).first()).toBeVisible();

  const approvals = await (await page.request.get("/api/approvals")).json();
  const pendingApproval = approvals.data.find((approval: any) => approval.status === "pending" && approval.approval_type === "create_agent");
  expect(pendingApproval).toBeTruthy();

  const directActivation = await page.request.patch(`/api/agents/${pendingApproval.agent_id}`, {
    data: { status: "active" }
  });
  expect(directActivation.status()).toBe(403);

  await clickNav(page, "Approvals");
  await expect(page.locator(".font-medium").filter({ hasText: "Product Manager Agent" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByText("approved")).toBeVisible();
  const activatedAgent = await (await page.request.get(`/api/agents/${pendingApproval.agent_id}`)).json();
  expect(activatedAgent.data.status).toBe("active");
  await clickNav(page, "AI Employees");
  await expect(page.getByRole("heading", { name: "Product Manager Agent" })).toBeVisible();
  await expect(page.getByText("active").first()).toBeVisible();

  await clickNav(page, "Tasks");
  await page.getByRole("button", { name: "Run", exact: true }).first().click();
  const runs = await (await page.request.get("/api/runs")).json();
  expect(runs.data.some((run: any) => ["completed", "failed"].includes(run.status))).toBeTruthy();

  await clickNav(page, "Secrets");
  await page.getByLabel("Secret Provider").selectOption("openai");
  await page.getByPlaceholder("API key").fill(fakeSecret);
  await page.getByRole("button", { name: "Add / Replace API Key" }).click();
  await expect(page.getByRole("region", { name: "openai provider" }).getByText("saved, not tested")).toBeVisible();
  await expect(page.getByText(fakeSecret)).toHaveCount(0);
  const secrets = await (await page.request.get("/api/secrets")).json();
  expect(JSON.stringify(secrets)).not.toContain(fakeSecret);

  await clickNav(page, "Tools");
  const tools = await (await page.request.get("/api/tools")).json();
  const httpApiTool = tools.data.find((tool: any) => tool.name === "http_api");
  expect(httpApiTool).toBeTruthy();
  const highRisk = await page.request.patch(`/api/tools/${httpApiTool.id}`, {
    data: { enabled: 1, risk_level: "high", requires_approval: 0 }
  });
  expect(highRisk.status()).toBe(403);

  const traversal = await page.request.post("/api/files", {
    data: { path: "../outside.txt", name: "outside.txt" }
  });
  expect(traversal.status()).toBe(400);
  await page.request.post("/api/work-products", { data: { company_id: activatedAgent.data.company_id, type: "demo_note", title: "E2E Work Product Preview", content: "# Preview\n\nThis markdown preview is visible in the Work Products page." } });
  await clickNav(page, "Work Products");
  await expect(page.getByRole("heading", { name: "E2E Work Product Preview" })).toBeVisible();
  await expect(page.locator("pre").filter({ hasText: "This markdown preview is visible" })).toBeVisible();

  const companies = await (await page.request.get("/api/companies")).json();
  const nova = companies.data.find((company: any) => company.name === "NovaStack AI");
  await page.request.patch(`/api/companies/${nova.id}`, { data: { monthly_budget: 1, budget_used: 1 } });
  const budgetBlocked = await page.request.post("/api/runs/run-task", { data: { taskId: (await (await page.request.get("/api/tasks")).json()).data[0].id } });
  expect(budgetBlocked.status()).toBe(402);
  await page.request.patch(`/api/companies/${nova.id}`, { data: { monthly_budget: 0, budget_used: 0 } });

  await clickNav(page, "Settings");
  await page.getByRole("button", { name: "Backup Now" }).click();
  const backups = await (await page.request.get("/api/backup")).json();
  expect(backups.data.length).toBeGreaterThan(0);
  expect(JSON.stringify(backups)).not.toContain(fakeSecret);

  await clickNav(page, "Founder Desk");
  const emergencyTask = await (await page.request.post("/api/tasks", { data: { company_id: nova.id, assigned_agent_id: activatedAgent.data.id, title: "Emergency stop e2e task", description: "This task should be blocked by emergency stop.", status: "todo" } })).json();
  await page.getByRole("button", { name: "Emergency Stop" }).click();
  const emergencyRun = await page.request.post("/api/runs/run-task", { data: { taskId: emergencyTask.data.id } });
  expect(emergencyRun.status()).toBe(423);

  await clickNav(page, "Settings");
  await page.getByRole("button", { name: "Reset Emergency Stop" }).click();

  await clickNav(page, "Audit Logs");
  await expect(page.locator("span").filter({ hasText: "demo_seeded" }).first()).toBeVisible();
  await expect(page.locator("span").filter({ hasText: "ceo_goal_planned" }).first()).toBeVisible();
  await expect(page.locator("span").filter({ hasText: "ceo_goal_plan_reused" }).first()).toBeVisible();
  await expect(page.locator("span").filter({ hasText: "approval_approved" }).first()).toBeVisible();
  await expect(page.locator("span").filter({ hasText: "secret_saved" }).first()).toBeVisible();
  await expect(page.locator("span").filter({ hasText: "settings_updated" }).first()).toBeVisible();
  await page.getByLabel("Action").selectOption("settings_updated");
  await expect(page.locator("span").filter({ hasText: "settings_updated" }).first()).toBeVisible();

  const unexpectedErrors = consoleErrors.filter((message) => !message.includes("React DevTools") && !message.startsWith("Failed to load resource: the server responded with a status of"));
  expect(unexpectedErrors).toEqual([]);
});
