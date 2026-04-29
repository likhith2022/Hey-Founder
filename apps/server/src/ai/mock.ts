import type { AIProvider } from "./providers.js";
import { AppError } from "../utils/errors.js";

export class MockProvider implements AIProvider {
  async generateText(params: Parameters<AIProvider["generateText"]>[0]) {
    if (params.model === "provider-failure") {
      throw new AppError("PROVIDER_REQUEST_FAILED", "Mock provider request failed.", 502, { provider: "mock", model: params.model });
    }
    if (params.model === "auth-failure") {
      throw new AppError("PROVIDER_REQUEST_FAILED", "Invalid API key or provider authorization failed.", 400, { provider: "mock", model: params.model, status: 401 });
    }
    if (params.model === "not-found") {
      throw new AppError("PROVIDER_REQUEST_FAILED", "Mock model or endpoint not found.", 400, { provider: "mock", model: params.model, status: 404 });
    }
    if (params.messages.some((message) => message.content.includes("Reply with OK only."))) {
      if (params.model === "empty-response") return { text: "", tokensUsed: 1, costEstimate: 0 };
      if (params.model === "nonstandard-test") return { text: "Test successful", tokensUsed: 1, costEstimate: 0 };
      if (params.model === "ok-test") return { text: "Sure, OK.", tokensUsed: 1, costEstimate: 0 };
      return { text: "OK", tokensUsed: 1, costEstimate: 0 };
    }
    return {
      text: JSON.stringify({
        departments: [
          { name: "Product", description: "Owns product direction, customer needs, and roadmap clarity.", reason: "A software company needs focused product discovery and prioritization." },
          { name: "Engineering", description: "Builds and maintains the product experience.", reason: "The company needs implementation capacity for web, backend, and quality work." },
          { name: "Marketing", description: "Creates positioning, campaigns, and launch messaging.", reason: "The company needs a repeatable path to customer attention and conversion." },
          { name: "Customer Success", description: "Supports users and turns customer feedback into improvements.", reason: "The company needs onboarding, support, and retention loops." }
        ],
        agents: [
          { name: "Product Manager Agent", role: "Product Manager", department_name: "Product", manager_name: "CEO Agent", system_prompt: "Own product requirements, customer jobs, prioritization, and launch scope. Keep work grounded in the business profile and request approval for risky decisions.", tools: ["file_tool", "web_research", "document_tool"], permission_level: 1, allowed_actions: ["research", "draft_requirements", "prioritize", "create_internal_work_product"], blocked_actions: ["send_email", "make_payments", "sign_contracts"], reason: "Translates founder goals into concrete product plans." },
          { name: "Full Stack Developer Agent", role: "Full Stack Developer", department_name: "Engineering", manager_name: "CEO Agent", system_prompt: "Produce implementation plans, code-oriented specs, and technical work products for the software business. Avoid external mutations without approval.", tools: ["file_tool", "document_tool", "code_sandbox"], permission_level: 1, allowed_actions: ["draft_code", "write_new_work_products", "review_specs"], blocked_actions: ["shell_execution_without_approval", "delete_files", "external_api_mutations"], reason: "Provides technical execution capacity." },
          { name: "UI/UX Designer Agent", role: "UI/UX Designer", department_name: "Product", manager_name: "Product Manager Agent", system_prompt: "Design clear product flows, interface copy, and user experience recommendations for the company's target customers.", tools: ["file_tool", "web_research", "document_tool"], permission_level: 1, allowed_actions: ["research", "draft_ui", "summarize"], blocked_actions: ["post_online", "send_email", "delete_files"], reason: "Improves product usability and demo polish." },
          { name: "QA Tester Agent", role: "QA Tester", department_name: "Engineering", manager_name: "Full Stack Developer Agent", system_prompt: "Review outputs for defects, missing edge cases, accessibility, and release readiness.", tools: ["file_tool", "document_tool"], permission_level: 1, allowed_actions: ["review", "draft_test_plan", "summarize"], blocked_actions: ["deploy", "delete_files", "external_mutations"], reason: "Keeps generated work reliable before release." },
          { name: "Marketing Strategist Agent", role: "Marketing Strategist", department_name: "Marketing", manager_name: "CEO Agent", system_prompt: "Create positioning, segments, campaign briefs, and conversion-focused launch messaging.", tools: ["file_tool", "web_research", "document_tool", "email_draft"], permission_level: 1, allowed_actions: ["research", "draft_copy", "create_internal_work_product"], blocked_actions: ["send_email", "post_online", "make_payments"], reason: "Turns the product into a market-facing story." },
          { name: "Proposal Writer Agent", role: "Proposal Writer", department_name: "Marketing", manager_name: "Marketing Strategist Agent", system_prompt: "Draft proposals, one-pagers, FAQs, and customer-facing documents for founder review.", tools: ["file_tool", "document_tool", "email_draft"], permission_level: 1, allowed_actions: ["draft", "summarize", "create_internal_work_product"], blocked_actions: ["send_email", "sign_contracts", "make_claims_without_review"], reason: "Creates polished sales and customer materials." },
          { name: "Client Support Agent", role: "Client Support", department_name: "Customer Success", manager_name: "CEO Agent", system_prompt: "Draft support replies, onboarding notes, and customer feedback summaries. Never send external communication directly.", tools: ["file_tool", "document_tool", "email_draft"], permission_level: 1, allowed_actions: ["draft_support_response", "summarize_feedback", "create_internal_work_product"], blocked_actions: ["send_email", "refund_payments", "change_customer_accounts"], reason: "Helps the company respond to customers consistently." }
        ],
        first_90_day_plan: [
          { title: "Clarify product promise and target users", description: "Turn the founder profile into customer jobs, positioning, and MVP scope.", department_name: "Product" },
          { title: "Build launch-ready product and landing page assets", description: "Create technical requirements, UI copy, QA checklist, and launch collateral.", department_name: "Engineering" },
          { title: "Prepare customer acquisition and support workflow", description: "Create campaigns, proposals, onboarding docs, and support response templates.", department_name: "Marketing" }
        ]
      }),
      tokensUsed: 1,
      costEstimate: 0
    };
  }
}
