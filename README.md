# WriteSpace

A local-first React blog demo with visitor previews, registration/login, plain-text writing, ownership checks and administrator account/post management. Built with React 18, Vite 5, React Router 6 and Tailwind 3; JavaScript/JSX only.

## Safety and persistence
**Demo only. Never enter real passwords or sensitive information.** Passwords are intentionally plaintext in browser localStorage; built-in login is `admin` / `admin`. All authorization is client-side and can be bypassed with browser tools. No backend, synchronization, database or secure authentication service exists. Data belongs to the browser/origin, not a shared hosted blog. Clearing storage or changing origin removes access to that local data.

Keys: `writespace_users`, `writespace_posts`, `writespace_session`. Collection reads recover gracefully from corrupt/unavailable storage. Mutations reject corrupt collections and report quota/write failures instead of claiming success. Back up local data before clearing an affected key in browser developer tools; resetting users also invalidates user sessions. Built-in admin remains available. Account deletion retains historical post attribution.

## Run
From `frontend/`: `npm ci --no-bin-links`, then `npm run dev`. Copy `.env.example` to `.env` to customize the public host/port. Build with `npm run build`; output is `frontend/dist`. Preview: `node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 4173`.

## Routes
- `/`: public landing, newest three previews and role-aware entry.
- `/login`, `/register`: guest identity forms; signed-in accounts redirect home.
- `/blogs`, `/blog/:id`: authenticated list/full text and missing-post recovery.
- `/write`, `/edit/:id`: attributed creation and authorized edits, required fields/counter/cancel.
- `/admin`, `/users`: admin-only overview and accounts.

User writers manage only their own posts; admins manage every post. Default/current accounts cannot be deleted. Stored roles are lowercase `admin`/`user`. Dashboard Total Users includes all accounts and built-in admin; Total Admins includes built-in admin; Total users counts non-admin writers.

## Tests
From `frontend/`:
- `npm test`: Vitest/jsdom, 375 tests passed in final aggregate run.
- `node node_modules/@playwright/test/cli.js install chromium`: one-time browser setup.
- `PW_DISABLE_TS_ESM=1 E2E_BASE_URL=http://127.0.0.1:4173 npm run e2e`: desktop/mobile real browser journeys against a production preview; webServer starts matching host/port automatically. The loader setting avoids a Playwright 1.49 ESM-loader hang on Node 24 in this sandbox.

Final browser verification: 41/46 passed initially; five failures corrected (finite CSS float for stable reading links and exact Users locator). All 16 tests in affected identity/discovery specs passed on targeted rerun; the other 30 passed in the full run. No tests skipped. Preflight captured desktop/mobile accessibility, styles, HTML and screenshots. Low-severity critic coverage note: a dashboard recent-post title link is not directly clicked by a browser test; dashboard editing/deletion and reader entry points are covered elsewhere. API/database/backend integration and compose tests are not applicable to this frontend-only architecture.

## Deploy
Vercel project Root Directory **frontend**, framework Vite, build `npm run build`, output `dist`. `frontend/vercel.json` is rewrite-only so direct routes resolve to index.html; root copy is retained for handoff. Do not use repository root as the Vercel project directory without configuring the nested build in project settings.

Standalone container files are in frontend: `docker build -t writespace frontend` then `docker run --rm -p 8080:80 writespace`. nginx serves `/` and uses a SPA fallback without any backend proxy. Docker image build was not executed in this static-app run; Vite production build and browser preview were verified.

## Implementation notes
Five individually tested feature commits retain the PRD's four user stories. No HLD/LLD was supplied; architecture was inferred from the canonical PRD. Full-page rainbow backgrounds were replaced by neutral surfaces under the run's UI policy; named brand accents, role avatars and CSS-only preview motion remain. No external font requests or animation libraries. Dependency lock is committed. Pipeline planning/history files stay outside Git; the final code graph is tracked.
