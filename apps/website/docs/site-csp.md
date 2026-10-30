# Built-site Content Security Policy

The static build generates two artifacts after every page has finished
rendering, and every artifact is proven by a check over the built output:

- `dist/_headers` — Cloudflare Pages shape: one enforcing
  `Content-Security-Policy` and one `Content-Security-Policy-Report-Only`
  header per route, plus `Vary: Accept` on every route whose Markdown twin
  was built, which is every page but the 404 (`varyHeaderLine`; see
  [site-aeo.md](site-aeo.md)).
- `dist/csp-manifest.json` — host-neutral: the same routes and policy
  strings as data (versioned JSON, sorted routes, no timestamps), so any
  static host or proxy can emit the headers without re-parsing HTML.

Each HTML route's policy carries the SHA-256 hashes of exactly its finished
inline scripts, style elements and server-rendered style attributes —
including Astro's island boot code. The report-only variant is the enforcing
policy plus `report-to texuli-csp`. Both policies exclude `unsafe-inline`
and `unsafe-eval`, restrict connections to the site origin (plus the
configured agent service origin on the agent chat page only), and require
Trusted Types for script sinks. Both the directory URL (`/docs/`) and the
direct file URL (`/docs/index.html`) are covered.

## The proof

After `pnpm --filter @texuli/website build`, run:

```bash
pnpm --filter @texuli/website check:csp
```

`tests/csp-coverage.mts` re-parses every built page with its own scanner
(independent of the integration's code), recomputes every hash, and exits
non-zero unless: every inline script, style and style attribute on every
built page is covered by that route's policy; `_headers` and
`csp-manifest.json` agree page for page; report-only is enforcing plus
`report-to`; and no `script-src`/`style-src` allows `unsafe-inline`,
`unsafe-eval` or misplaced `unsafe-hashes`. On 2026-10-25 it proved 521
pages, 2 492 script, 10 487 style and 862 attribute hashes covered.

The browser side (hydration under the real headers, violation observers,
Trusted Types enforcement) is proven separately by `tests/e2e/csp.spec.ts`.
`tests/e2e/analytics.spec.ts` checks every route's `trusted-types`
against its HTML (the analytics name appears only where the loader is
mounted). On an analytics fixture build it also loads the tracker under the
enforced headers with zero violations (see
[site-analytics.md](site-analytics.md#verification-commands)). The policy
units are `apps/website/tests/site-build-guards.test.ts`.

## Host application contract

The artifacts are response-header source data; the host must send them.
Until a host applies them, the CSP exists only in `dist/`.

- **Cloudflare Pages** (the shape `_headers` targets): deploy `dist/` as-is;
  the file is native to that host. Pages applies `_headers` only to the
  asset response, so `functions/_middleware.ts` returns every pass-through
  response untouched: a middleware that rebuilt the HTML response (as an
  earlier version did to add `Vary`) would serve the page without its CSP.
- **Any other static host or CDN**: read `csp-manifest.json` and configure
  the host to send, for every route in `pages`, the two header values
  verbatim:

  ```
  Content-Security-Policy: <page.enforcing>
  Content-Security-Policy-Report-Only: <page.reportOnly>
  ```

  Values are byte-exact policy strings — do not rewrap, sort or re-quote
  them. For example, nginx serves them from a `map` on `$uri` plus
  `add_header` on HTML locations; Apache uses `mod_headers` with
  `Header set` per `<LocationMatch>`; Netlify accepts the same `_headers`
  file. Exact-match entries (`/`, `/docs/`) must win over prefix matches so
  a page never receives another page's hashes.

Requirements a host configuration must meet, whatever the mechanism:

1. Both headers on every HTML document response, including requests served
   through `/route/` and `/route/index.html`.
2. The policy string for that exact route — hashes are per page.
3. No header on non-HTML assets is required (the policy governs documents).
4. `csp-manifest.json` carries only the two CSP values; a host that also
   negotiates Markdown twins sends `Vary: Accept` on those pages itself.

`astro preview` and `astro dev` do not apply either artifact; they serve
without CSP. Verify on a host that sends the headers (or a local static
server configured from the manifest) before trusting a preview.

## What each directive covers

| Directive | Covers |
| --- | --- |
| `default-src 'none'` | Deny-by-default for everything not named below |
| `script-src 'self' + hashes` | Same-origin scripts and every inline script, including island boot code; a one-character change needs a new hash |
| `style-src 'self' + hashes` | Same-origin stylesheets and every inline `<style>` element |
| `style-src-attr 'unsafe-hashes' + hashes` | The generated `style="…"` attributes; `unsafe-hashes` here allows exactly those static values and no live style mutation |
| `img-src` / `media-src` | Same origin plus `data:`, `blob:` and the fictional example origins the components document |
| `font-src`, `manifest-src`, `connect-src`, `worker-src`, `frame-src` | Same origin only |
| `object-src 'none'`, `base-uri 'none'` | No plugins, no base-tag hijack |
| `form-action 'self'` | Submissions stay on-site |
| `require-trusted-types-for 'script'` + `trusted-types svelte-trusted-html` | DOM sink injection requires the single allow-listed policy |
| `trusted-types … texuli-analytics` (analytics pages only) | Added only on a page whose HTML mounts the Umami loader tag (`<script … data-umami-loader>`), so a build without `PUBLIC_UMAMI_WEBSITE_ID` keeps exactly `trusted-types svelte-trusted-html`. `public/umami-loader.js` creates the policy, and its `createScriptURL` returns only the one configured script URL (throwing for any other). Nothing else is broadened: `script-src` stays `'self'` + hashes |

## What is not covered

- The `texuli-csp` reporting group has no endpoint binding in a default
  build, so report-only headers send no network reports; observe them through
  browser `securitypolicyviolation` events instead. A build can bind one with
  `PUBLIC_TEXULI_CSP_REPORT_URL` (it adds `report-uri`, a
  `Reporting-Endpoints` header and a manifest `reporting` block), and the
  agent service's `POST /v1/csp-reports` can receive the reports: see
  [apps/agent/docs/csp-reports.md](../../agent/docs/csp-reports.md). Binding
  one in production is a separate developer decision.
- No nonces: the policy is per-build. Hand-editing `dist/` after a build
  invalidates coverage (and `check:csp` fails on a rebuilt, edited site).
- A host that cannot set response headers cannot apply this policy; per-page
  `<meta http-equiv>` tags are deliberately not used (they pushed pages over
  their fixed page-weight budgets).
- The agent service origin is allowed only when a build sets
  `PUBLIC_TEXULI_AGENT_URL`, and only in the agent chat page's
  `connect-src` (`agentConnectSources`); production builds set none today.

Before any deployment, confirm the chosen host supports one of the two
artifacts or translate the manifest into that host's configuration, then
verify both response headers and island behavior on the deployed preview.
texuli.com deploys from `main` to Cloudflare Pages, which applies
`dist/_headers`; re-verify both on the deployed origin after any CSP change.
