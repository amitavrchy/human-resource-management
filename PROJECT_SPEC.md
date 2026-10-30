# HRM System — Project Build Spec (Agent-Ready)

> Product brand: **PeopleOS**  
> Stack locked: `Client/` Next.js App Router + TS + Tailwind + Redux Toolkit + React Query + axios + RHF/zod + framer-motion + lucide-react + @tanstack/react-table + recharts + date-fns + react-day-picker + radix dialog/dropdown/tabs + sonner + clsx/tailwind-merge. `Server/` NestJS ESM + Prisma 6 + Postgres 16 + JWT/passport + bcrypt + config + class-validator + swagger. `ai/` FastAPI + openai + langchain + langchain-openai + chromadb + sqlalchemy + psycopg. No zustand.  
> Recommended extras: `cmdk`, `class-variance-authority`, `nuqs`, `react-dropzone`, `pdf-parse` (AI service), `python-multipart`, `pypdf`.

---

## 1. Vision & Personas

**Vision:** A mid-market HRIS that combines BambooHR’s clarity, Rippling’s lifecycle automation mindset, and Deel’s global-ready employee record — wrapped in Linear-grade UX. AI accelerates recruiting (JD + resume screen) and answers policy questions from your handbook.

**Brand promise:** “People ops without the busywork.”

**Personas**
| Persona | Goals |
|---------|-------|
| HR Admin | Single employee record, compliant leave, clean onboarding |
| Hiring Manager | Fast JD, shortlist resumes, interview feedback |
| Employee | Self-serve profile, time off, docs, payslip stubs |
| People Lead / Exec | Headcount, attrition, DEI-lite diversity charts |
| Recruiter | Pipeline kanban, candidate scorecards |

---

## 2. Competitive Research

| Product | Strength | Gap to beat | Link |
|---------|----------|-------------|------|
| **Rippling** | Unified employee record → IT/payroll automation | Opaque pricing; easy to overbuy; UI heavier than consumer SaaS | https://www.rippling.com · https://www.rewordin.com/blog/best-hris-systems-2026 |
| **BambooHR** | Clean SMB UI; published pricing; ATS add-on | Payroll/benefits add-ons; reporting thin on Core | https://www.bamboohr.com · https://resources.rework.com/tools/hr-people/best-hr-software-2026 |
| **Deel** | Global EOR/contractors; public module pricing | EOR cost; not deepest classic HRIS | https://www.deel.com |
| **Workday** | Enterprise HCM + planning + Illuminate AI | Cost, implementation time; overkill &lt;1000 emp | https://www.workday.com |
| **Personio** | Europe-first compliance, workflows | Quote-only; less known outside EU | https://www.personio.com |

**Beat them by:** delightful employee directory + org chart; Rippling-like onboarding checklist automation (software checklist simulated); AI JD writer + resume screening with transparent scores; policy chatbot grounded in uploaded handbook (RAG); cmd-K for “find Maya”, “request PTO”, “open pipeline”.

---

## 3. Design System

### Color
| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#FAFBFC` | Light primary (HR trust) |
| `--surface` | `#FFFFFF` | Cards |
| `--ink` | `#111827` | Text |
| `--muted` | `#6B7280` | Secondary |
| `--border` | `#E5E7EB` | Borders |
| `--accent` | `#4F46E5` | Indigo CTAs |
| `--accent-2` | `#06B6D4` | AI accents |
| `--success` | `#059669` | Approved |
| `--warn` | `#D97706` | Pending |
| `--danger` | `#DC2626` | Rejected / urgent |

Dark: `#0F1115` bg, `#161A22` surface, same accent.

### Typography
- UI: `Inter` / `Geist`; display medium for names.
- Mono for employee IDs.
- Density comfortable; avatars 32/40; directory cards grid.

### Motion
- Soft 200ms page transitions; checklist item complete confetti-lite scale; AI panel slide-over 250ms.

---

## 4. IA & Pages

### Marketing `/`
Value props: Core HR, Recruiting, Time Off, AI Copilot. CTA Start trial.

### Auth `/login` `/register` — creates Org + HR_ADMIN.

### `/app` shell — sidebar: Home, Directory, Org Chart, Time Off, Recruiting, Onboarding, Documents, Performance (MVP lite), Reports, AI Copilot, Settings.

### `/app` Home
- Greeting + PTO balance chips (employee) OR pending approvals + open roles (admin).
- Headcount sparkline; celebrations (birthdays/workiversaries this week).
- Tasks: complete onboarding steps / approve leave.

### `/app/directory` · `/app/directory/[employeeId]`
- Searchable table/grid; filters dept, location, status.
- Profile: photo, title, manager, dept, contact, emergency, custom fields, documents, leave history, equipment checklist.
- Org chart `/app/org-chart` — tree from managerId (pan/zoom simple CSS).

### `/app/time-off`
- Balances by policy; request form (date-fns range + react-day-picker); team calendar heat.
- Approver inbox.

### `/app/recruiting/jobs` · `jobs/[id]` · `candidates/[id]`
- Job list + create (AI “Generate JD” button → ai service).
- Pipeline kanban stages: APPLIED → SCREEN → INTERVIEW → OFFER → HIRED / REJECTED.
- Candidate: resume upload, AI screen score + reasons, notes, feedback forms.
- One-click “Hire” → creates Employee + Onboarding checklist.

### `/app/onboarding/[employeeId]`
- Template tasks (account, laptop, handbook ack, payroll form stub); progress %.

### `/app/documents`
- Company policies library; employee files; upload; AI chatbot entry point “Ask handbook”.

### `/app/performance` (MVP)
- Simple goals + quarterly review form stub.

### `/app/reports`
- Headcount, joiners/leavers, leave utilization, recruiting funnel conversion.

### `/app/ai`
- Chat UI for policy Q&A; Resume screen batch; JD generator form.

### `/app/settings`
- Org, departments, locations, leave policies, job templates, roles/members, integrations stubs.

---

## 5. Features Priority

### MVP
- Multi-tenant org, members, RBAC
- Employee directory + org chart
- Leave policies, requests, approvals, balances
- Jobs, candidates, pipeline, hire → employee
- Onboarding checklists
- Document upload metadata (URL/path)
- AI: JD generate, resume screen, policy chatbot (RAG)
- Dashboard + basic reports
- Audit log

### Stretch
- Payroll runs / payslips
- Benefits elections
- EOR/global payroll (Deel-like) — out of scope beyond currency/country fields
- 360 reviews, OKRs deep
- Slack/Teams bots
- e-sign offers
- Calendar sync

---

## 6. RBAC & Multi-tenancy

**Roles:** `OWNER`, `HR_ADMIN`, `MANAGER`, `RECRUITER`, `EMPLOYEE`.

| Capability | OWNER/HR_ADMIN | MANAGER | RECRUITER | EMPLOYEE |
|------------|----------------|---------|-----------|----------|
| All employees | ✓ | direct reports | candidates only | self |
| Approve leave | ✓ | reports | — | — |
| Jobs/candidates | ✓ | view hiring team | ✓ | — |
| AI tools | ✓ | JD for own reqs | ✓ | policy chat |
| Settings | ✓ | — | — | self prefs |

Every table: `organizationId`. Managers scoped by `managerId` tree.

---

## 7. Frontend Architecture

```
Client/src/
  app/(app)/app/{directory,time-off,recruiting,onboarding,documents,performance,reports,ai,settings}/...
  components/
    layout/ (AppShell, CommandPalette)
    people/ (EmployeeCard, OrgNode, ProfileHeader)
    leave/ (BalanceChips, LeaveCalendar, RequestDialog)
    recruiting/ (PipelineBoard, CandidateDrawer, ScoreBadge)
    ai/ (ChatPanel, JdGenerator, ResumeDropzone)
    data/ (DataTable, EmptyState)
    ui/
  features/ authSlice, uiSlice, orgSlice
  lib/ api.ts, queryKeys.ts, cn.ts
  hooks/ useEmployees, useLeave, useJobs, useAiChat...
```

**Redux:** auth, ui, org.  
**Query keys:** `['org', orgId, 'employees', filters]`, `['org', orgId, 'leave-requests', status]`, `['ai','chat', sessionId]`.

---

## 8. Prisma Schema

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql" url = env("DATABASE_URL") }

enum OrgRole { OWNER HR_ADMIN MANAGER RECRUITER EMPLOYEE }
enum EmploymentStatus { ACTIVE ONBOARDING LEAVE TERMINATED }
enum LeaveRequestStatus { PENDING APPROVED REJECTED CANCELLED }
enum JobStatus { DRAFT OPEN CLOSED }
enum CandidateStage { APPLIED SCREEN INTERVIEW OFFER HIRED REJECTED }
enum OnboardingTaskStatus { TODO DOING DONE BLOCKED }

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  members   Membership[]
  departments Department[]
  locations Location[]
  employees Employee[]
  leavePolicies LeavePolicy[]
  leaveRequests LeaveRequest[]
  jobs      Job[]
  candidates Candidate[]
  documents Document[]
  onboardingTemplates OnboardingTemplate[]
  auditLogs AuditLog[]
}

model User {
  id           String @id @default(cuid())
  email        String @unique
  passwordHash String
  name         String
  avatarUrl    String?
  memberships  Membership[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Membership {
  id             String  @id @default(cuid())
  organizationId String
  userId         String
  role           OrgRole @default(EMPLOYEE)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User @relation(fields: [userId], references: [id], onDelete: Cascade)
  employee       Employee?
  @@unique([organizationId, userId])
}

model Department {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  employees      Employee[]
  @@unique([organizationId, name])
}

model Location {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  country        String @default("US")
  employees      Employee[]
}

model Employee {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  membershipId   String? @unique
  membership     Membership? @relation(fields: [membershipId], references: [id])
  employeeNumber String
  firstName      String
  lastName       String
  workEmail      String
  personalEmail  String?
  phone          String?
  title          String?
  departmentId   String?
  department     Department? @relation(fields: [departmentId], references: [id])
  locationId     String?
  location       Location? @relation(fields: [locationId], references: [id])
  managerId      String?
  manager        Employee? @relation("OrgTree", fields: [managerId], references: [id])
  reports        Employee[] @relation("OrgTree")
  status         EmploymentStatus @default(ONBOARDING)
  startDate      DateTime?
  endDate        DateTime?
  birthDate      DateTime?
  avatarUrl      String?
  leaveBalances  LeaveBalance[]
  leaveRequests  LeaveRequest[]
  documents      Document[]
  onboardingTasks OnboardingTask[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([organizationId, employeeNumber])
  @@index([organizationId, status])
}

model LeavePolicy {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  annualDays     Float
  code           String
  balances       LeaveBalance[]
  requests       LeaveRequest[]
  @@unique([organizationId, code])
}

model LeaveBalance {
  id           String @id @default(cuid())
  employeeId   String
  policyId     String
  balanceDays  Float
  employee     Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  policy       LeavePolicy @relation(fields: [policyId], references: [id], onDelete: Cascade)
  @@unique([employeeId, policyId])
}

model LeaveRequest {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  employeeId     String
  employee       Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  policyId       String
  policy         LeavePolicy @relation(fields: [policyId], references: [id])
  startDate      DateTime
  endDate        DateTime
  days           Float
  reason         String?
  status         LeaveRequestStatus @default(PENDING)
  decidedById    String?
  decidedAt      DateTime?
  createdAt      DateTime @default(now())
  @@index([organizationId, status])
}

model Job {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  title          String
  department     String?
  location       String?
  descriptionMd  String
  status         JobStatus @default(DRAFT)
  candidates     Candidate[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model Candidate {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  jobId          String
  job            Job @relation(fields: [jobId], references: [id], onDelete: Cascade)
  name           String
  email          String
  resumeUrl      String?
  resumeText     String?
  stage          CandidateStage @default(APPLIED)
  aiScore        Float?
  aiSummary      String?
  aiReasonsJson  Json?
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([jobId, stage])
}

model OnboardingTemplate {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  tasksJson      Json // [{title, sortOrder}]
}

model OnboardingTask {
  id         String @id @default(cuid())
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  title      String
  status     OnboardingTaskStatus @default(TODO)
  sortOrder  Int @default(0)
  dueDate    DateTime?
}

model Document {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  employeeId     String?
  employee       Employee? @relation(fields: [employeeId], references: [id])
  title          String
  category       String // policy | personal | contract
  fileUrl        String
  isHandbook     Boolean @default(false)
  createdAt      DateTime @default(now())
}

model AuditLog {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  actorUserId    String?
  action         String
  entityType     String
  entityId       String?
  metaJson       Json?
  createdAt      DateTime @default(now())
  @@index([organizationId, createdAt])
}
```

---

## 9. NestJS Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/register` `/auth/login` `/auth/refresh` | |
| GET | `/me` | |
| CRUD | `/employees` | filters q, dept, status |
| GET | `/employees/org-tree` | |
| CRUD | `/departments` `/locations` | |
| CRUD | `/leave-policies` | |
| GET/POST | `/leave-requests` | |
| POST | `/leave-requests/:id/approve` `/reject` | |
| CRUD | `/jobs` | |
| CRUD | `/jobs/:jobId/candidates` | |
| PATCH | `/candidates/:id/stage` | |
| POST | `/candidates/:id/hire` | creates Employee + tasks |
| GET/PATCH | `/onboarding/:employeeId` | |
| CRUD | `/documents` | |
| POST | `/ai/jd` | proxies to FastAPI |
| POST | `/ai/screen-resume` | |
| POST | `/ai/chat` | policy RAG |
| POST | `/ai/ingest-handbook` | |
| GET | `/reports/headcount` `/reports/funnel` `/reports/leave` | |
| GET | `/audit-logs` | ADMIN |

---

## 10. AI Service (`ai/`) — Endpoints, Prompts, Flow

**Run:** `uvicorn app.main:app --reload --port 8001`  
**Env:** `OPENAI_API_KEY`, `DATABASE_URL` (optional), `CHROMA_PATH=./chroma`.

### Routes
| POST | `/v1/jd/generate` | body `{ title, department, level, mustHaves[], tone }` → `{ markdown }` |
| POST | `/v1/resume/screen` | body `{ jobDescription, resumeText }` → `{ score 0-100, summary, reasons[], missingSkills[] }` |
| POST | `/v1/handbook/ingest` | body `{ orgId, docId, text }` → chunk + embed Chroma collection `handbook_{orgId}` |
| POST | `/v1/handbook/chat` | body `{ orgId, message, history[] }` → `{ answer, citations[] }` |

### Flow — JD
1. Nest validates HR role → POST ai `/v1/jd/generate`.  
2. Prompt system: “You are an expert technical recruiter. Output inclusive, concrete JD in Markdown with sections: Overview, Responsibilities, Requirements, Nice-to-haves, Benefits placeholder. No discriminatory language.”  
3. Return markdown into job description editor (RHF).

### Flow — Resume screen
1. Extract text (upload → Nest stores URL + optional text; or client sends text).  
2. Prompt: score fit vs JD; JSON schema only.  
3. Persist `aiScore`, `aiSummary`, `aiReasonsJson` on Candidate.

### Flow — Policy chatbot
1. On handbook upload flagged `isHandbook`, Nest calls ingest.  
2. Chat: retrieve top-k chunks from Chroma → LangChain stuff/refine → answer with citations (chunk ids / titles).  
3. Refuse if no context (“I don’t see that in the handbook”).

### Prompt guardrails
- No invented legal advice; cite handbook.
- PII: do not echo national IDs from resumes in logs.

---

## 11. Reporting

- Headcount by dept/location (Recharts bar).
- Joiners/leavers by month.
- Leave utilization %.
- Recruiting funnel conversion per job.

---

## 12. Security / Perf / A11y / i18n

- Encrypt secrets; signed URLs for resumes; org isolation; managers cannot see compensation stretch fields they lack.
- Index employee name/email; paginate directory.
- A11y: calendar keyboard, dialog labels, AI responses as live region.
- i18n-ready strings; date locales via date-fns.

---

## 13. Milestones

1. Auth/org/shell/directory  
2. Leave policies + requests  
3. Recruiting pipeline + hire  
4. Onboarding tasks  
5. Documents + AI ingest/chat  
6. JD + resume AI  
7. Reports + audit + seed  

---

## 14. Acceptance Checklist

- [ ] Hire candidate creates ACTIVE/ONBOARDING employee + checklist  
- [ ] Leave approve decrements balance; reject does not  
- [ ] Org chart renders manager tree without cycles  
- [ ] AI JD returns usable markdown into form  
- [ ] Resume screen persists score visible on candidate  
- [ ] Handbook chat cites uploaded policy; unknown Q refuses gracefully  
- [ ] Cross-tenant employee fetch forbidden  
- [ ] Cmd-K finds employee by name  
- [ ] Docker Postgres + migrate + seed demo company works  
