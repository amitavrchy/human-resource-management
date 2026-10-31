# PeopleOS delivery tracker

Source of truth: `PROJECT_SPEC.md`. The checkout started with framework scaffolds. Stretch payroll, benefits, EOR and external integrations are out of scope.

- [x] Implement database schema, tenant scoping, cookie authentication and authorization
- [x] Implement employee directory, profiles, org chart and organization settings
- [x] Implement leave requests, transactional approvals and yearly balances
- [x] Implement recruiting pipeline, screening integration and transactional hiring
- [x] Implement onboarding, private documents and performance lite
- [x] Implement FastAPI AI tools and tenant-scoped handbook retrieval
- [x] Implement responsive application, command search and reduced-motion support
- [x] Implement reports, audit trail and idempotent demo seed
- [ ] Complete operational documentation, environment templates and deployment packaging
- [ ] Complete database integration tests, security review and full browser verification

Implementation checkmarks do not imply production acceptance. Work stopped at the user's request on 2026-10-31 so the current checkpoint could be pushed.

## Verification completed

- Full Next.js production build passed for all implemented routes before the final template/manager-scope changes; the latest client typecheck also passes.
- Latest NestJS build passes.
- Five server unit tests and five Python AI service tests pass.
- Three Prisma migrations applied successfully to an isolated PostgreSQL 16 QA database; demo seed ran successfully.
- Browser smoke check: demo login and dashboard load; no visible dashboard text below 14px at the tested desktop size.
- Client lint passed before the final template/manager-scope changes.

## Resume here

1. Run fresh client build/lint and server checks after this checkpoint. Expand real-database integration coverage for cross-tenant access, manager permissions, duplicate/concurrent leave approvals, idempotent hiring, private downloads, session rotation and onboarding completion.
2. Test every route and form in a browser at desktop/mobile sizes, including command-search keyboard navigation and reduced motion. The dashboard is the only page smoke-tested so far.
3. Test AI persistence, citations and tenant allowlists with mocked providers. The user explicitly chose key-free integration testing; no OpenAI key is configured and no live model/embedding call has been verified.
4. Update the environment examples: both NestJS and FastAPI require the same random `AI_SERVICE_TOKEN` (at least 32 characters); NestJS requires a random `JWT_SECRET`. FastAPI also needs `OPENAI_API_KEY` for model and embedding requests.
5. Replace scaffold READMEs and finish Dockerfiles/Compose, health checks, deployment instructions and CI. The current Docker files remain starter material, not a verified deployment.
6. Address remaining development-tool dependency advisories and format the new source for review. The Prisma 6 toolchain now overrides `deepmerge-ts` with its patched version; generation/build succeeded with that change. Do not blindly apply breaking audit fixes.

Demo seeding requires an explicit `DEMO_PASSWORD` (at least 12 characters); run migrations before `npm run db:seed` from `Server/`. The demo owner's email is `demo@peopleos.app`. Runtime files, QA database data, local credentials and screenshots under `.local/` are intentionally ignored and not pushed.

## Git

Remote: https://github.com/amitavrchy/human-resource-management.git · branch: `main`.
Milestone commits have been pushed throughout implementation. The final checkpoint includes the in-progress hardening changes and this handoff.
