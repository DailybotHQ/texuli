# texuli.com agent surfaces (AEO)

**App:** `apps/website` + root `functions/`
**Tasks:** PLAN_006 T-22..T-28 (surfaces), T-30 (audit); PLAN_011
T-ar-discovery (discovery files and headers), T-ar-twins (a Markdown twin
for every page)
**Specs:** `tests/e2e/site-seo.spec.ts` runs the AEO audit on the built
`dist/`; `tests/e2e/site-agent-discovery.spec.ts` checks the discovery
files and headers on the built `dist/`; `tests/e2e/site-twins.spec.ts`
runs the real middleware in front of the built `dist/`; unit tests in
`apps/website/tests/` (edge logic, discovery files, `agent-discovery.test.ts`,
`twins.test.ts`), `scripts/tests/audit-aeo.test.ts`,
`scripts/tests/check-md-parity.test.ts`

## Purpose

texuli.com is written to be read by agents as well as people. This note
covers the files and edge behavior an agent finds first: a root
`llms.txt`, a Markdown twin beside every page, the `.well-known`
discovery files, a robots policy that names AI crawlers, and the Pages
middleware that serves twins on `Accept: text/markdown` and answers agent
misses with RFC 9457 problem JSON. Head metadata, the sitemap and social
images are in [site-seo.md](site-seo.md); the event counting the
middleware also does is in [site-analytics.md](site-analytics.md).

## Structure

| Surface | What ships | How it is produced |
| --- | --- | --- |
| `/llms.txt` | The whole-site index in the llmstxt.org shape: H1, summary blockquote, one H2 per site area, `- [Title](url): line` links | A **committed** file, `apps/website/public/llms.txt`, written by `scripts/generate-site-llms.ts` from `src/components/seo/llms-site.ts` (sections derived from `NAV_GROUPS`, the guides and the component families) through `formatSiteLlmsTxt` in `@texuli/tools/llms`. Served verbatim, no redirect |
| `/llms/`, `/catalog/` | The catalog bundle (`llms.txt`, `llms-full.txt`, per-component docs) and the catalog JSON | Committed snapshots under `public/llms/` and `public/catalog/`, unchanged by this plan |
| `/llms-full.txt` | The same bytes as `/llms/llms-full.txt`, at the root where llmstxt.org readers look | Copied from the built `/llms/llms-full.txt` by `src/integrations/agent-discovery.ts`; no second generator |
| `<page>.md` twins | One Markdown file beside every built HTML page but the allowlist (`/` → `/index.md`, `/guides/theming/` → `/guides/theming.md`), plus `md-manifest.json` mapping page → twin, and `<link rel="alternate" type="text/markdown">` in every page head | `src/components/docs/integration.ts` at build time through `twins.ts` and `twin-notes.ts` (rules below); the head link is `SeoHead.astro` (`twinPathFor`); `scripts/check-md-parity.ts --strict` proves all three after a build |
| `/.well-known/ai-catalog.json`, `/.well-known/mcp/server-card.json` | The ARD catalog (including the remote MCP at `https://texuli.com/mcp`) and the MCP server card | Committed under `apps/website/public/.well-known/` (the server card is owned by the operations registry work). The ARD's `logoUrl` is `https://texuli.com/brand/texuli-logo-light.png`, a committed file in `apps/website/public/brand/` |
| `/.well-known/api-catalog`, OAuth stubs, `/.well-known/jwks.json`, `/auth.md`, `/.well-known/security.txt`, `/.well-known/agent-card.json`, `/.well-known/poppy.json` | The discovery documents of the checklist below | **Generated at build** from one typed source, `src/components/seo/agent-discovery.ts`, written by `src/integrations/agent-discovery.ts`; nothing is committed under `public/` |
| `Link` response headers, per-file content types and CORS | The discovery `Link` on every HTML page; `application/linkset+json`, `text/markdown`, CORS `*` on the public JSON | Written into `dist/_headers` by the CSP integration (`linkHeaderLine` and `discoveryHeaderRules`); the middleware sets the same `Link` on the twins it builds |
| `/.well-known/agent-skills/index.json`, `/skill-pack/` | The skill pack copied into the build and indexed with the SHA-256 of each served `SKILL.md` | Generated at build by `src/integrations/skill-pack.ts`, so digests cannot drift |
| `/robots.txt` | Allow-all default, `Sitemap:` line, `Agentmap:` (the ARD catalog), an explicit `Allow: /` group for each of the 16 `AI_CRAWLERS`, `Content-Signal: ai-train=yes, search=yes, ai-input=yes` in every group, no `Disallow` | `buildRobots` in `src/components/seo/seo.ts` (signals and Agentmap from `agent-discovery.ts`), written by the SEO integration; there is no `public/robots.txt` |

### The middleware (`functions/_middleware.ts`)

Cloudflare Pages Functions from the repository root. The site itself stays
`output: 'static'`; the middleware imports pure decision modules from
`apps/website/src/lib/` and does three things, in order (the bot-event
counting it also does is in [site-analytics.md](site-analytics.md)):

1. **Strict-parser robots.** For Lighthouse-family user agents
   (`isStrictParserAudit`) it serves `/robots.txt` through
   `stripDirectivesForStrictParsers` (`robots-variants.ts`): the shipped
   policy minus its `Content-Signal` and `Agentmap` lines, which strict
   parsers flag although RFC 9309 says to ignore unknown directives.
2. **Markdown negotiation.** `negotiateTwin` (`md-negotiate.ts`) answers
   an explicit `text/markdown` Accept on every page path, `/` included
   (`markdownTwinFor`: `/` and `/index.html` → `/index.md`; `/a/b/`,
   `/a/b/index.html` and `/a/b` → `/a/b.md`; files with an extension and
   `/api/`, `/.well-known/`, `/mcp` and `/_astro/` never negotiate). It
   fetches the twin from `env.ASSETS` with
   `content-type: text/markdown; charset=utf-8`, `Vary: Accept`,
   `X-Content-Negotiation: markdown` and the discovery `Link` (the twin is a
   Function response, so no `_headers` rule reaches it; `service-desc` is
   left to the API catalog). A wildcard or HTML Accept passes through; a
   missing twin falls through to the pipeline instead of inventing a body.
   A `.md` URL asked for directly (`isDirectMarkdownPath`) that the pipeline
   answers 200 is relabelled `text/markdown; charset=utf-8` with `nosniff`,
   whatever type the host guessed; misses and 304s pass through. A
   negotiated twin and a direct `.md` hit each count one `markdown_request`
   event ([site-analytics.md](site-analytics.md)).
3. **Agent-shaped 404s.** A 404 for a non-browser client (a request
   `isAgentRequest` classifies as an agent: named AI crawlers, generic
   crawler markers, plain HTTP clients; or any request that prefers
   `text/markdown`) gets a Markdown body from `markdownNotFound`
   (`text/markdown`, `Vary: Accept`): the missed path as inert code (control
   characters and backticks removed, capped at 200 characters) and links to
   `/llms.txt`, the sitemap, `/index.md` and `/auth.md`. Under `/api/`, and
   for clients that ask for JSON without asking for Markdown
   (`prefersProblemJson`), the body stays RFC 9457
   `application/problem+json` from `agentProblem` (`type: about:blank`, the
   path as `instance`, `guide: <origin>/llms.txt`). Browsers and
   Lighthouse keep the static `404.html`.

Every other response is returned as the very object `context.next()` gave,
never a rebuilt copy: Cloudflare Pages applies `_headers` only to that
asset response, so a copy would drop the page CSP (PLAN_006 T-100 S-2). The
HTML of every page with a built twin still declares `Vary: Accept`,
matching its twin, but the header comes from the page's `_headers` rule:
`varyHeaderLine` in `src/components/security/csp.ts` adds it at build time
to every route whose twin file exists (see [site-csp.md](site-csp.md)).

### Twin rules and the allowlist (PLAN_011 T-ar-twins)

- **One twin per page.** Every built HTML page has a twin at its URL plus
  `.md` (`/` → `/index.md`; the isolated preview frames and the email
  preview included), except the routes in `TWIN_EXEMPTIONS`
  (`src/components/docs/twins.ts`). The allowlist holds one entry today:
  `/404.html`, the error document, because a miss has no content to mirror
  and non-browser clients get the Markdown 404 above. Redirect stubs (a
  small `meta refresh` document) are skipped too; the site builds none.
  Non-HTML endpoints (`/theme-css/<id>.css`, `/theme-data/<id>.json`,
  `/theme-catalog.json`, `/theme-catalog-dark.json`, `/theme-gallery.json`,
  `/slides-page/media/texuli-mark.webp`) are not pages and never enter the
  check.
- **The page's own content.** No page has a Markdown or MDX source today,
  so every twin is a structured rendition of the built page: the content
  between the layout's `<!--tx-page-body-->` markers (every `BaseLayout`
  page; the landing branch carries them too), else `<main>`, else `<body>`,
  through `htmlToMarkdown` (headings, prose, lists, tables, links, code).
  Images keep their facts: informative `alt` text becomes `![alt](src)`
  (or the alt text alone for a non-site source), a labelled SVG
  (`role="img"` with `aria-label`) keeps its label, and decorative images
  disappear. Layout tables (`role="presentation"`, as in the email) become
  plain blocks. The page's first `h1` becomes the twin title; links become
  absolute. When a page gains a Markdown source, its source should replace
  the rendition.
- **The header block.** Every twin opens with `# Title`, the page
  description as a quote, then `Language:` (from `<html lang>`),
  `Canonical:` (the HTML URL), `Markdown:` (this twin's URL, the `.md` rule
  and `Accept: text/markdown`) and `Last Updated:` (the same git date as the
  page's sitemap `lastmod`, `routeLastmod` in
  `src/components/seo/integration.ts`, so it is deterministic for a
  commit), then a `---` rule. `parseTwinHeader` reads it back.
- **Interactive pages.** A live demo cannot be text, so the twins of
  interactive pages (the home, the theme tools, builders and playgrounds,
  component and example pages, the domain demo pages, the showcase) end
  with a "For agents" section from `twin-notes.ts`: what the demo shows,
  the MCP operations at `https://texuli.com/mcp` that do the same work
  (titles from the operations registry; the unit test fails on an
  operation the remote MCP does not serve), and the docs: the package
  README, the catalog docs and, on a component page, its
  `/llms/components/<id>.md`.
- **Copy page is unchanged.** The docs-page "Copy page" button still copies
  its own text (title, `Source:` line, body); the twin of the same page has
  the header block instead.

## Ownership

| Concern | Files |
| --- | --- |
| Root index | `src/components/seo/llms-site.ts`, `scripts/generate-site-llms.ts`, `public/llms.txt`, `packages/tools/src/llms/site.ts` |
| Twins | `src/components/docs/integration.ts`, `src/components/docs/twins.ts` (allowlist, header block, rendition), `src/components/docs/twin-notes.ts`, `src/components/docs/markdown.ts`, `src/components/docs/markdown-negotiation.ts`, the head link in `src/components/seo/SeoHead.astro`, `scripts/check-md-parity.ts` |
| Discovery | `src/components/seo/agent-discovery.ts` (the typed source), `src/integrations/agent-discovery.ts`, `public/.well-known/ai-catalog.json`, `public/.well-known/mcp/server-card.json`, `src/integrations/skill-pack.ts`, `src/lib/mcp-limits.ts` (the MCP limits `/auth.md` states) |
| Robots | `src/components/seo/seo.ts` (`AI_CRAWLERS`, `buildRobots`), `src/lib/robots-variants.ts` |
| Edge | `functions/_middleware.ts`, `src/lib/md-negotiate.ts`, `src/lib/agent-request.ts`; the HTML `Vary: Accept` rule in `src/components/security/csp.ts` (`varyHeaderLine`) |
| Audits | `scripts/audit-aeo.mjs`, `scripts/check-llms-parity.ts` |

## Spec map

| Behavior | Pinned by |
| --- | --- |
| `/llms.txt` byte-equals the generator output | `scripts/tests/site-loaders.test.ts` |
| `/llms.txt` has a section per area; the built copy is a real file (not a redirect stub) and every link resolves | `apps/website/tests/site-build-guards.test.ts`; the AEO audit in `tests/e2e/site-seo.spec.ts` |
| Every built page but the allowlist has a twin with a valid header block, a head link and a manifest entry | `scripts/check-md-parity.ts --strict` after a build (CI website shard 1); `scripts/tests/check-md-parity.test.ts`; the AEO audit in `tests/e2e/site-seo.spec.ts` |
| Twin paths, the allowlist, the header block and its parser, the rendition (title, links, alt text, layout tables) and the "For agents" notes | `apps/website/tests/twins.test.ts` |
| `/index.md` and non-docs twins served, Accept negotiation on `/` and non-docs pages with `Vary`, the head link, the Markdown 404 | `tests/e2e/site-twins.spec.ts` (the real middleware in front of the built `dist`) |
| The Markdown rendition keeps content, drops controls and hidden text, and writes one separator row per table | `apps/website/tests/docs-reading.test.ts`, `apps/website/tests/edge-middleware.test.ts` |
| Component twin ids equal the llms component-doc ids | `scripts/tests/check-llms-parity.test.ts` |
| The `.well-known` files describe only real surfaces and the server card names exactly the shipped tools | `apps/website/tests/site-build-guards.test.ts` |
| The built `.well-known` files parse, their on-site URLs resolve and the skill digests match | the AEO audit in `tests/e2e/site-seo.spec.ts` |
| Negotiation decision table (every page path, `/` included), the middleware wrapper over a stubbed `ASSETS`, direct `.md` URLs, the untouched pass-through and the `_headers` `Vary: Accept` line | `apps/website/tests/edge-middleware.test.ts` |
| Agent classification, the Markdown 404 (hostile paths included) and problem JSON for `/api/` and JSON clients | `apps/website/tests/edge-middleware.test.ts` |
| Robots variant stripping, pinned against the shipped `buildRobots` output | `apps/website/tests/edge-middleware.test.ts` |
| Every discovery generator: paths, content types, fields, `scopes_supported: ["read"]`, `Link` syntax and the twin, `_headers` rules, security.txt `Expires`, the robots directives | `apps/website/tests/agent-discovery.test.ts` |
| The built discovery files and the headers `_headers` gives them, `Link` on `/` | `tests/e2e/site-agent-discovery.spec.ts` |
| The robots policy and the sitemap | `apps/website/tests/site-build-guards.test.ts`; the SEO audit in `tests/e2e/site-seo.spec.ts` |
| Offline audit of the whole surface (critical / warning / planned) | `scripts/tests/audit-aeo.test.ts`; real run below |
| Catalog ids, twins, llms docs and examples reconcile | `scripts/tests/check-llms-parity.test.ts` |

```bash
pnpm vitest run apps/website/tests/edge-middleware.test.ts apps/website/tests/twins.test.ts
pnpm build
pnpm exec tsx scripts/check-md-parity.ts --strict
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-seo.spec.ts tests/e2e/site-twins.spec.ts --project=chromium
pnpm exec tsx scripts/check-llms-parity.ts
```

The audit is plain Node over the built site:
`node scripts/audit-aeo.mjs --dist apps/website/dist`. Its T-30 run
reported `26 top routes, 187 twins, 4 .well-known files: 0 critical,
2 warning, 3 planned` (the two warnings are `/search/` and `/docs-shell/`,
left out of the nav-curated `llms.txt` by design).

## How to extend

- **A new site area:** add it to the nav source (`NAV_GROUPS`); give its
  section one factual line in `llms-site.ts`; run
  `pnpm exec tsx scripts/generate-site-llms.ts` and commit the new
  `public/llms.txt` (the spec fails on drift).
- **A new page** gets its twin automatically, docs or not. If it has a
  live demo, add its route to `TWIN_NOTES` (`twin-notes.ts`) with the
  operations and docs that do the same work. A route without content (an
  error document, a redirect) goes into `TWIN_EXEMPTIONS` with a reason,
  or the strict parity check fails.
- **A new `.well-known` entry:** every texuli.com URL in it must be a built
  path (the spec resolves them); describe only what ships.
- **A new AI crawler:** add it to `AI_CRAWLERS`; `isAgentRequest` and the
  audit's group count follow from the same list.
- **A non-standard robots directive:** add it to `buildRobots` and make
  sure `stripDirectivesForStrictParsers` removes it; extend the pinned
  unit test.

## Deviations and limits

- **No edge run is recorded.** `wrangler` is not a workspace dependency
  (adding it needs the owner), so the middleware is proven by unit tests
  over the exact `Request`/`Response`/`ASSETS` shapes, not by
  `wrangler pages dev` or a deployed origin. Whether Functions run for the
  texuli.com Pages project (root-directory override, Functions enabled) is
  an open owner question.
- **Static-only fallback.** If Functions do not run, every file above is
  still served as a plain static file: twins are fetchable at their `.md`
  URLs, agents get the HTML `404.html`, and every crawler gets the one
  robots file. Only negotiation, the Markdown 404 and the problem JSON, the
  `.md` content-type label and the robots variant are lost.
- **`_headers` is not checked at the edge locally.** The discovery spec
  serves `dist` with the generated exact-path rules applied, and asserts the
  `_headers` text; Cloudflare's own application of those rules is checked
  only after a deploy (the scan below).
- **security.txt expires.** `Expires` is one year after the build; a site
  not rebuilt for a year serves an expired file.
- **Planned:** reachability probes against the deployed origin. The audit
  reports them as `planned`, never as passing.

## Agent-readiness checklist (isitagentready.com)

Every non-commerce check of the isitagentready.com scanner (the 2026-10-30
baseline scored texuli.com level 1) and what answers it. **Status** says
what this repository ships; nothing here is verified against the deployed
site until a scan after the deploy of `main` (run
`curl -s -X POST https://isitagentready.com/api/scan -H "Content-Type: application/json" -d '{"url":"https://texuli.com"}'`).

| Check | Answered by | Status |
| --- | --- | --- |
| `robotsTxt` | `/robots.txt` (`buildRobots`) | Shipped (passed in the baseline) |
| `sitemap` | `/sitemap.xml` (SEO integration) | Shipped (passed in the baseline) |
| `linkHeaders` | `Link` on every HTML page in `dist/_headers` (`linkHeaderLine`): `api-catalog`, `service-desc` (only when `/openapi.json` is built), `describedby` (`/llms.txt`), `ai-catalog`, and `alternate` `text/markdown` where a twin is built | Shipped in this repo; `service-desc` waits for `openapi.json` (T-ar-api) |
| `dnsAid` | SVCB/HTTPS records under `_agents.texuli.com` with DNSSEC | Owner action (DNS); not in the repository |
| `markdownNegotiation` | The middleware's twin negotiation on every page path: `GET https://texuli.com` with `Accept: text/markdown` gets `/index.md` as `text/markdown; charset=utf-8` with `Vary: Accept` (T-ar-twins); every page has a twin and a head link | Shipped in this repo (answers the baseline's failed request); verified against the deployed site only by a scan after the deploy of `main` |
| `robotsTxtAiRules` | The 16 named `AI_CRAWLERS` groups | Shipped (passed in the baseline) |
| `contentSignals` | `Content-Signal: ai-train=yes, search=yes, ai-input=yes` in every robots group | Shipped |
| `webBotAuth` | `/.well-known/http-message-signatures-directory` | Not applicable: texuli.com sends no signed bot requests (informational check) |
| `apiCatalog` | `/.well-known/api-catalog`, generated, served as `application/linkset+json` | Shipped (the content type was wrong in the baseline) |
| `oauthDiscovery` | `/.well-known/oauth-authorization-server` (RFC 8414 stub; `jwks_uri` is an empty key set) | Shipped (honest stub: anonymous, read-only) |
| `oauthProtectedResource` | `/.well-known/oauth-protected-resource` (RFC 9728, no `.json`; `scopes_supported: ["read"]`) | Shipped (honest stub) |
| `authMd` | `/auth.md`, `text/markdown`: anonymous access, the MCP endpoint, its limits | Shipped |
| `mcpServerCard` | `/.well-known/mcp/server-card.json` | Shipped; its remote `serverUrl` is the surfaces-sync work |
| `a2aAgentCard` | `/.well-known/agent-card.json`: points at `https://texuli.com/mcp` with `protocolBinding: "MCP"`; skills are the operations the remote MCP serves (edge and site) | Shipped (a discovery pointer; Texuli runs no A2A agent) |
| `agentSkills` | `/.well-known/agent-skills/index.json` (skill-pack integration) | Shipped (passed in the baseline) |
| `webMcp` | Every `BaseLayout` page registers four read-only tools through `navigator.modelContext` (or `document.modelContext`): `texuli_search_docs` (`site.search` over same-origin `POST /mcp`), `texuli_read_page` (the page's twin), `texuli_get_component` (`/llms/components/<id>.md`) and `texuli_validate_blueprint` (`blueprint.validate` over `/mcp`). The layout's loader (206 B, 244 B gzip) checks for `modelContext` as it runs, before `DOMContentLoaded`; only then does it fetch the tools chunk (`src/lib/webmcp.ts`, 1,777 B gzip), which calls `provideContext`, else `registerTool` per tool. Other browsers download nothing more | Shipped in this repo (T-ar-site-mcp); `tests/e2e/site-webmcp.spec.ts` stubs `modelContext` before load and sees all four registered 7 to 13 ms after the `load` event on a local server (five runs; the chunk is requested before `DOMContentLoaded`, and a local `load` fires almost at once), the same class of timing as an island hydrated `client:load`. Verified against the scanner only by a scan after the deploy of `main` |
| `ard` | `/.well-known/ai-catalog.json` (CORS `*`, `rel="ai-catalog"` in every head and `Link`, `Agentmap` in robots) | Shipped |
| `personalAgentProtocol` | `/.well-known/poppy.json`: website-only discovery (`protocol_version`, `organization`, empty `web`) | Shipped; informational check. No sessions, sign-in or APIs are declared because none exist |
| `/.well-known/mcp` | Routed by the middleware to the remote MCP | Shipped (T-mcp-remote) |
| Commerce (`x402`, `mpp`, `ucp`, `acp`, `ap2`) | — | Not applicable: texuli.com sells nothing |

### Content-Signal ownership (owner runbook)

This repository owns the Content Signals: `CONTENT_SIGNALS` in
`src/components/seo/agent-discovery.ts` writes them into every robots group.
**Do not also enable Cloudflare's managed Content Signals (AI Crawl
Control) for texuli.com.** Managed signals prepend their own block, so
robots.txt would carry two policies for the same directive and each crawler
would resolve the conflict its own way. To change a signal, change the
constant and rebuild. If the managed setting is ever preferred, remove the
directive from `buildRobots` in the same change.

