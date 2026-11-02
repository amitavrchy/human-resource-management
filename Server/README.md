# PeopleOS API

NestJS ESM, Prisma 6 and PostgreSQL 16. Use the [root README](../README.md) for environment initialization and complete Docker setup.

```sh
npm ci
npm run db:migrate
npm run start:dev
```

`Server/.env` must contain `DATABASE_URL`, a random `JWT_SECRET` and `CLIENT_ORIGIN`. To connect AI, set the same random `AI_SERVICE_TOKEN` as FastAPI and its `AI_SERVICE_URL`. Uploads use `UPLOAD_DIR`. See [.env.example](.env.example).

`npm run build && npm run start:prod` starts the emitted ESM server on port 4000 by default. `/health/live` checks the process, `/health/ready` checks PostgreSQL, and `/docs` exposes Swagger in non-production environments.

```sh
npm run typecheck
npm run lint
npm test
# Set TEST_DATABASE_URL to a dedicated, already migrated test/QA database.
npm run test:e2e
```

Integration tests run the compiled NestJS module, use real PostgreSQL and a private AI provider double, and clean only their own fixtures. Demo seeding is explicit: set `DEMO_PASSWORD`, then run `npm run db:seed` against a development database. Runtime data and credentials are ignored by Git.

Read [architecture](../docs/ARCHITECTURE.md), [security](../docs/SECURITY.md), [testing](../docs/TESTING.md) and [operations](../docs/OPERATIONS.md) for business rules, permissions and deployment boundaries.
