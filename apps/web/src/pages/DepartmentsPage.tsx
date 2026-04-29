import { list } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/layout/PageHeader";

export function DepartmentsPage({ companyId }: { companyId: string }) {
  const { data } = useApi(async () => {
    const [departments, agents] = await Promise.all([list<any>("departments"), list<any>("agents")]);
    return { departments: departments.filter((item) => item.company_id === companyId), agents: agents.filter((item) => item.company_id === companyId) };
  }, [companyId]);
  const departments = data?.departments ?? [];
  const onlyExecutive = departments.length <= 1 && departments.every((department) => department.name === "Executive");
  return <div><PageHeader title="Departments" description="Business-specific departments proposed by the CEO Agent." />{onlyExecutive && <Card className="mb-4"><p className="text-sm text-slate-400">Departments will be created based on your business profile. Ask the CEO Agent to build your AI company from the Company Board.</p></Card>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{departments.map((department) => <Card key={department.id}><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{department.name}</h2><Badge>{(data?.agents ?? []).filter((agent) => agent.department_id === department.id).length} agents</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{department.description || "No description yet."}</p></Card>)}</div></div>;
}
