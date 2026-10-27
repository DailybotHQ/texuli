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
`tests/e2e/analytics-fixture.spec.ts` (enabled path),
`tests/e2e/analytics-csp.spec.ts` (enabled path under the enforced CSP)

## Purpose

Privacy-respecting, cookie-free page and event counts for texuli.com, plus
a count of how agents read the site (AI crawlers, unknown bots, Markdown
twins served). The design keeps three promises: **off by default**,
**first-party only** (the browser never contacts a foreign analytics
origin, so the CSP needs no carve-out) and **a closed event catalog**
with no personal data.

**Status today: not provisioned.** `PUBLIC_UMAMI_WEBSITE_ID` is not set
for the texuli.com Pages project, so the deployed site sends nothing. The
code below is complete and inert until the owner passes the checkpoint.

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
| `PUBLIC_UMAMI_SCRIPT_URL` | build | Optional override of the script source. It must be a same-origin root-relative path (`/…`); anything else (another origin, `//host/…`, a relative path) turns analytics off. Leave unset for the proxy default. |
| `PUBLIC_UMAMI_USE_PROXY` | build | Leave unset (proxy on). `false` would point the script at `https://cloud.umami.is`, which the enforced CSP blocks, so it turns analytics off instead. |
| `PUBLIC_UMAMI_ENABLE` | build | Force analytics on in non-production builds (`true`); production builds enable with an id alone. |
| `UMAMI_ENDPOINT_ORIGIN` | functions (server-side) | Where the proxy forwards. Owner-provisioned at this checkpoint — the code reads it, never hardcodes it; without it the proxy answers 503 problem+json. |

## Only the first-party proxy works under the enforced CSP

The enforced page policy allows `script-src 'self'` and `connect-src 'self'`
and has no carve-out for an analytics origin ([site-csp.md](site-csp.md)).
A direct Umami Cloud script, or any foreign `PUBLIC_UMAMI_SCRIPT_URL`, would
be blocked by the browser and record nothing. `src/lib/constances.ts`
therefore fails closed: when the resolved script source is not a
same-origin path, `ANALYTICS.umami.enabled` is `false`, the loader renders
no markup and no event is sent, exactly as with no website id
(`tests/analytics-client.test.ts`). The only working setup is the default proxy
path `/api/umami/script.js` with the collect endpoint `/api/umami`.

## How it behaves once enabled

- **Client:** one same-origin `/umami-loader.js` (cached, CSP-friendly:
  `script-src 'self'`, no inline script) injects the tracker from
  `/api/umami/script.js`; the tracker beacons to `/api/umami/api/send`.
  The browser never talks to a foreign analytics origin — there is no
  CSP carve-out for one.
- **Trusted Types:** the site enforces `require-trusted-types-for 'script'`,
  so the loader sets the script URL through its named `texuli-analytics`
  policy. The policy's `createScriptURL` returns only the one configured URL
  (the proxy path, or a same-origin `PUBLIC_UMAMI_SCRIPT_URL`) and throws for any other. A
  source that is not http(s) injects nothing. The page CSP names
  `texuli-analytics` only on pages that mount the loader
  ([site-csp.md](site-csp.md)). Browsers without Trusted Types get the plain
  string.
- **No query strings or fragments:** the injected script carries
  `data-exclude-search="true"` and `data-exclude-hash="true"`, so page views
  record the path only (Theme Studio share links keep a theme in `#theme=`).
- **Skip list:** Lighthouse-family audit tools get no injection at all
  (`src/lib/umami-skip.ts`, applied client-side; headless browsers are
  real visitors and are served).
- **Events:** only the catalog in `src/lib/analytics.ts` — theme switch,
  code copy, demo open, studio launch (reserved, no surface yet),
  outbound doc link (origin + pathname only, never the query string or
  fragment), search (`query_length` and `results` only, never the query
  text). Payloads pass a PII denylist on keys and an email scrub on values.
  Ad-hoc event names are type errors.
- **Edge:** the middleware counts AI-bot page hits (`ai_bot_visit`),
  unknown-bot heuristics (`unknown_bot_visit`) and served markdown twins
  (`markdown_request`) with UA-class + path only, through `waitUntil`,
  silent unless the website id is provisioned. Bot page hits count only for
  HTML answered `200`: redirects, errors and the HTML 404 (whose path the
  client chose) count nothing. The path is scrubbed with the client's email
  scrub and capped at 256 characters. The body carries the class, never
  the raw UA: payload `userAgent: 'bot'` (`'markdown-client'` for served
  twins), sent with the request header
  `User-Agent: texuli-edge/1.0 (server-side event)` (`buildBotEventBody`,
  `buildBotEventRequest`).
- **Proxy allowlist:** exactly `GET /api/umami/script.js` and
  `POST /api/umami/api/send`; everything else is a 404/405 problem+json.
  Cookies and authorization headers are dropped at the proxy. A beacon must
  be `application/json` (415 otherwise) and at most 16 KB (413, checked on
  the declared `content-length` and on the bytes read). Upstream redirects
  are never followed (`redirect: 'manual'`), and any non-2xx upstream answer
  becomes the 503 problem response (no `Location` reaches the browser).

## Dashboard expectations (Umami Cloud)

- Create one website for texuli.com; its id is `PUBLIC_UMAMI_WEBSITE_ID`.
- Expect the six client events above plus the three edge events; any
  other event name is a bug (the catalog is closed).
- Expect near-zero counts for Lighthouse runs (skipped by design).
- **Set `DISABLE_BOT_CHECK=1` on the Umami server.** Umami's default bot
  check may discard the edge events, whose user agent is bot-classed by
  design (above); without the setting the three edge counts can stay empty
  while browser analytics is unaffected. **Unverified** against a live
  Umami: confirm on the dashboard after the first deploy with the id set.

## Verification commands

```bash
pnpm build                     # default: analytics inert
TEXULI_E2E_PORT=4939 pnpm exec playwright test tests/e2e/analytics.spec.ts --project=chromium
PUBLIC_UMAMI_WEBSITE_ID=fixture-analytics-id pnpm build
TEXULI_E2E_PORT=4942 pnpm exec playwright test tests/e2e/analytics-fixture.spec.ts --project=chromium
pnpm build                     # restore the no-env dist

# Enabled path under the enforced CSP, from a separate fixture build:
PUBLIC_UMAMI_WEBSITE_ID=fixture-analytics-id pnpm --filter @texuli/website exec \
  astro build --outDir "$PWD/tmp/t100a-analytics-dist"
TEXULI_ANALYTICS_DIST=tmp/t100a-analytics-dist TEXULI_E2E_PORT=4993 \
  pnpm exec playwright test tests/e2e/analytics-csp.spec.ts --project=chromium
```

The fixture run proves: the mount tag carries the proxy src, a real
browser injects from the same origin only, and the Lighthouse UA gets no
injection. `analytics-csp.spec.ts` serves the build with its generated
`_headers` policies. On a default build it proves that every route keeps
`trusted-types svelte-trusted-html` only. On the fixture build it proves
that the loader injects the tracker with zero CSP or Trusted Types
violations and that the tracker runs.

## Ownership

| Concern | Files |
| --- | --- |
| Configuration (env reads, on/off decision) | `src/lib/constances.ts` |
| Mount and injector | `src/components/analytics/UmamiLoader.astro` (rendered by `src/layouts/BaseLayout.astro`), `public/umami-loader.js` |
| Event catalog, sanitizer, client `track` | `src/lib/analytics.ts`, `src/lib/track.ts`, `src/lib/outbound-links.ts` |
| Audit-tool skip list | `src/lib/umami-skip.ts` |
| First-party proxy | `functions/api/umami/[[path]].ts`, `functions/_lib/umami-proxy.ts`, `src/lib/umami-proxy-filter.ts` |
| Edge events | `functions/_middleware.ts`, `src/lib/bot-events.ts` (the agent surfaces it shares the middleware with are in [site-aeo.md](site-aeo.md)) |

## Spec map

| Behavior | Pinned by |
| --- | --- |
| Env parsing, production gating, proxy or direct source, verification metas off by default, PII key denylist and email scrub | `apps/website/tests/analytics-client.test.ts` |
| `track` is a silent no-op when off; queues until the tracker is ready when on | `apps/website/tests/analytics-client.test.ts` |
| Loader attributes and injection, the `texuli-analytics` Trusted Types policy, exclude-search/hash; skip list | `apps/website/tests/analytics-client.test.ts` |
| The page CSP names `texuli-analytics` only where the loader is mounted | `apps/website/tests/site-build-guards.test.ts` |
| Proxy allowlist, header stripping, 503 without an origin, 16 KB body cap, JSON-only beacons, no redirects followed | `apps/website/tests/umami-proxy.test.ts` |
| Edge event classification, the silent default, 200-only page hits, path scrub and 256-character cap | `apps/website/tests/edge-middleware.test.ts` |
| Surfaces wired to the catalog events | `apps/website/tests/umami-wiring.test.ts` |
| Default build: zero analytics markup and requests | `tests/e2e/analytics.spec.ts` |
| Fixture build: same-origin injection, Lighthouse skipped | `tests/e2e/analytics-fixture.spec.ts` |
| Built headers: Trusted Types allowance follows the mount; fixture build: zero violations under the enforced CSP | `tests/e2e/analytics-csp.spec.ts` |

```bash
pnpm vitest run apps/website/tests/analytics-client.test.ts apps/website/tests/umami-proxy.test.ts apps/website/tests/edge-middleware.test.ts
```

## How to extend

- **A new client event:** add it to `EVENTS` and its payload type to
  `EventPayloads` in `src/lib/analytics.ts`, wire it through `track`, and
  extend `umami-wiring.test.ts`. Payload keys must be categories (a theme
  id, a component id) or counts, never free text a person typed (search
  sends only the query length), and never identifiers of people.
- **A new edge event:** add it to `EVENTS` as server-side only and
  classify it in `bot-events.ts`; the middleware sends it through
  `waitUntil` so it never delays the response.
- **Another proxied path:** widen the allowlist in
  `umami-proxy-filter.ts` deliberately and add the case to
  `umami-proxy.test.ts`; the default answer stays a 404/405.
- **Never** add a CSP carve-out for an analytics origin; the proxy is the
  design.

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
