# PNW Fish Camp

Formerly WA Fish Finder. Washington and Oregon lakes, creeks, rivers, surf and camps: where fish are, where to camp, when to go, and what the crew caught. Built mainly for Seri's own fishing and guys' camping trips. Live at https://wafishfinder.app (Vercel project `wa-crappie-lakes`, team `team_ygyo48hLvKuL7hQVgpmShwbP`). Owner: Seri.

## How changes ship

Claude commits and pushes straight to `main`. Vercel builds every push and promotes it to production only when the build passes, so a broken build never replaces the live site.

1. Make the change.
2. `npm run build` must pass (asset check, `tsc --noEmit`, Vite build).
3. Bump `version` in `package.json` for anything user-visible. The header, the service worker cache id and the footer all read it.
4. Add a dated section to `docs/SPEC.md` describing what shipped and why.
5. Commit with a message that says what changed and why, then push.
6. Confirm the Vercel deployment for the commit reached READY, and check runtime errors.

Ship every change through git yourself. Never ask Seri to upload files to GitHub by hand.

## Review by risk

Sort each change before you push it:

- Small: copy, docs, styling, data labels. Ship once the build passes.
- User-visible: features and fixes people will see. Before you push to `main`, hand the request and the diff to a separate reviewer agent, fix the real problems it finds, then ship.
- Risky: database schema, RLS policies, the invite trigger and auth, push notifications, the `watch` cron, and anything that deletes user data. Push a branch instead: Vercel builds a preview URL (behind Vercel login; share links needed). Have the reviewer agent check it, then wait for Seri's yes before you merge to `main`.

When you finish, tell Seri which group the change was in.

## Stack

Vite + React 18 + TypeScript, Leaflet, Supabase (project `ptdsxxttsyfczoacyyqg`: auth, Postgres with RLS, storage, realtime), Dexie for the offline cache and outbox, Zustand, vite-plugin-pwa. Serverless functions in `api/` (Node, same origin). Design system "Harbor Light": every color is a token in `src/styles/app.css` `:root`.

## Layout

- `src/features/<tab>/` one folder per tab (lakes, creeks, plan, log, more, trip, map, hikes, auth). Tabs other than Lakes and their sheets are lazy-loaded in `src/App.tsx`.
- `src/domain/` pure logic, no React: scoring, boat fit, coast rules, river schedules, catch record card. Prefer adding logic here and testing it with plain node.
- `src/api/` network clients. `src/store/` Zustand stores. `src/data/` baked datasets (`lakes.json` is 1,733 WDFW lakes, regenerate per `docs/SPEC.md` v3.2.0. `lakes-or.json` is about 900 Oregon lakes built by the `Oregon lakes data` GitHub Action from `scripts/fetch-oregon-lakes.mjs`, monthly or on demand. The sandbox cannot reach ODFW, so never hand-edit it.).
- `api/` Vercel functions: rules, plants, escapement, coast, river, geocode, watch (daily cron), push.

## Database rules

- Every table has RLS. Policies use `(select auth.uid())`, not bare `auth.uid()`.
- Trigger functions (`enforce_invite`, `handle_new_user`) have API execute revoked. Keep it that way for new trigger functions.
- `watch_state` is service-role only by design (RLS on, no policies).
- Schema changes go through a named Supabase migration, never ad hoc DDL. Run the security and performance advisors after.
- Signup is invite-only: the BEFORE INSERT trigger on `auth.users` is the real gate.

## Writing style for anything Seri reads

Plain language, active voice, address him as "you". No markdown formatting in chat replies, no em dashes, no semicolons.
