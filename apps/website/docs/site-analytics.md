# texuli.com analytics (Umami)

**App:** `apps/website` + root `functions/`
**Pieces:** `src/components/analytics/UmamiLoader.astro` (mount),
`public/umami-loader.js` (same-origin injector),
`src/lib/track.ts` + `src/lib/analytics.ts` (typed events, sanitizer),
`src/lib/umami-proxy-filter.ts` + `functions/api/umami/[[path]].ts`
(first-party proxy), `src/lib/bot-events.ts` + `functions/_middleware.ts`
(server-side bot/markdown events), `src/lib/umami-skip.ts` (audit skip list)
**Tasks:** PLAN_006 T-14 (config), T-34..T-39
**Verification:** `tests/e2e/analytics.spec.ts` (default-off),
`tests/e2e/analytics-fixture.spec.ts` (enabled path)

## The consent checkpoint

**Nothing sends until you, the owner, set the environment variables in
the Cloudflare Pages project settings.** All analytics code ships
inert: with no env config the built site emits zero analytics markup
and fires zero requests (asserted by `analytics.spec.ts` on every
committed build).

## Environment variables (Cloudflare Pages, production)

| Variable | Where | Meaning |
| --- | --- | --- |
| `PUBLIC_UMAMI_WEBSITE_ID` | build + functions | The Umami website id (Umami Cloud → the site's dashboard). The on/off switch for everything. |
| `PUBLIC_UMAMI_SCRIPT_URL` | build | Optional override of the script source. Leave unset for the proxy default. |
| `PUBLIC_UMAMI_USE_PROXY` | build | `false` opts out of the first-party proxy (direct `https://cloud.umami.is`); default is proxy on. |
| `PUBLIC_UMAMI_ENABLE` | build | Force analytics on in non-production builds (`true`); production builds enable with an id alone. |
| `UMAMI_ENDPOINT_ORIGIN` | functions (server-side) | Where the proxy forwards. Owner-provisioned at this checkpoint — the code reads it, never hardcodes it; without it the proxy answers 503 problem+json. |

## How it behaves once enabled

- **Client:** one same-origin `/umami-loader.js` (cached, CSP-friendly:
  `script-src 'self'`, no inline script) injects the tracker from
  `/api/umami/script.js`; the tracker beacons to `/api/umami/api/send`.
  The browser never talks to a foreign analytics origin — there is no
  CSP carve-out for one.
- **Skip list:** Lighthouse-family audit tools get no injection at all
  (`src/lib/umami-skip.ts`, applied client-side; headless browsers are
  real visitors and are served).
- **Events:** only the catalog in `src/lib/analytics.ts` — theme switch,
  code copy, demo open, studio launch (reserved, no surface yet),
  outbound doc link, search. Payloads pass a PII denylist on keys and an
  email scrub on values. Ad-hoc event names are type errors.
- **Edge:** the middleware counts AI-bot page hits (`ai_bot_visit`),
  unknown-bot heuristics (`unknown_bot_visit`) and served markdown twins
  (`markdown_request`) with UA-class + path only, through `waitUntil`,
  silent unless the website id is provisioned.
- **Proxy allowlist:** exactly `GET /api/umami/script.js` and
  `POST /api/umami/api/send`; everything else is a 404/405 problem+json.
  Cookies and authorization headers are dropped at the proxy.

## Dashboard expectations (Umami Cloud)

- Create one website for texuli.com; its id is `PUBLIC_UMAMI_WEBSITE_ID`.
- Expect the six client events above plus the three edge events; any
  other event name is a bug (the catalog is closed).
- Expect near-zero counts for Lighthouse runs (skipped by design).

## Verification commands

```bash
pnpm build                     # default: analytics inert
TEXULI_E2E_PORT=4939 pnpm exec playwright test tests/e2e/analytics.spec.ts --project=chromium
PUBLIC_UMAMI_WEBSITE_ID=fixture-analytics-id pnpm build
TEXULI_E2E_PORT=4942 pnpm exec playwright test tests/e2e/analytics-fixture.spec.ts --project=chromium
pnpm build                     # restore the no-env dist
```

The fixture run proves: the mount tag carries the proxy src, a real
browser injects from the same origin only, and the Lighthouse UA gets no
injection.

## Deviations and known gaps

- **No wrangler smoke:** the live proxy loop (`wrangler pages dev`) is a
  manual owner step — `wrangler` is not a devDependency yet (owner ask
  recorded in the plan journal). The proxy's request handling is
  unit-proven (`umami-proxy.test.ts`), and the static-host fixture run
  proves the request shape end to end minus the forward.
- **Server-side event origin:** the edge sender posts to its own origin
  so the same functions deployment answers; if the Pages project ever
  splits domains, `buildBotEventRequest`'s origin argument needs the
  canonical one.
- The deploy dashboard question from T-13 (advanced root-directory
  override + Functions enabled) remains an owner checkpoint: the
  repo-root `functions/` directory is the documented Pages convention,
  and the middleware (T-26..T-28) already depends on it.
