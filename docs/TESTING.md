# Verification

## Automated suites

| Layer           | Command                          | Coverage                                                                                                                                                                                                                                                                                    |
| --------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API unit        | `npm --prefix Server test`       | Calendar validation, organization work weeks, API identity                                                                                                                                                                                                                                  |
| API integration | `npm run test:api`               | Real PostgreSQL, tenant/self/report scoping, cycle/owner protections, concurrent leave accounting, idempotent hiring, onboarding, private files, AI proxy persistence, role checks, templates, custom fields, session/password revocation                                                   |
| Browser         | `npm run test:browser`           | Production web/API; registration/login; every route at desktop and mobile; minimum font size; overflow; employee edits/search/export; keyboard command search; calendar selection/leave approval; pipeline/hire/onboarding; files/chat failure state; goals/reviews; settings/presets/theme |
| AI              | `python -m pytest -q` from `ai/` | Real persistent Chroma with deterministic providers, chunk replacement, tenant/doc filtering, citation refusal, structured outputs/redaction, PDF handling, service authentication and safe validation errors                                                                               |
| Container       | `npm run smoke:containers`       | Private API proxy, production cookies, static fonts, DB readiness, employee/checklist creation and durable authenticated file I/O                                                                                                                                                           |

Use a dedicated PostgreSQL database named with `test` or `qa`. Set `TEST_DATABASE_URL` in your shell and apply migrations with `DATABASE_URL` pointing to that database. API tests reject an unspecified/non-test database, create unique organizations, and remove only their own fixtures. Browser tests must point to a running API using **the same test database**; their cleanup connects to that database directly.

The default browser URL is `http://127.0.0.1:3000`, avoiding IPv6 `localhost` collisions with other projects. Configure `CLIENT_ORIGIN` accordingly and override `PLAYWRIGHT_BASE_URL` when using a different port. Install Chromium once with `npx --prefix Client playwright install chromium` (CI adds `--with-deps`).

Before browser tests, build and start the API and the web production server. The AI service may be unconfigured: these tests explicitly verify preserved documents and helpful unavailable/refusal states. A dedicated browser test intercepts AI responses to verify JD drafts populate the job editor, batch results render and handbook citations display. No live OpenAI call is made by automated tests. API integration tests use a private local HTTP provider double to verify persistence and authorization; Python retrieval tests use deterministic vectors and structured model responses against real Chroma storage.

Browser HTML reports and failure traces are generated under `Client/playwright-report` and `Client/test-results`, both ignored by Git. Successful tests do not retain screenshots containing user data. CI retains failure diagnostics for inspection.

## Manual release checks

When supplying a real provider key, additionally verify one JD draft, one uploaded text/PDF resume assessment, handbook indexing, a cited known answer and refusal for an unknown question. This checks provider/model availability and answer quality beyond the tested integration contract. Verify storage backup/restore and ingress TLS in the actual hosting environment before importing real employee data.

The checked-in [CI workflow](../.github/workflows/ci.yml) runs these layers on PostgreSQL 16, Node 24 and Python 3.12, builds all production containers and runs the demo seed twice to check idempotency.
