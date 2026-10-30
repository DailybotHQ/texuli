# texuli.com agent surfaces (AEO)

**App:** `apps/website` + root `functions/`
**Tasks:** PLAN_006 T-22..T-28 (surfaces), T-30 (audit); PLAN_011
T-ar-discovery (discovery files and headers)
**Specs:** `tests/e2e/site-seo.spec.ts` runs the AEO audit on the built
`dist/`; `tests/e2e/site-agent-discovery.spec.ts` checks the discovery
files and headers on the built `dist/`; unit tests in `apps/website/tests/`
(edge logic, discovery files, `agent-discovery.test.ts`),
`scripts/tests/audit-aeo.test.ts`

## Purpose

texuli.com is written to be read by agents as well as people. This note
covers the files and edge behavior an agent finds first: a root
`llms.txt`, a Markdown twin beside every docs page, the `.well-known`
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
| `<page>.md` twins | One Markdown file beside every docs-class page (`isDocsPath`), plus `md-manifest.json` mapping page → twin | `src/components/docs/integration.ts` at build time: the exact "Copy page" text with root-relative links made absolute (`absolutizeMarkdownLinks`), so the twin and Copy page cannot disagree |
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
   only an explicit `text/markdown` Accept on a docs-class path: it fetches
   the twin from `env.ASSETS` with `content-type: text/markdown`,
   `Vary: Accept`, `X-Content-Negotiation: markdown` and the discovery
   `Link` (the twin is a Function response, so no `_headers` rule reaches
   it; `service-desc` is left to the API catalog). A wildcard Accept,
   the root and non-docs paths pass through; a missing twin falls through
   to the HTML pipeline instead of inventing a body.
3. **Agent-shaped 404s.** A 404 for a request `isAgentRequest`
   (`agent-request.ts`) classifies as an agent (named AI crawlers, generic
   crawler markers, plain HTTP clients) becomes `application/problem+json`
   from `agentProblem`: `type: about:blank`, the missed path as `instance`
   and `guide: <origin>/llms.txt`. Browsers and Lighthouse keep the static
   `404.html`.

Every other response is returned as the very object `context.next()` gave,
never a rebuilt copy: Cloudflare Pages applies `_headers` only to that
asset response, so a copy would drop the page CSP (PLAN_006 T-100 S-2). The
HTML of a negotiable docs page still declares `Vary: Accept`, matching its
twin, but the header now comes from the page's `_headers` rule:
`varyHeaderLine` in `src/components/security/csp.ts` adds it at build time
to every docs-class route that has a twin (see [site-csp.md](site-csp.md)).

## Ownership

| Concern | Files |
| --- | --- |
| Root index | `src/components/seo/llms-site.ts`, `scripts/generate-site-llms.ts`, `public/llms.txt`, `packages/tools/src/llms/site.ts` |
| Twins | `src/components/docs/integration.ts`, `src/components/docs/markdown.ts`, `src/components/docs/markdown-negotiation.ts` |
| Discovery | `src/components/seo/agent-discovery.ts` (the typed source), `src/integrations/agent-discovery.ts`, `public/.well-known/ai-catalog.json`, `public/.well-known/mcp/server-card.json`, `src/integrations/skill-pack.ts`, `src/lib/mcp-limits.ts` (the MCP limits `/auth.md` states) |
| Robots | `src/components/seo/seo.ts` (`AI_CRAWLERS`, `buildRobots`), `src/lib/robots-variants.ts` |
| Edge | `functions/_middleware.ts`, `src/lib/md-negotiate.ts`, `src/lib/agent-request.ts`; the HTML `Vary: Accept` rule in `src/components/security/csp.ts` (`varyHeaderLine`) |
| Audits | `scripts/audit-aeo.mjs`, `scripts/check-llms-parity.ts` |

## Spec map

| Behavior | Pinned by |
| --- | --- |
| `/llms.txt` byte-equals the generator output | `scripts/tests/site-loaders.test.ts` |
| `/llms.txt` has a section per area; the built copy is a real file (not a redirect stub) and every link resolves | `apps/website/tests/site-build-guards.test.ts`; the AEO audit in `tests/e2e/site-seo.spec.ts` |
| Every docs-class page has a twin and a manifest entry | the AEO audit in `tests/e2e/site-seo.spec.ts` |
| The Markdown rendition keeps content, drops controls and hidden text, and writes one separator row per table | `apps/website/tests/docs-reading.test.ts`, `apps/website/tests/edge-middleware.test.ts` |
| Component twin ids equal the llms component-doc ids | `scripts/tests/check-llms-parity.test.ts` |
| The `.well-known` files describe only real surfaces and the server card names exactly the shipped tools | `apps/website/tests/site-build-guards.test.ts` |
| The built `.well-known` files parse, their on-site URLs resolve and the skill digests match | the AEO audit in `tests/e2e/site-seo.spec.ts` |
| Negotiation decision table, the middleware wrapper over a stubbed `ASSETS`, the untouched pass-through and the `_headers` `Vary: Accept` line | `apps/website/tests/edge-middleware.test.ts` |
| Agent classification and problem JSON | `apps/website/tests/edge-middleware.test.ts` |
| Robots variant stripping, pinned against the shipped `buildRobots` output | `apps/website/tests/edge-middleware.test.ts` |
| Every discovery generator: paths, content types, fields, `scopes_supported: ["read"]`, `Link` syntax and the twin, `_headers` rules, security.txt `Expires`, the robots directives | `apps/website/tests/agent-discovery.test.ts` |
| The built discovery files and the headers `_headers` gives them, `Link` on `/` | `tests/e2e/site-agent-discovery.spec.ts` |
| The robots policy and the sitemap | `apps/website/tests/site-build-guards.test.ts`; the SEO audit in `tests/e2e/site-seo.spec.ts` |
| Offline audit of the whole surface (critical / warning / planned) | `scripts/tests/audit-aeo.test.ts`; real run below |
| Catalog ids, twins, llms docs and examples reconcile | `scripts/tests/check-llms-parity.test.ts` |

```bash
pnpm vitest run apps/website/tests/edge-middleware.test.ts
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-seo.spec.ts --project=chromium
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
- **A new docs page** gets its twin automatically when `isDocsPath` covers
  it; a page outside the docs shell needs an explicit decision there.
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
  robots file. Only negotiation, the problem JSON and the robots variant
  are lost.
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
| `markdownNegotiation` | The middleware's twin negotiation; the root `/` twin is T-ar-twins | Partial: docs pages only until T-ar-twins |
| `robotsTxtAiRules` | The 16 named `AI_CRAWLERS` groups | Shipped (passed in the baseline) |
| `contentSignals` | `Content-Signal: ai-train=yes, search=yes, ai-input=yes` in every robots group | Shipped |
| `webBotAuth` | `/.well-known/http-message-signatures-directory` | Not applicable: texuli.com sends no signed bot requests (informational check) |
| `apiCatalog` | `/.well-known/api-catalog`, generated, served as `application/linkset+json` | Shipped (the content type was wrong in the baseline) |
| `oauthDiscovery` | `/.well-known/oauth-authorization-server` (RFC 8414 stub; `jwks_uri` is an empty key set) | Shipped (honest stub: anonymous, read-only) |
| `oauthProtectedResource` | `/.well-known/oauth-protected-resource` (RFC 9728, no `.json`; `scopes_supported: ["read"]`) | Shipped (honest stub) |
| `authMd` | `/auth.md`, `text/markdown`: anonymous access, the MCP endpoint, its limits | Shipped |
| `mcpServerCard` | `/.well-known/mcp/server-card.json` | Shipped; its remote `serverUrl` is the surfaces-sync work |
| `a2aAgentCard` | `/.well-known/agent-card.json`: points at `https://texuli.com/mcp` with `protocolBinding: "MCP"`; skills are the edge operations | Shipped (a discovery pointer; Texuli runs no A2A agent) |
| `agentSkills` | `/.well-known/agent-skills/index.json` (skill-pack integration) | Shipped (passed in the baseline) |
| `webMcp` | Browser tools on page load | Planned (T-ar-site-mcp) |
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

