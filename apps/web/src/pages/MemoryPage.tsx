import { ResourcePage } from "./ResourcePage";
export function MemoryPage() {
  return <ResourcePage resource="memory" title="Memory" description="Search, add, and edit simple keyword-search memories. No vector database required." columns={["content", "scope", "importance", "agent_id", "created_at"]} fields={[{ key: "company_id", label: "Company ID" }, { key: "agent_id", label: "Agent ID" }, { key: "scope", label: "Scope", default: "company" }, { key: "content", label: "Content", type: "textarea" }, { key: "importance", label: "Importance", type: "number", default: 0.5 }]} />;
}
