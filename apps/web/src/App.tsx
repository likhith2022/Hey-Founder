import { useEffect, useState } from "react";
import { api, list } from "./api/client";
import { CompanySummary, Layout, PageKey } from "./components/layout/Layout";
import { useSetupStatus } from "./hooks/useSetupStatus";
import { SetupPage } from "./pages/SetupPage";
import { LoginPage } from "./pages/LoginPage";
import { FounderDesk } from "./pages/FounderDesk";
import { AgentsPage } from "./pages/AgentsPage";
import { DepartmentsPage } from "./pages/DepartmentsPage";
import { GoalsPage } from "./pages/GoalsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { TasksPage } from "./pages/TasksPage";
import { RunsPage } from "./pages/RunsPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { ToolsPage } from "./pages/ToolsPage";
import { SecretsPage } from "./pages/SecretsPage";
import { MemoryPage } from "./pages/MemoryPage";
import { FilesPage } from "./pages/FilesPage";
import { WorkProductsPage } from "./pages/WorkProductsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CompanyBoardPage } from "./pages/CompanyBoardPage";
import { ChatCommandPage } from "./pages/ChatCommandPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { SOPPage } from "./pages/SOPPage";
import { SalesPage } from "./pages/SalesPage";
import { FinancialPage } from "./pages/FinancialPage";
import { WikiPage } from "./pages/WikiPage";

export function App() {
  const status = useSetupStatus();
  const [page, setPage] = useState<PageKey>("chat");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(localStorage.getItem("companyId") ?? "");
  const refreshCompanies = async () => {
    const rows = await list<CompanySummary>("companies");
    setCompanies(rows);
    const next = selectedCompanyId || localStorage.getItem("companyId") || rows[0]?.id || "";
    if (next && rows.some((company) => company.id === next)) {
      setSelectedCompanyId(next);
      localStorage.setItem("companyId", next);
    } else if (rows[0]) {
      setSelectedCompanyId(rows[0].id);
      localStorage.setItem("companyId", rows[0].id);
    }
  };
  useEffect(() => {
    if (authenticated) void refreshCompanies();
  }, [authenticated]);
  const selectCompany = (id: string) => {
    setSelectedCompanyId(id);
    localStorage.setItem("companyId", id);
  };

  if (status.loading) return <div className="grid min-h-screen place-items-center bg-surface text-slate-400">Loading local server...</div>;
  if (status.data?.setupRequired) return <SetupPage />;
  if (status.data?.company?.id && !localStorage.getItem("companyId")) localStorage.setItem("companyId", status.data.company.id);
  if (authenticated === null) {
    void api("/api/settings").then(() => setAuthenticated(true)).catch(() => setAuthenticated(false));
    return <div className="grid min-h-screen place-items-center bg-surface text-slate-400">Checking local session...</div>;
  }
  if (!authenticated) return <LoginPage />;

  const current = {
    board: <CompanyBoardPage companyId={selectedCompanyId} onOpenModelManager={() => setPage("secrets")} />,
    desk: <FounderDesk companyId={selectedCompanyId} onOpenModelManager={() => setPage("secrets")} />,
    chat: <ChatCommandPage companyId={selectedCompanyId} />,
    analytics: <AnalyticsPage companyId={selectedCompanyId} />,
    agents: <AgentsPage companyId={selectedCompanyId} />,
    departments: <DepartmentsPage companyId={selectedCompanyId} />,
    goals: <GoalsPage companyId={selectedCompanyId} />,
    projects: <ProjectsPage companyId={selectedCompanyId} />,
    tasks: <TasksPage companyId={selectedCompanyId} />,
    sops: <SOPPage companyId={selectedCompanyId} />,
    sales: <SalesPage companyId={selectedCompanyId} />,
    financials: <FinancialPage companyId={selectedCompanyId} />,
    wiki: <WikiPage companyId={selectedCompanyId} />,
    runs: <RunsPage />,
    approvals: <ApprovalsPage companyId={selectedCompanyId} />,
    schedules: <SchedulesPage companyId={selectedCompanyId} />,
    tools: <ToolsPage />,
    secrets: <SecretsPage />,
    memory: <MemoryPage />,
    files: <FilesPage companyId={selectedCompanyId} />,
    "work-products": <WorkProductsPage companyId={selectedCompanyId} />,
    audit: <AuditLogsPage companyId={selectedCompanyId} />,
    settings: <SettingsPage companyId={selectedCompanyId} />
  }[page];

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);
  return <Layout page={page} setPage={setPage} companies={companies} selectedCompanyId={selectedCompanyId} onCompanyChange={selectCompany} onCompaniesChanged={refreshCompanies} emergency={Boolean(selectedCompany?.emergency_stopped)}>{current}</Layout>;
}
