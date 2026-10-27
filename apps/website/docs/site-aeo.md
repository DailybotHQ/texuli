# texuli.com agent surfaces (AEO)

**App:** `apps/website` + root `functions/`
**Tasks:** PLAN_006 T-22..T-28 (surfaces), T-30 (audit)
**Specs:** `tests/e2e/site-aeo.spec.ts` (built `dist/`), unit tests in
`apps/website/tests/` (edge logic), `scripts/tests/audit-aeo.test.ts`

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
| `<page>.md` twins | One Markdown file beside every docs-class page (`isDocsPath`), plus `md-manifest.json` mapping page → twin | `src/components/docs/integration.ts` at build time: the exact "Copy page" text with root-relative links made absolute (`absolutizeMarkdownLinks`), so the twin and Copy page cannot disagree |
| `/.well-known/ai-catalog.json`, `/.well-known/api-catalog`, `/.well-known/mcp/server-card.json` | The ARD catalog, the RFC 9727 linkset and the card for the tools package's **local stdio** MCP server (five read-only tools, no hosted endpoint) | Committed under `apps/website/public/.well-known/` |
| `/.well-known/agent-skills/index.json`, `/skill-pack/` | The skill pack copied into the build and indexed with the SHA-256 of each served `SKILL.md` | Generated at build by `src/integrations/skill-pack.ts`, so digests cannot drift |
| `/robots.txt` | Allow-all default, `Sitemap:` line, an explicit `Allow: /` group for each of the 16 `AI_CRAWLERS`, no `Disallow` | `buildRobots` in `src/components/seo/seo.ts`, written by the SEO integration; there is no `public/robots.txt` |

### The middleware (`functions/_middleware.ts`)

Cloudflare Pages Functions from the repository root. The site itself stays
`output: 'static'`; the middleware imports pure decision modules from
`apps/website/src/lib/` and does three things, in order:

1. **Strict-parser robots.** For Lighthouse-family user agents
   (`isStrictParserAudit`) it serves `/robots.txt` through
   `stripDirectivesForStrictParsers` (`robots-variants.ts`). The shipped
   policy has no non-standard directives today, so the variant is
   byte-identical; the machinery waits for `Content-Signal` or `Agentmap`
   lines.
2. **Markdown negotiation.** `negotiateTwin` (`md-negotiate.ts`) answers
   only an explicit `text/markdown` Accept on a docs-class path: it fetches
   the twin from `env.ASSETS` with `content-type: text/markdown`,
   `Vary: Accept` and `X-Content-Negotiation: markdown`. A wildcard Accept,
   the root and non-docs paths pass through; a missing twin falls through
   to the HTML pipeline instead of inventing a body.
3. **Agent-shaped 404s.** A 404 for a request `isAgentRequest`
   (`agent-request.ts`) classifies as an agent (named AI crawlers, generic
   crawler markers, plain HTTP clients) becomes `application/problem+json`
   from `agentProblem`: `type: about:blank`, the missed path as `instance`
   and `guide: <origin>/llms.txt`. Browsers and Lighthouse keep the static
   `404.html`.

## Ownership

| Concern | Files |
| --- | --- |
| Root index | `src/components/seo/llms-site.ts`, `scripts/generate-site-llms.ts`, `public/llms.txt`, `packages/tools/src/llms/site.ts` |
| Twins | `src/components/docs/integration.ts`, `src/components/docs/markdown.ts`, `src/components/docs/markdown-negotiation.ts` |
| Discovery | `public/.well-known/**`, `src/integrations/skill-pack.ts` |
| Robots | `src/components/seo/seo.ts` (`AI_CRAWLERS`, `buildRobots`), `src/lib/robots-variants.ts` |
| Edge | `functions/_middleware.ts`, `src/lib/md-negotiate.ts`, `src/lib/agent-request.ts` |
| Audits | `scripts/audit-aeo.mjs`, `scripts/check-llms-parity.ts` |

## Spec map

| Behavior | Pinned by |
| --- | --- |
| `/llms.txt` is a physical `text/plain` file that byte-equals the generator output; every area has a section; every link resolves | `tests/e2e/site-aeo.spec.ts` |
| Every docs-class page has a twin; the manifest matches; sampled twins are well-formed Markdown with absolute links; component twin ids equal the llms component-doc ids | `tests/e2e/site-aeo.spec.ts` |
| The `.well-known` files parse, their on-site URLs resolve, the server card names exactly the shipped tools, the skill digests match | `tests/e2e/site-aeo.spec.ts` |
| Negotiation decision table and the middleware wrapper over a stubbed `ASSETS` | `apps/website/tests/md-negotiate.test.ts`, `apps/website/tests/markdown-negotiation.test.ts` |
| Agent classification and problem JSON | `apps/website/tests/agent-request.test.ts` |
| Robots variant stripping, pinned against the shipped `buildRobots` output | `apps/website/tests/robots-variants.test.ts` |
| The robots policy and the sitemap | `tests/e2e/site-seo.spec.ts` |
| Offline audit of the whole surface (critical / warning / planned) | `scripts/tests/audit-aeo.test.ts`; real run below |
| Catalog ids, twins, llms docs and examples reconcile | `scripts/tests/check-llms-parity.test.ts` |

```bash
pnpm vitest run apps/website/tests/md-negotiate.test.ts apps/website/tests/agent-request.test.ts apps/website/tests/robots-variants.test.ts
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-aeo.spec.ts --project=chromium
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
- **No root `llms-full.txt`.** The catalog's `/llms/llms-full.txt` holds
  the full component text; per-page twins are the whole-site unit.
- **Planned:** `Content-Signal` and `Agentmap` directives, the
  `Access-Control-Allow-Origin: *` header on the ARD, and reachability
  probes against the deployed origin. The audit reports these as
  `planned`, never as passing.
