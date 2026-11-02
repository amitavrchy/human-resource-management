# PeopleOS delivery tracker

Implementation and local release verification completed on **2026-11-02** against `PROJECT_SPEC.md`. Payroll, benefits, EOR and external integrations remain stretch scope.

- [x] Database schema, tenant isolation, cookie authentication and RBAC
- [x] Directory, private profiles/custom fields and cycle-safe org chart
- [x] Leave requests, transactional approvals, yearly balances and calendar
- [x] Recruiting/templates, private resumes, screening and idempotent hiring
- [x] Onboarding, documents, performance lite, reports and audit trail
- [x] AI tools and persistent tenant/document-scoped handbook retrieval
- [x] Responsive UI, minimum 14px text, command search and reduced motion
- [x] Organization settings, membership lifecycle and idempotent demo seed
- [x] Environment initialization, production containers, CI and operations docs
- [x] Integration, security and desktop/mobile browser verification

## Verified checks

| Check                               | Result                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| NestJS / Next.js production builds  | Passed                                                                                                 |
| Type checks and application linters | Passed; no lint findings                                                                               |
| Server unit tests                   | 5 passed                                                                                               |
| Real PostgreSQL integration tests   | 18 passed                                                                                              |
| Python AI tests / Ruff              | 11 passed / lint passed                                                                                |
| Production-stack browser workflows  | 11 passed                                                                                              |
| Desktop/mobile layout               | 13 primary routes at 1440px and 390px; visible text at least 14px; no page overflow or uncaught errors |
| Docker build, migrations and health | Passed for the complete stack                                                                          |
| Demo seed                           | Ran twice without duplicate records                                                                    |
| Container smoke                     | Secure HttpOnly sessions, assets, onboarding and private file I/O passed                               |
| PostgreSQL backup/restore           | Separate QA restore succeeded; organization, employee and membership counts matched                    |
| Node production dependency audits   | Zero findings                                                                                          |
| Python audit                        | Passed with the explicit Chroma exception below                                                        |
| Workflow syntax                     | actionlint passed                                                                                      |

Browser checks cover registration/login/workspace selection; member roles/revocation; employee edits/search/export; command-search keyboard controls; leave approval/calendar/cancellation; resume download with session refresh; feedback/hire/onboarding; documents; deterministic AI draft/batch/citation rendering; goals/reviews; settings/templates and persisted theme.

## Verification boundaries

The user requested **key-free AI integration tests**. API tests use a private provider double, browser AI rendering uses controlled responses, and Python tests use real persistent Chroma with deterministic vectors/model responses. No live OpenAI generation or embedding call has been verified. Configure a provider key and follow [docs/TESTING.md](docs/TESTING.md) to verify model availability and answer quality.

Chroma 1.5.9 has upstream advisories with no published fixed version at review time. The private embedded deployment disables embedding plugins and enforces tenant/document filtering. Its version-scoped exception expires **2026-12-02**; see [docs/SECURITY.md](docs/SECURITY.md). This is a mitigation assessment, not an upstream fix. Remaining npm advisories concern development-only Nest CLI/ESLint dependencies.

Docker was verified locally. Actual hosting still requires TLS, secrets, backups and monitoring configured for that environment. Automated checks do not constitute an independent penetration test or compliance certification.

## Run and maintain

See [README.md](README.md), [operations](docs/OPERATIONS.md), [architecture](docs/ARCHITECTURE.md) and [testing](docs/TESTING.md). CI runs application, AI and container checks for pushes to `main` and pull requests.

Credentials, QA data, runtime files, traces and screenshots under `.local/` are ignored and not published. Demo seeding requires an explicit `DEMO_PASSWORD`; sign-in uses `demo@peopleos.app`.

Git remote: https://github.com/amitavrchy/human-resource-management.git — branch `main`. Milestones are committed and pushed separately.
