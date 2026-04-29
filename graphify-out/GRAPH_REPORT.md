# Graph Report - .  (2026-04-29)

## Corpus Check
- Corpus is ~41,261 words - fits in a single context window. You may not need a graph.

## Summary
- 376 nodes · 868 edges · 48 communities detected
- Extraction: 69% EXTRACTED · 31% INFERRED · 0% AMBIGUOUS · INFERRED: 272 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Server API & Core|Server API & Core]]
- [[_COMMUNITY_Agent Execution Engine|Agent Execution Engine]]
- [[_COMMUNITY_AI Providers & Tests|AI Providers & Tests]]
- [[_COMMUNITY_Web API Client & Pages|Web API Client & Pages]]
- [[_COMMUNITY_Auth & Settings|Auth & Settings]]
- [[_COMMUNITY_Web UI Views|Web UI Views]]
- [[_COMMUNITY_Security & Vault|Security & Vault]]
- [[_COMMUNITY_Chat & Planning|Chat & Planning]]
- [[_COMMUNITY_Model Resolution|Model Resolution]]
- [[_COMMUNITY_Autopilot Loop|Autopilot Loop]]
- [[_COMMUNITY_License Check|License Check]]
- [[_COMMUNITY_E2E Tests|E2E Tests]]
- [[_COMMUNITY_Web App Main|Web App Main]]
- [[_COMMUNITY_Permissions|Permissions]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 47 edges
2. `nowIso()` - 32 edges
3. `id()` - 24 edges
4. `audit()` - 20 edges
5. `safeJsonStringify()` - 16 edges
6. `getSetting()` - 13 edges
7. `log()` - 12 edges
8. `main()` - 11 edges
9. `resolveAgentModel()` - 11 edges
10. `json()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `api()` --calls--> `json()`  [INFERRED]
  apps/web/src/api/client.ts → scripts/demoSoftwareCompany.ts
- `main()` --calls--> `extractJsonObject()`  [INFERRED]
  scripts/smoke.ts → apps/server/src/utils/extractJson.ts
- `main()` --calls--> `log()`  [INFERRED]
  scripts/smoke.ts → apps/server/src/utils/logger.ts
- `runPnpmLicenses()` --calls--> `write()`  [INFERRED]
  scripts/licenseCheck.ts → apps/server/src/api/chat.ts
- `main()` --calls--> `log()`  [INFERRED]
  scripts/demoSoftwareCompany.ts → apps/server/src/utils/logger.ts

## Communities

### Community 0 - "Server API & Core"
Cohesion: 0.08
Nodes (12): ApprovalGate, providerDisplay(), classifyIntent(), CodeSandboxTool, DailyReport, list(), DocumentTool, EmailDraftTool (+4 more)

### Community 1 - "Agent Execution Engine"
Cohesion: 0.1
Nodes (27): AgentFactory, AgentRunner, extractToolCall(), CEOCompanyBuilder, emitRunEvent(), audit(), insertRow(), updateRow() (+19 more)

### Community 2 - "AI Providers & Tests"
Cohesion: 0.06
Nodes (30): AnthropicProvider, providerErrorMessage(), parsePlan(), CEOPlanner, id(), json(), main(), setting() (+22 more)

### Community 3 - "Web API Client & Pages"
Cohesion: 0.06
Nodes (16): assignTask(), async(), saveAgent(), api(), patch(), upload(), createGoal(), plan() (+8 more)

### Community 4 - "Auth & Settings"
Cohesion: 0.14
Nodes (21): getSetting(), setSetting(), createSession(), destroySession(), hasAdminPassword(), hashToken(), isValidSession(), setAdminPassword() (+13 more)

### Community 5 - "Web UI Views"
Cohesion: 0.1
Nodes (9): ApprovalsPage(), DepartmentsPage(), FounderDesk(), RunsPage(), SettingsPage(), useApi(), useRunEvents(), useSetupStatus() (+1 more)

### Community 6 - "Security & Vault"
Cohesion: 0.16
Nodes (11): ensureDataDirs(), getConfig(), FileTool, decryptSecret(), encryptSecret(), getVaultKey(), createProvider(), getSecretValue() (+3 more)

### Community 7 - "Chat & Planning"
Cohesion: 0.22
Nodes (7): handleKey(), sendMessage(), uid(), walk(), parseCookies(), requireAuth(), TaskPlanner

### Community 8 - "Model Resolution"
Cohesion: 0.36
Nodes (8): normalizeRole(), resolveAutoModel(), modelResult(), modelRoleKey(), parseModelSetting(), resolveAgentModel(), resolveModelForAgent(), roleLabel()

### Community 9 - "Autopilot Loop"
Cohesion: 0.4
Nodes (2): AutopilotLoop, shutdown()

### Community 10 - "License Check"
Cohesion: 0.5
Nodes (2): write(), runPnpmLicenses()

### Community 11 - "E2E Tests"
Cohesion: 0.67
Nodes (0): 

### Community 12 - "Web App Main"
Cohesion: 0.67
Nodes (0): 

### Community 13 - "Permissions"
Cohesion: 0.67
Nodes (1): isRiskyAction()

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (1): HttpApiTool

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (1): AppError

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (1): MockProvider

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 14`** (2 nodes): `Card.tsx`, `Card()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `Badge.tsx`, `Badge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `Button.tsx`, `Button()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `PageHeader.tsx`, `PageHeader()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (2 nodes): `Layout.tsx`, `createCompany()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `LoginPage.tsx`, `LoginPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `CompanyBoardPage.tsx`, `counts()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `ProjectsPage.tsx`, `ProjectsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `SchedulesPage.tsx`, `SchedulesPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `MemoryPage.tsx`, `MemoryPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `ToolsPage.tsx`, `ToolsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `HttpApiTool`, `.execute()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `AppError`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `MockProvider`, `.generateText()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `playwright.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `demoReset.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `AgentDetailPage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `AnalyticsPage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `AuditLogsPage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `types.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `departments.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `schedules.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `projects.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `companies.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `agents.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `tools.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `memory.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `audit.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `tasks.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `workProducts.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDb()` connect `Agent Execution Engine` to `Server API & Core`, `AI Providers & Tests`, `Auth & Settings`, `Security & Vault`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `json()` connect `AI Providers & Tests` to `Web API Client & Pages`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `api()` connect `Web API Client & Pages` to `AI Providers & Tests`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Are the 43 inferred relationships involving `getDb()` (e.g. with `.execute()` and `.execute()`) actually correct?**
  _`getDb()` has 43 INFERRED edges - model-reasoned connections that need verification._
- **Are the 31 inferred relationships involving `nowIso()` (e.g. with `.execute()` and `.save()`) actually correct?**
  _`nowIso()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 23 inferred relationships involving `id()` (e.g. with `.execute()` and `.save()`) actually correct?**
  _`id()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `audit()` (e.g. with `.run()` and `getDb()`) actually correct?**
  _`audit()` has 19 INFERRED edges - model-reasoned connections that need verification._