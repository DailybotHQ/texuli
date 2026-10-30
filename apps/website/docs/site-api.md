# texuli.com public API and developer portal

PLAN_011 T-ar-api. **Status:** in development on `release/0.9.0`; live on
texuli.com once 0.9.0 is published and deployed from `main`
(`API_RELEASE_STATUS` in `src/lib/api-surface.ts` is the one switch the
release flips).

## Purpose

A described, versioned, read-only JSON API over the files texuli.com
already builds, so agents and programs can call the site the way the
is-agentic and isitagentready audits expect: reachable endpoints, an
OpenAPI document with an operationId and a typed schema on every operation,
versioning with a deprecation policy, rate-limit headers, a typed error
model, a developer portal and a CLI.

## What ships

| Path | What it is | How it is produced |
| --- | --- | --- |
| `/api/v1/index.json`, `/api/index.json` | The version, limits, versioning policy and every endpoint with its operationId | `buildApiIndex` (`src/lib/openapi.ts`), written by `src/integrations/api-surface.ts` |
| `/api/v1/health.json`, `/api/health.json` | `status`, release line, build time. A static file: it proves the build is served, not that a Function runs | `buildHealth`, written at build |
| `/api/v1/catalog.json` | Same bytes as `/catalog/catalog.json` | Copied at build (`aliasCopies`) |
| `/api/v1/themes.json`, `/api/v1/themes-dark.json`, `/api/v1/theme-gallery.json` | Same bytes as `/theme-catalog.json`, `/theme-catalog-dark.json`, `/theme-gallery.json` | Copied at build |
| `/api/v1/themes/{id}.json` | Same bytes as `/theme-data/{id}.json`, one per library theme | Copied at build |
| `/api/v1/twins.json` | Same bytes as `/md-manifest.json` (page → Markdown twin) | Copied at build, after the twins integration writes the manifest |
| `/openapi.json` | OpenAPI 3.1: every path above, the unversioned site files and `POST /mcp` | `buildOpenApi`, written at build and checked by `checkOpenApi` (the build fails on a duplicate operationId, an unresolved `$ref` or a described path that is not built) |
| `/developers/` | The portal: endpoints, MCP (remote and `npx -y @texuli/mcp`), the CLI, files for agents, limits, errors, versioning, access, license; WebAPI JSON-LD | `src/pages/developers/index.astro` over `src/components/developers/developers.ts`; Markdown twin `/developers.md` |

Every list and number on these surfaces comes from a typed source:
`API_RESOURCES`, `API_RATE_LIMIT`, `API_VERSION` and the problem builder in
`src/lib/api-surface.ts`; the MCP limits in `src/lib/mcp-limits.ts`; the
MCP tools from the `@texuli/tools` operations registry (every operation
whose runtime is not `node`, so a new `edge` or `site` operation appears in
`/openapi.json` with its input and output schemas without an edit here);
the MCP page data (`mcp-server-data.ts`, `pnpm check:surfaces`).

`API_VERSION` (`X-API-Version`, the OpenAPI `info.version`) is the release
line. It is a plain constant because the edge middleware cannot import the
registry; `apps/website/tests/site-api.test.ts` fails when it differs from
`TOOLS_VERSION`.

## Headers: Function or `_headers`

| Header or behavior | Delivered by | Without Functions |
| --- | --- | --- |
| `X-API-Version`, `Access-Control-Allow-Origin: *`, `Access-Control-Expose-Headers`, `X-Content-Type-Options`, `Cache-Control` | The middleware (`functions/_lib/api-endpoint.ts`) on every `/api/` answer, and the `/api/*` rule in `dist/_headers` (`apiHeaderRules`) | Still sent: Cloudflare applies the `_headers` rule to the static file |
| `RateLimit-Policy: "api";q=300;w=60`, `RateLimit`, `429` with `Retry-After` | The middleware: the same per-isolate token bucket as the remote MCP (`createTokenBucket` in `functions/_lib/mcp-endpoint.ts`), keyed by `CF-Connecting-IP` | Not sent: a static rule cannot count requests |
| RFC 9457 `application/problem+json` for misses (`404`), writes (`405` with `Allow`) and failures (`500`), for every client | The middleware | A miss gets the static HTML 404 page |
| `/api/` and `/api/v1/` answer the index | The middleware (`apiAssetPath`) | Not answered; request the `index.json` file |
| `Content-Type: application/json; charset=utf-8` | The middleware; `/openapi.json` also from its `_headers` rule | Cloudflare infers `application/json` from `.json` |
| `Link: </openapi.json>; rel="service-desc"` on every HTML page and Markdown twin | `linkHeaderLine` in `_headers` (every build now writes `/openapi.json`) and the middleware's twin `Link` | Pages keep it (`_headers`) |

The middleware builds the `/api/` response itself, so the `_headers` rule
does not reach it (SECURITY S-2); the envelope therefore sets every header
of the static rule too. `/api/umami/…` (the analytics proxy Function) is
excluded (`FUNCTION_API_PREFIXES`).

## Error model

```json
{
  "type": "https://texuli.com/developers/#errors",
  "title": "Not Found",
  "status": 404,
  "detail": "No API resource exists at /api/v1/no-such-file.json.",
  "instance": "/api/v1/no-such-file.json",
  "error": {
    "code": "resource_not_found",
    "message": "No API resource exists at /api/v1/no-such-file.json.",
    "hint": "Fetch https://texuli.com/api/v1/index.json for every endpoint, …",
    "documentation_url": "https://texuli.com/developers/"
  }
}
```

Codes are stable: `resource_not_found`, `method_not_allowed`,
`rate_limited`, `internal_error`. The `instance` echoes the client's path
without control characters, capped at 200 characters. The OpenAPI
`Problem` schema requires exactly these members (pinned by the unit test).
Misses of the unversioned site files keep the middleware's agent 404
(`SiteProblem` in the document: `type: about:blank`, the `llms.txt`
guide), and only for agents and JSON clients; browsers get the HTML page.

## Versioning and deprecation

Paths under `/api/v1/` only change additively (new endpoints, new optional
fields). A breaking change ships under `/api/v2/`, and `/api/v1/` keeps
serving for at least one release line (0.x minor) after that, with
`Deprecation` (RFC 9745) and `Sunset` (RFC 8594) on every affected
response. No endpoint is deprecated today. The unversioned paths are the
files the site's own pages fetch: they follow the site and may change in
any release. The same text is `API_VERSIONING.policy`, stated by the index,
the OpenAPI `x-versioning` block and the portal.

## Discovery

- `/.well-known/api-catalog` links `service-desc` (`/openapi.json`),
  `service-doc` (`/developers/`), `status` (`/api/health.json`) and the API
  index.
- `/.well-known/ai-catalog.json` is now generated from the typed source
  (`aiCatalog` in `src/components/seo/agent-discovery.ts`) instead of a
  committed file, and lists the OpenAPI document and the npm packages
  `texuli`, `@texuli/mcp` and `@texuli/tools`
  (`application/vnd.npm.package+json`).
- `/auth.md` states the `/api/` limit next to the MCP's.
- `llms.txt` lists the OpenAPI document and the API index.

## Spec map

| Behavior | Pinned by |
| --- | --- |
| Version equals the registry's; alias copies; the `/api` route and the umami exclusion; problems and hostile `instance`; `_headers` rules | `apps/website/tests/site-api.test.ts` |
| The OpenAPI document: 3.1, version, license, server, unique operationIds, `$ref`s resolve, every resource and alias plus `POST /mcp`, headers and the `Problem` schema, a new remote operation appears, the checker's failure cases | `apps/website/tests/site-api.test.ts` |
| The envelope: 200 headers, HEAD, 304, directory URLs, 404/405/500 problems, preflight, the 429 with `Retry-After` per client; the middleware route | `apps/website/tests/site-api.test.ts`, `apps/website/tests/edge-middleware.test.ts` |
| ARD npm entries, API catalog links, WebAPI JSON-LD | `apps/website/tests/site-api.test.ts`, `apps/website/tests/site-build-guards.test.ts` |
| The portal in the browser (facts, axe light and dark, every link), `/openapi.json` against `dist`, `/api/v1/` through the real middleware, the static `_headers` fallback, the built ARD | `tests/e2e/site-developers.spec.ts` |

```bash
pnpm vitest run apps/website/tests/site-api.test.ts
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-developers.spec.ts --project chromium
```

## Limits and open points

- The rate limit is best-effort: each isolate counts on its own, and
  clients behind one address share a bucket. The optional Cloudflare WAF
  rule in [SECURITY section 23](../../../docs/SECURITY.md#23-public-json-api-api)
  is the durable layer, owner-held.
- Nothing here has run on Cloudflare yet. After the deploy, check
  `curl -sI https://texuli.com/api/v1/health.json` for `X-API-Version` and
  `RateLimit-Policy`, and a miss for `application/problem+json`.
- The `/api/v1/` copies add about 7 MB of theme files to the build (one
  copy of each `/theme-data/` file).
- Design-system manifests are not served yet; they join `API_RESOURCES`
  when their files exist.
