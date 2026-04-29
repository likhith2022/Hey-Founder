import { ResourcePage } from "./ResourcePage";
export function ToolsPage() {
  return <ResourcePage resource="tools" title="Tools" description="Enable tools, configure risk levels, and require approval for dangerous actions." columns={["name", "enabled", "risk_level", "requires_approval", "description"]} fields={[{ key: "name", label: "Name" }, { key: "description", label: "Description", type: "textarea" }, { key: "enabled", label: "Enabled", type: "number", default: 1 }, { key: "risk_level", label: "Risk", type: "select", options: ["low", "medium", "high"], default: "low" }, { key: "requires_approval", label: "Requires approval", type: "number", default: 0 }, { key: "config", label: "Config JSON", type: "textarea", default: "{}" }]} />;
}
