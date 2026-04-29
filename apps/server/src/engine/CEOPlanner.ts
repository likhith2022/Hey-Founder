import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { audit } from "../api/helpers.js";
import { AgentFactory } from "./AgentFactory.js";
import { AppError } from "../utils/errors.js";
import { createProvider } from "../ai/providers.js";
import { resolveAgentModel } from "./modelResolver.js";
import { extractJsonObject } from "../utils/extractJson.js";
import { log } from "../utils/logger.js";
import { z } from "zod";

const PlanSchema = z.object({
  projects: z.array(z.object({
    title: z.string().min(2),
    description: z.string().default(""),
    tasks: z.array(z.object({
      title: z.string().min(2),
      description: z.string().default(""),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
      agent_role_hint: z.string().optional()
    })).min(1)
  })).min(1)
});

export class CEOPlanner {
  async planGoal(goalId: string) {
    const db = getDb();
    const goal = db.prepare("SELECT * FROM goals WHERE id = ?").get(goalId) as any;
    if (!goal) throw new AppError("GOAL_NOT_FOUND", "Goal was not found", 404);
    const ceo = db.prepare("SELECT * FROM agents WHERE company_id = ? AND name = 'CEO Agent' AND status = 'active'").get(goal.company_id) as any;
    if (!ceo) throw new AppError("CEO_NOT_FOUND", "CEO Agent is not active", 400);

    const existingProjects = db.prepare("SELECT id FROM projects WHERE company_id = ? AND goal_id = ? ORDER BY created_at").all(goal.company_id, goal.id) as Array<{ id: string }>;
    if (existingProjects.length > 0) {
      const existingTasks = db.prepare("SELECT id FROM tasks WHERE company_id = ? AND goal_id = ? ORDER BY created_at").all(goal.company_id, goal.id) as Array<{ id: string }>;
      audit("ceo_goal_plan_reused", "goal", goal.id, { projects: existingProjects.map((p) => p.id), tasks: existingTasks.map((t) => t.id) });
      this.proposeMissingResearchAgentIfNeeded(goal, ceo);
      return { projects: existingProjects.map((p) => p.id), tasks: existingTasks.map((t) => t.id), reused: true };
    }

    const activeAgents = db.prepare("SELECT * FROM agents WHERE company_id = ? AND status = 'active'").all(goal.company_id) as any[];
    const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(goal.company_id) as any;

    // Try AI planning; fall back to static template on failure
    let planData: z.infer<typeof PlanSchema>;
    try {
      planData = await this.aiPlan(goal, company, ceo);
    } catch (err) {
      log("warn", "CEOPlanner AI call failed, using static fallback", { error: err instanceof Error ? err.message : String(err) });
      planData = this.staticPlan(goal);
    }

    const createdProjects: string[] = [];
    const createdTasks: string[] = [];

    for (const spec of planData.projects) {
      const projectId = id("project");
      db.prepare("INSERT INTO projects (id, company_id, goal_id, title, description, status, owner_agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)").run(projectId, goal.company_id, goal.id, spec.title, spec.description || `CEO-planned project for: ${goal.title}`, activeAgents[0]?.id ?? null, nowIso(), nowIso());
      createdProjects.push(projectId);
      for (const taskSpec of spec.tasks) {
        const bestAgent = this.pickAgent(activeAgents, taskSpec.agent_role_hint ?? taskSpec.title);
        const taskId = id("task");
        db.prepare("INSERT INTO tasks (id, company_id, project_id, goal_id, assigned_agent_id, title, description, status, priority, created_by_type, created_by_agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'todo', ?, 'agent', ?, ?, ?)").run(taskId, goal.company_id, projectId, goal.id, bestAgent?.id ?? null, taskSpec.title, taskSpec.description || `Planned by CEO Agent for goal: ${goal.title}`, taskSpec.priority ?? goal.priority ?? "medium", ceo.id, nowIso(), nowIso());
        createdTasks.push(taskId);
      }
    }

    this.proposeMissingResearchAgentIfNeeded(goal, ceo);
    audit("ceo_goal_planned", "goal", goal.id, { projects: createdProjects, tasks: createdTasks });
    return { projects: createdProjects, tasks: createdTasks };
  }

  private async aiPlan(goal: any, company: any, ceo: any): Promise<z.infer<typeof PlanSchema>> {
    const model = resolveAgentModel(ceo);
    const provider = createProvider(model.provider);

    const prompt = `You are a CEO planning execution of a company goal.

Return JSON ONLY (no markdown, no explanation) matching this exact shape:
{
  "projects": [
    {
      "title": "Project name",
      "description": "What this project covers",
      "tasks": [
        {
          "title": "Concrete task title",
          "description": "What to do",
          "priority": "high|medium|low",
          "agent_role_hint": "which type of agent should do this"
        }
      ]
    }
  ]
}

Rules:
- 2-4 projects per goal.
- 2-4 tasks per project.
- Tasks must be concrete and actionable, not vague.
- Each task title should clearly describe the deliverable.

Company: ${company.name}
Business: ${company.business_description || company.description || ""}
Industry: ${company.industry || ""}
Goal title: ${goal.title}
Goal description: ${goal.description || ""}
Priority: ${goal.priority || "medium"}`;

    const result = await provider.generateText({
      model: model.name,
      temperature: 0.1,
      maxTokens: 2000,
      responseFormat: "json",
      messages: [
        { role: "system", content: ceo.system_prompt },
        { role: "user", content: prompt }
      ]
    });

    const parsed = PlanSchema.safeParse(extractJsonObject(result.text));
    if (!parsed.success) {
      log("warn", "CEOPlanner returned invalid JSON, falling back to static", { issues: parsed.error.issues.slice(0, 3) });
      return this.staticPlan(goal);
    }
    return parsed.data;
  }

  private staticPlan(goal: any): z.infer<typeof PlanSchema> {
    return {
      projects: [
        {
          title: `Strategy for ${goal.title}`,
          description: `Clarify the target outcome and create the execution roadmap`,
          tasks: [
            { title: `Define success criteria for ${goal.title}`, description: "Document what done looks like for this goal", priority: "high" },
            { title: `Create execution roadmap for ${goal.title}`, description: "Break down this goal into concrete milestones", priority: "medium" }
          ]
        },
        {
          title: `Execution for ${goal.title}`,
          description: `Deliver the core work required by this goal`,
          tasks: [
            { title: `Draft first deliverable for ${goal.title}`, description: "Produce the main output or prototype", priority: "high" },
            { title: `QA review and finalize ${goal.title}`, description: "Review quality, iterate, and finalize the output", priority: "medium" }
          ]
        }
      ]
    };
  }

  private proposeMissingResearchAgentIfNeeded(goal: any, ceo: any) {
    const activeAgents = getDb().prepare("SELECT * FROM agents WHERE company_id = ? AND status = 'active'").all(goal.company_id) as any[];
    const existingProposal = getDb().prepare("SELECT id FROM agents WHERE company_id = ? AND name = 'Market Research Specialist Agent' AND status IN ('pending_approval', 'active')").get(goal.company_id);
    const hasResearch = activeAgents.some((agent) => /research/i.test(`${agent.name} ${agent.role}`));
    if (!hasResearch && !existingProposal) {
      new AgentFactory().proposeAgentFromCEO(
        {
          companyId: goal.company_id,
          name: "Market Research Specialist Agent",
          role: "Researches market, customers, competitors, and strategic options for company goals.",
          systemPrompt: "You are a careful market research specialist. Produce sourced internal research briefs and ask for approval before risky actions.",
          tools: ["web_research", "document_tool"],
          permissionLevel: 1,
          allowedActions: ["research", "summarize", "create_internal_work_product"],
          blockedActions: ["send_email", "payments", "contracts", "shell_execution"]
        },
        ceo.id,
        `Goal "${goal.title}" benefits from a dedicated research role.`
      );
    }
  }

  private pickAgent(agents: any[], hint: string) {
    const h = hint.toLowerCase();
    if (/review|qa|test/.test(h)) return agents.find((a) => /qa|review/i.test(`${a.name} ${a.role}`)) ?? agents[0];
    if (/research|market|customer/.test(h)) return agents.find((a) => /research/i.test(`${a.name} ${a.role}`)) ?? agents[0];
    if (/marketing|content|social|campaign/.test(h)) return agents.find((a) => /marketing|content/i.test(`${a.name} ${a.role}`)) ?? agents[0];
    if (/sales|proposal|lead/.test(h)) return agents.find((a) => /sales/i.test(`${a.name} ${a.role}`)) ?? agents[0];
    if (/finance|invoice|budget/.test(h)) return agents.find((a) => /finance|ops/i.test(`${a.name} ${a.role}`)) ?? agents[0];
    if (/document|draft|write|deliverable/.test(h)) return agents.find((a) => /document|marketing|operations/i.test(`${a.name} ${a.role}`)) ?? agents[0];
    return agents.find((a) => /operations|ceo/i.test(`${a.name} ${a.role}`)) ?? agents[0];
  }
}
