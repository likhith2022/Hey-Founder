import type { FastifyInstance } from "fastify";
import { requireAuth } from "../security/sessions.js";
import { sendError } from "../utils/errors.js";
import { CEOCompanyBuilder } from "../engine/CEOCompanyBuilder.js";
import { CEOPlanner } from "../engine/CEOPlanner.js";
import { AgentRunner } from "../engine/AgentRunner.js";
import { getDb, getSetting } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { createProvider } from "../ai/providers.js";
import { resolveAgentModel } from "../engine/modelResolver.js";
import { safeJsonStringify } from "../utils/json.js";
import { log } from "../utils/logger.js";

type Intent =
  | { type: "build_company" }
  | { type: "plan_goal"; goalId: string; goalTitle: string }
  | { type: "run_task"; taskId: string; taskTitle: string }
  | { type: "run_all_todo" }
  | { type: "list_agents" }
  | { type: "list_tasks" }
  | { type: "list_approvals" }
  | { type: "show_work_products" }
  | { type: "show_status" }
  | { type: "ask_ceo"; message: string }
  | { type: "war_room"; message: string }
  | { type: "create_and_plan_goal"; title: string; description: string }
  | { type: "unknown" };

function classifyIntent(message: string, companyId: string): Intent {
  const db = getDb();
  const m = message.toLowerCase().trim();
  // Only look at the first 100 characters for quick commands to avoid false positives on long prompts
  const shortMsg = m.slice(0, 100);

  // War Room / Team Discussion
  if (/war room|discuss.{1,20}team|team meeting|everyone|all agents/.test(shortMsg)) {
    return { type: "war_room", message };
  }

  // Build company
  if (/build.{1,20}company|design.{1,20}company|create.{1,20}team|set up.{1,20}agents/.test(shortMsg)) {
    return { type: "build_company" };
  }

  // Plan goal
  if (/plan|execute|break.*down|create.{1,20}task/.test(shortMsg)) {
    const goals = db.prepare("SELECT * FROM goals WHERE company_id = ? AND status = 'active' ORDER BY created_at DESC").all(companyId) as any[];
    
    // Try to match a specific goal by name explicitly
    const matched = goals.find((g) => m.includes(g.title.toLowerCase().slice(0, 15)));
    if (matched) {
      return { type: "plan_goal", goalId: matched.id, goalTitle: matched.title };
    }

    // If no explicit match, but the user provided a detailed prompt, create a new goal
    if (message.length > 40) {
       let title = message.replace(/^.*?(plan|execute|break down|create task).*?(goal|this|it)?:?\s*/i, "").trim();
       if (title.length > 80) title = title.slice(0, 80) + "...";
       if (!title) title = "New Chat Goal";
       return { type: "create_and_plan_goal", title, description: message };
    }

    // Otherwise, fallback to the most recent active goal if they just said "plan goal"
    if (goals.length > 0) {
      return { type: "plan_goal", goalId: goals[0].id, goalTitle: goals[0].title };
    }
  }

  // Run specific task
  if (/run task|execute task|start task/.test(shortMsg)) {
    const tasks = db.prepare("SELECT * FROM tasks WHERE company_id = ? AND status = 'todo' ORDER BY created_at DESC LIMIT 1").get(companyId) as any;
    if (tasks) return { type: "run_task", taskId: tasks.id, taskTitle: tasks.title };
  }

  // Run all todo
  if (/run all|execute all|start all.{1,20}tasks|run.{1,20}todo/.test(shortMsg)) {
    return { type: "run_all_todo" };
  }

  // List agents
  if (/list.{1,20}agents|show.{1,20}agents|who.{1,20}agents|employees|team members/.test(shortMsg)) {
    return { type: "list_agents" };
  }

  // List tasks
  if (/list.{1,20}tasks|show.{1,20}tasks|what.{1,20}tasks|task board/.test(shortMsg)) {
    return { type: "list_tasks" };
  }

  // Show approvals
  if (/approvals|pending|need.{1,20}approval|waiting/.test(shortMsg)) {
    return { type: "list_approvals" };
  }

  // Work products
  if (/work products?|outputs?|deliverables?|results?|artifacts?/.test(shortMsg)) {
    return { type: "show_work_products" };
  }

  // Status
  if (/status|overview|summary|how.{1,20}going|update|report/.test(shortMsg)) {
    return { type: "show_status" };
  }

  return { type: "ask_ceo", message };
}

function write(reply: any, event: object) {
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

export async function registerChatRoutes(app: FastifyInstance) {
  app.post("/api/chat/command", async (request, reply) => {
    try {
      await requireAuth(request);
      const { companyId, message, agentId } = request.body as { companyId: string; message: string; agentId?: string };

      if (!companyId || !message?.trim()) {
        return reply.status(400).send({ error: "INVALID_REQUEST", message: "companyId and message are required" });
      }

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });

      const db = getDb();
      const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId) as any;
      if (!company) {
        write(reply, { type: "error", message: "Company not found" });
        reply.raw.end();
        return;
      }

      // If a specific agent is targeted, bypass intent classification
      if (agentId) {
        const agent = db.prepare("SELECT * FROM agents WHERE id = ? AND company_id = ?").get(agentId, companyId) as any;
        if (!agent) {
          write(reply, { type: "error", message: "Selected agent not found" });
          reply.raw.end();
          return;
        }

        write(reply, { type: "thinking", message: `Routing to ${agent.name}...` });
        const model = resolveAgentModel(agent);
        const provider = createProvider(model.provider);
        const result = await provider.generateText({
          model: model.name,
          temperature: 0.7,
          maxTokens: 2000,
          messages: [
            { role: "system", content: agent.system_prompt },
            { role: "user", content: message }
          ]
        });

        write(reply, { type: "result", action: "direct_chat", message: result.text });
        write(reply, { type: "done" });
        reply.raw.end();
        return;
      }

      const intent = classifyIntent(message, companyId);
      write(reply, { type: "intent", intent: intent.type });

      try {
        switch (intent.type) {
          case "build_company": {
            write(reply, { type: "thinking", message: "Asking CEO Agent to design your company structure..." });
            const result = await new CEOCompanyBuilder().buildCompany(companyId);
            write(reply, {
              type: "result",
              action: "build_company",
              message: `✅ CEO Agent has proposed **${result.departments.length} departments** and **${result.agents.length} employees**. Go to **Approvals** to activate them.`,
              data: { departments: result.departments.length, agents: result.agents.length }
            });
            break;
          }

          case "plan_goal": {
            write(reply, { type: "thinking", message: `CEO Agent is planning: "${intent.goalTitle}"...` });
            const result = await new CEOPlanner().planGoal(intent.goalId);
            write(reply, {
              type: "result",
              action: "plan_goal",
              message: `✅ CEO Agent created **${result.projects.length} projects** and **${result.tasks.length} tasks** for "${intent.goalTitle}". Should I run all of these tasks now?`,
              data: { projects: result.projects.length, tasks: result.tasks.length, goalId: intent.goalId }
            });
            break;
          }

          case "create_and_plan_goal": {
            write(reply, { type: "thinking", message: `Creating new goal: "${intent.title}"...` });
            const goalId = id("goal");
            db.prepare("INSERT INTO goals (id, company_id, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 'high', ?, ?)")
              .run(goalId, companyId, intent.title, intent.description, nowIso(), nowIso());
            
            write(reply, { type: "thinking", message: `CEO Agent is planning the new goal...` });
            const result = await new CEOPlanner().planGoal(goalId);
            write(reply, {
              type: "result",
              action: "plan_goal",
              message: `✅ Created goal **"${intent.title}"**. CEO Agent planned **${result.projects.length} projects** and **${result.tasks.length} tasks**. Should I run all of these tasks now?`,
              data: { projects: result.projects.length, tasks: result.tasks.length, goalId }
            });
            break;
          }

          case "run_task": {
            write(reply, { type: "thinking", message: `Running task: "${intent.taskTitle}"...` });
            await new AgentRunner().runTask(intent.taskId);
            write(reply, {
              type: "result",
              action: "run_task",
              message: `✅ Task "${intent.taskTitle}" has been queued and is now running. Check **Tasks** or **Runs** for live progress.`,
              data: { taskId: intent.taskId }
            });
            break;
          }

          case "run_all_todo": {
            const todos = db.prepare("SELECT * FROM tasks WHERE company_id = ? AND status = 'todo' ORDER BY created_at").all(companyId) as any[];
            if (todos.length === 0) {
              write(reply, { type: "result", action: "run_all_todo", message: "No todo tasks found. Create some tasks first or ask the CEO to plan a goal." });
              break;
            }
            const max = Number(getSetting("max_concurrent_runs") ?? 2);
            const toRun = todos.slice(0, max);
            write(reply, { type: "thinking", message: `Queuing ${toRun.length} tasks (max concurrent: ${max})...` });
            for (const task of toRun) {
              db.prepare("INSERT INTO jobs (id, type, payload, status, attempts, max_attempts, created_at, updated_at) VALUES (?, 'run_task', ?, 'queued', 0, 3, ?, ?)").run(id("job"), safeJsonStringify({ taskId: task.id }), nowIso(), nowIso());
            }
            write(reply, {
              type: "result",
              action: "run_all_todo",
              message: `✅ Queued **${toRun.length} tasks** for execution. Open **Tasks** to watch progress.`,
              data: { queued: toRun.length, total: todos.length }
            });
            break;
          }

          case "list_agents": {
            const agents = db.prepare("SELECT name, role, status, department_id FROM agents WHERE company_id = ?").all(companyId) as any[];
            const active = agents.filter((a) => a.status === "active");
            const pending = agents.filter((a) => a.status === "pending_approval");
            const lines = active.map((a: any) => `• **${a.name}** — ${a.role}`).join("\n");
            write(reply, {
              type: "result",
              action: "list_agents",
              message: `Your company has **${active.length} active agents** and **${pending.length} pending approval**:\n\n${lines || "No active agents yet."}`,
              data: { agents: active }
            });
            break;
          }

          case "list_tasks": {
            const tasks = db.prepare("SELECT title, status, priority FROM tasks WHERE company_id = ? ORDER BY created_at DESC LIMIT 10").all(companyId) as any[];
            const byStatus: Record<string, number> = {};
            tasks.forEach((t: any) => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
            const summary = Object.entries(byStatus).map(([s, c]) => `${c} ${s}`).join(", ");
            write(reply, {
              type: "result",
              action: "list_tasks",
              message: `**Task board** (last 10): ${summary || "no tasks"}\n\n${tasks.map((t: any) => `• [${t.status}] ${t.title}`).join("\n")}`,
              data: { tasks }
            });
            break;
          }

          case "list_approvals": {
            const approvals = db.prepare("SELECT action_description, risk_level, approval_type FROM approvals WHERE company_id = ? AND status = 'pending' ORDER BY created_at DESC").all(companyId) as any[];
            if (approvals.length === 0) {
              write(reply, { type: "result", action: "list_approvals", message: "✅ No pending approvals — the company can run freely." });
            } else {
              const lines = approvals.map((a: any) => `• [${a.risk_level ?? "medium"}] ${a.action_description}`).join("\n");
              write(reply, {
                type: "result",
                action: "list_approvals",
                message: `**${approvals.length} pending approvals** need your decision:\n\n${lines}\n\nOpen **Approvals** to review them.`,
                data: { approvals }
              });
            }
            break;
          }

          case "show_work_products": {
            const products = db.prepare("SELECT title, type, created_at FROM work_products WHERE company_id = ? ORDER BY created_at DESC LIMIT 5").all(companyId) as any[];
            if (products.length === 0) {
              write(reply, { type: "result", action: "show_work_products", message: "No work products yet. Run a task to generate outputs." });
            } else {
              const lines = products.map((p: any) => `• [${p.type}] ${p.title || "Untitled"} — ${p.created_at?.slice(0, 10)}`).join("\n");
              write(reply, {
                type: "result",
                action: "show_work_products",
                message: `**Latest ${products.length} work products:**\n\n${lines}\n\nOpen **Work Products** to view full content.`,
                data: { products }
              });
            }
            break;
          }

          case "show_status": {
            const agents = db.prepare("SELECT COUNT(*) as n FROM agents WHERE company_id = ? AND status = 'active'").get(companyId) as any;
            const tasks = db.prepare("SELECT status, COUNT(*) as n FROM tasks WHERE company_id = ? GROUP BY status").all(companyId) as any[];
            const approvals = db.prepare("SELECT COUNT(*) as n FROM approvals WHERE company_id = ? AND status = 'pending'").get(companyId) as any;
            const runs = db.prepare("SELECT COUNT(*) as n FROM runs WHERE company_id = ? AND status = 'running'").get(companyId) as any;
            const taskSummary = tasks.map((t: any) => `${t.n} ${t.status}`).join(", ");
            write(reply, {
              type: "result",
              action: "show_status",
              message: `**${company.name} Status:**\n\n• 🤖 **${agents.n} active agents**\n• 📋 Tasks: ${taskSummary || "none"}\n• ⚡ **${runs.n} running** right now\n• ⏳ **${approvals.n} pending approvals**`,
              data: { agents: agents.n, tasks, approvals: approvals.n, runs: runs.n }
            });
            break;
          }

          case "war_room": {
            write(reply, { type: "thinking", message: "Assembling the C-Suite in the War Room..." });
            const activeAgents = db.prepare("SELECT * FROM agents WHERE company_id = ? AND status = 'active' LIMIT 4").all(companyId) as any[];
            if (activeAgents.length < 2) {
              write(reply, { type: "result", action: "war_room", message: "You need at least 2 active agents to start a War Room discussion. Hire more employees first!" });
              break;
            }

            let fullDiscussion = `# Team Strategic Discussion: "${intent.message}"\n\n`;
            for (const agent of activeAgents) {
              write(reply, { type: "thinking", message: `${agent.name} (${agent.role}) is typing...` });
              const model = resolveAgentModel(agent);
              const provider = createProvider(model.provider);
              const result = await provider.generateText({
                model: model.name,
                temperature: 0.7,
                maxTokens: 4000,
                messages: [
                  { role: "system", content: `${agent.system_prompt}\n\nThis is a team meeting. Be concise but complete your thought. Provide unique value from your perspective.` },
                  { role: "user", content: `TOPIC: ${intent.message}\n\nDISCUSSION SO FAR:\n${fullDiscussion}` }
                ]
              });
              const response = `### ${agent.name} (${agent.role})\n${result.text}\n\n`;
              fullDiscussion += response;
              write(reply, { type: "thinking", message: `${agent.name} has finished.` });
            }

            write(reply, {
              type: "result",
              action: "war_room",
              message: fullDiscussion,
              data: { participants: activeAgents.length }
            });
            break;
          }

          default: {
            // ask_ceo: pass to CEO Agent as freeform message
            write(reply, { type: "thinking", message: "Routing your message to the CEO Agent..." });
            const ceo = db.prepare("SELECT * FROM agents WHERE company_id = ? AND name = 'CEO Agent' AND status = 'active' LIMIT 1").get(companyId) as any;
            if (!ceo) {
              write(reply, {
                type: "result",
                action: "ask_ceo",
                message: "No active CEO Agent found. Go to **AI Employees** and hire a CEO Agent first."
              });
              break;
            }
            const model = resolveAgentModel(ceo);
            const provider = createProvider(model.provider);
            const context = db.prepare("SELECT name, description, main_goals FROM companies WHERE id = ?").get(companyId) as any;
            const result = await provider.generateText({
              model: model.name,
              temperature: 0.4,
              maxTokens: 4000,
              messages: [
                { role: "system", content: `${ceo.system_prompt}\n\nCompany: ${context?.name}. Goal: ${context?.main_goals ?? ""}` },
                { role: "user", content: (intent as any).message }
              ]
            });
            write(reply, {
              type: "result",
              action: "ask_ceo",
              message: result.text,
              data: { tokensUsed: result.tokensUsed }
            });
            break;
          }
        }
      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : "Command failed";
        log("error", "Chat command failed", { intent: intent.type, error: msg });
        write(reply, { type: "error", message: `❌ ${msg}` });
      }

      write(reply, { type: "done" });
      reply.raw.end();
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
