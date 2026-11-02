# PeopleOS web

Next.js App Router, TypeScript, Tailwind/CSS tokens, Redux Toolkit, React Query, React Hook Form/Zod and accessible Radix dialogs. Start with the [project guide](../server/docs/PROJECT.md).

```sh
npm ci
npm run dev
```

The web application uses same-origin `/api` requests. `API_INTERNAL_URL` in `.env.local` is the **build-time** proxy target, defaulting to `http://127.0.0.1:4000`. There are no browser-side provider keys. Fonts are locally bundled under `public/fonts` with their license.

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

The start helper serves Next's standalone production build and copies its static/public assets to the correct locations. Docker packages those same assets and runs as an unprivileged user.

```sh
npx playwright install chromium
# Start the API and production web against a dedicated test/QA database.
# Set TEST_DATABASE_URL to that database; optionally set PLAYWRIGHT_BASE_URL.
npm run test:e2e
```

Browser tests cover real forms and persistence, role-aware navigation, desktop/mobile layouts, 14px minimum visible typography, keyboard command search and key HR workflows. See [testing](../server/docs/TESTING.md). Keep failure traces out of Git.
