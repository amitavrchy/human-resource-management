# PeopleOS

People ops without the busywork. A multi-tenant HR workspace built from [PROJECT_SPEC.md](PROJECT_SPEC.md).

Next.js App Router + TypeScript + Redux Toolkit + React Query; NestJS ESM + Prisma 6 + PostgreSQL 16; FastAPI + LangChain/OpenAI + embedded Chroma.

## Run the complete application

Requires Docker Compose and Node.js 24 for the environment initializer.

```sh
node scripts/init-env.mjs
docker compose up --build -d --wait
```

Open **http://localhost:3000** and create a workspace. Registration creates its first owner and employee record, leave policies and an onboarding template. An empty workspace uses real empty states; demo data is optional.

The initializer generates random local secrets and preserves existing service environment files. Docker uses the root `.env`; native development uses `Server/.env`, `Client/.env.local` and `ai/.env`. Review existing files when switching between the two modes. No credentials or runtime data belong in Git.

Only the web port is published, on loopback by default. API, PostgreSQL and AI traffic stays inside the Compose network. Migrations finish before the API starts. Uploads, database records and handbook vectors use named volumes.

## What is included

- Responsive light/dark workspace, locally bundled Geist, visible text of at least 14px, keyboard command search and reduced-motion support.
- Searchable/paginated employee directory, CSV export, scoped profiles, emergency contacts, custom fields and cycle-safe org charts.
- Annual balances, working-day leave requests, manager/HR approvals, overlap/overdraw protection, cancellation/refunds and team calendar.
- Jobs and reusable templates, candidate pipeline, private resumes, notes, interview feedback and confirmed hiring into employee/onboarding records.
- Default onboarding templates, progress tracking and automatic activation after checklist completion.
- Company policies and private employee files, authenticated downloads, handbook indexing/retry, cited policy answers, JD drafts and batch resume screening.
- Goals, quarterly reflections, headcount/joiner/leaver/leave/recruiting reports, CSV reports and audit history.
- Organization settings, departments, locations, policies, roles, member access/revocation, password changes and appearance preferences.

Roles are `OWNER`, `HR_ADMIN`, `MANAGER`, `RECRUITER` and `EMPLOYEE`. Employees see themselves and company policies; managers see their reporting tree and assigned hiring roles. HR/owners administer the workspace. Recruiting data is restricted to the hiring roles. Private employee fields/files remain restricted to the employee and HR.

Existing accounts can be connected to another workspace without changing their password. Use the optional workspace handle on sign-in to choose a specific membership. Initial passwords for new accounts must be shared securely; automatic invitation email is not part of this release.

Payroll, benefits, EOR, e-signatures, external calendar/chat connections and deep/360 performance reviews remain the spec's stretch scope. Their connection status is explicitly marked as planned.

## Optional demo workspace

Set a strong `DEMO_PASSWORD` in the root `.env`, then run:

```sh
docker compose --profile demo run --rm seed
```

Sign in as `demo@peopleos.app` using that password. The idempotent seed creates Orbit Studio with 18 employees, 3 open roles, 12 candidates, policies, goals and checklists. Re-running does not reset passwords, balances or edited records. Use demo seeding only in development/demo deployments.

## AI connection

The core HR application runs without an OpenAI key. To enable model-backed tools, set `OPENAI_API_KEY` in the root `.env` and recreate the AI service:

```sh
docker compose up -d ai
```

For native development, put the key in `ai/.env`; use the same random `AI_SERVICE_TOKEN` in both service files. Keys stay server-side. Upload/index a company-wide handbook before asking policy questions. Failed indexing preserves the document and offers a retry. Unknown questions return an explicit refusal.

Resume scores summarize documented job-related evidence for human review; they never make hiring decisions. Live model/embedding behavior requires a configured key. The shipped automated tests use deterministic provider doubles and actual Chroma persistence.

## Native development

```sh
node scripts/init-env.mjs
npm run install:apps
docker compose --env-file .env -f Server/docker-compose.yml up -d --wait
```

Verify that `Server/.env` matches this development database, especially if the initializer preserved an existing file. Then, from `Server/`:

```sh
npm run db:migrate
npm run start:dev
```

From `Client/`, run `npm run dev`. From `ai/`, create a Python 3.12 virtual environment, install `requirements-dev.txt`, then run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8001`. Native defaults are web 3000, API 4000 and AI 8001. `API_INTERNAL_URL` is a client **build-time** setting. Use distinct ports/origins if another project is running.

`npm run build && npm start` in `Client/` serves the standalone production output, including its static assets.

## Verify

```sh
npm run check
```

API integration and browser tests require a migrated, dedicated database whose name contains `test` or `qa`:

```sh
# Set TEST_DATABASE_URL in your shell, without committing it.
npm run test:api
# Start the API and production web against that same database first.
npm run test:browser
```

From `ai/`:

```sh
python -m pytest -q
python -m ruff check app tests scripts
python scripts/audit.py
```

See [testing](docs/TESTING.md), [deployment/operations](docs/OPERATIONS.md), [architecture](docs/ARCHITECTURE.md) and [security](docs/SECURITY.md). CI runs application checks, PostgreSQL workflows, browser flows, AI retrieval tests, production dependency audits and container/seed smoke tests.

Chroma currently has upstream advisories without a published patched release. The private embedded deployment, disabled embedding plugins and expiring audit exception are documented in [SECURITY.md](docs/SECURITY.md); do not expose a standalone Chroma HTTP server.
