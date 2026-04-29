import { AgentsPage } from "./AgentsPage";
export function AgentDetailPage() {
  return <AgentsPage companyId={localStorage.getItem("companyId") ?? ""} />;
}
