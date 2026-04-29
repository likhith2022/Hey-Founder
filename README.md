# Hey Founder!

Hey Founder! is a fully automated, local-first operating system for running unlimited AI employees with your own AI provider keys. It runs on your computer, VPS, private server, or company machine. Company data, logs, secrets, files, approvals, memory, and work products stay local.

## Product Principles

- No SaaS login, cloud signup, Stripe, cloud database, PostgreSQL, or Redis.
- SQLite only.
- Local dashboard and local server only.
- Bring your own OpenAI, Anthropic, Gemini, OpenRouter, or Ollama configuration.
- API keys are encrypted locally with AES-256-GCM and never returned to the browser after save.
- Unlimited agents can be created. Actual concurrency is controlled by `max_concurrent_runs`.
- CEO-created agents start as `pending_approval`; a human founder must approve before activation.
- Risky actions require approval.

## Local Install

Requirements:

- Node.js 20+
- pnpm

```bash
pnpm install
pnpm build
pnpm start
```

Open [http://localhost:7878](http://localhost:7878).

If pnpm is not installed but Corepack is available:

```bash
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm start
```

## Docker Install

```bash
cp .env.example .env
docker compose up -d --build
```

Then open [http://localhost:7878](http://localhost:7878). The `./data` directory is mounted into the container for persistence.

## Development

```bash
pnpm install
pnpm dev
```

The backend defaults to port `7878`. The Vite dev server uses port `5173` and proxies `/api` to Fastify.

Run validation:

```bash
corepack pnpm lint
corepack pnpm smoke
corepack pnpm test:e2e
```

The e2e suite uses Playwright. If your machine does not already have Playwright browsers installed, run:

```bash
corepack pnpm exec playwright install chromium
```

## Quick Demo Setup

Seed a polished software-company demo:

```bash
corepack pnpm demo:software-company
corepack pnpm start
```

Open [http://localhost:7878](http://localhost:7878).

If this is a fresh database, the demo script creates the local admin password:

```text
demo-local-password
```

The demo creates:

- Company: `NovaStack AI`
- Business type: software startup
- Goal: `Build and launch a landing page for an AI email assistant`
- Initial department: Executive
- Initial active agent: CEO Agent only
- Business profile fields for industry, products/services, target customers, problems, goals, tone, and risk tolerance
- Sample files: `product-notes.md`, `target-customers.md`, `brand-voice.md`

Reset the demo data:

```bash
corepack pnpm demo:reset
```

`demo:reset` clears the local runtime database, vault key, files, work products, backups, logs, and sandbox folders under `data/`.

## Demo Guide

1. Open **Company Board**.
2. Confirm the company starts with only the CEO Agent.
3. Add a provider key on **Secrets**, or use the test/demo mock provider in automated tests.
4. Click **Ask CEO to Build Company**.
5. Review CEO-proposed departments and pending AI employees.
6. Open **Approvals** and approve employees the founder wants to activate.
7. Open **Goals**, find `Build and launch a landing page for an AI email assistant`, and click **Ask CEO to Plan**.
8. Open **Tasks** and run generated tasks.
9. Open **Work Products** to show tangible agent output.
10. Open **Audit Logs** to show local governance and traceability.

For the smoothest live demo, add an OpenAI, Anthropic, Gemini, OpenRouter, or Ollama config on **Secrets** before running tasks.

## What To Show Investors/Customers

- Local-first setup: no SaaS signup, no cloud database, no vendor-owned keys.
- BYO AI keys: the customer controls provider access and spend.
- CEO company building: the founder profile becomes proposed departments and employees.
- CEO planning: once employees are approved, a high-level goal becomes projects and tasks.
- Human control: CEO-created agents and risky actions require approval.
- Work products: outputs are stored locally and visible in the dashboard.
- Auditability: setup, planning, approvals, runs, and backups are logged.
- Operational safety: emergency stop, max concurrent runs, encrypted local secrets, and SQLite-only persistence.

## Known v0.1 Limitations

- The agent loop is intentionally simple and does not use a vector database.
- Tool calling uses a constrained JSON request format rather than a provider-native tool schema.
- Email sending, file deletion, file overwrite, high-risk HTTP mutations, and shell execution are blocked or approval-gated in v1.
- Restore is documented as a manual local filesystem/database operation.
- The demo seed does not include real provider keys.
- UI routing is lightweight and local-dashboard oriented rather than a full SaaS-style multi-user app.

## First Run

1. Start the app.
2. Complete the business profile setup wizard with company name, business description, industry, products/services, target customers, current problems, main goals, preferred tone, risk tolerance, and local admin password.
3. Setup creates only the Executive department and one active CEO Agent.
4. Add provider keys or Ollama URL on the Secrets page.
5. Open **Company Board** and click **Ask CEO to Build Company**.
6. Review CEO-proposed departments and pending AI employees.
7. Approve or reject proposed employees in **Approvals**.
8. Create or open a goal and click **Ask CEO to Plan**.
9. Run tasks and review work products.

## Adding API Keys

Open **Secrets** and add:

- `openai`: OpenAI API key
- `anthropic`: Anthropic API key
- `gemini`: Gemini API key
- `openrouter`: OpenRouter API key
- `ollama`: local base URL, usually `http://localhost:11434`

Secrets are encrypted in SQLite using a vault key generated at `data/.vault-key`. Keep that file with your backups.

## Agents and Approvals

Human-created agents can be active immediately. CEO-created agents are saved as `pending_approval`, with conservative permissions and high-risk tools disabled. The Approvals page activates approved agents or archives rejected ones.

Approval is required for external mutations, shell/code execution, file overwrite/delete, email sending, settings changes, high-risk tools, payments, contracts, and any tool marked `requires_approval`.

## Running a Task

Create or open a task, assign an active agent, then click **Run Task**. Runs create:

- `runs` records
- `run_steps`
- optional `tool_calls`
- `work_products`
- relevant keyword-search memories
- audit log entries

Live run events are streamed with Server-Sent Events.

## Backup and Restore

Use **Settings → Backup Now**. A backup folder is created under `data/backups` containing:

- SQLite database
- uploaded files
- work products
- logs

Secrets remain encrypted; raw decrypted secrets are never exported.

Restore is intentionally conservative in v1: stop the server, copy the backed-up database and data folders into `data/`, then restart.

## Configuration

Environment variables:

- `PORT`: default `7878`
- `HOST`: default `0.0.0.0`
- `DATA_DIR`: default `./data`
- `SESSION_TTL_DAYS`: default `7`
- `MAX_CONCURRENT_RUNS`: default `2`

Runtime settings can be changed in the Settings page.

## Troubleshooting

- Missing provider key: add it on the Secrets page.
- Ollama connection fails: verify Ollama is running and save the base URL in Secrets.
- Emergency stop active: reset it in Settings after reviewing the situation.
- Native SQLite install fails: use Node.js 20 LTS and reinstall dependencies.
- Docker data missing: verify `./data:/app/data` is mounted in `docker-compose.yml`.

## Security Notes

- No hardcoded API keys are included.
- Sessions use secure HTTP-only local cookies.
- Local admin password is hashed with bcrypt.
- Directory traversal is blocked for files and tool access.
- Web research blocks localhost and private network targets.
- Audit logs are written for setup, creates, updates, approvals, tool calls, runs, schedules, backups, and risky operations.
