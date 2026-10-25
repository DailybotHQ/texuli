# Agent service: CSP report intake

**Status: built and tested locally. Nothing is deployed, and no production
build binds a report endpoint today.**

texuli.com sends every page an enforcing `Content-Security-Policy` and a
`Content-Security-Policy-Report-Only` copy that names the `texuli-csp`
reporting group (`apps/website/docs/site-csp.md`). This service can be the
place those reports land.

## Binding an endpoint (site build)

```bash
PUBLIC_TEXULI_CSP_REPORT_URL=https://<agent origin>/v1/csp-reports pnpm build
```

With the variable set to an `https:` URL (or `http://localhost` /
`127.0.0.1` for local development), the build:

- appends `report-uri <url>` to every report-only policy (the fallback for
  browsers without the Reporting API);
- adds `Reporting-Endpoints: texuli-csp="<url>"` to every route in
  `dist/_headers`;
- adds a `reporting` block (`group`, `endpoint`, `header`) to
  `dist/csp-manifest.json`, so any host can apply the same binding.

Unset (the default), the build binds nothing: report-only headers then send no
network reports, exactly as before. `pnpm --filter @texuli/website check:csp`
checks both shapes: the report-only policy must equal the enforcing policy
plus `report-to texuli-csp` and, when bound, `report-uri <url>`; and the header
must match the manifest.

## The intake (`POST /v1/csp-reports`)

`src/csp-reports.ts`, enabled when an adapter passes a `CspReportStore` to
`handleRequest` (the Node dev server and the edge worker both do).

- Accepts `application/reports+json` (Reporting API batches, `csp-violation`
  entries only, at most 20 per body) and `application/csp-report` (the legacy
  `report-uri` body). Bodies over 16 KiB get `413`, other types `415`,
  malformed JSON `400`, and accepted bodies `204` with no body.
- **Reduces every report before keeping it:** the directive, what was blocked
  (`inline`, `eval`, `data`, `blob` and similar keywords, or a bare origin,
  never a path or query), the page path without query or fragment, and the
  disposition. Script samples, full URLs, referrers, user agents and IPs are
  never stored. Reports come from any visitor's browser, so they are untrusted
  input.
- Counts per directive and blocked source, capped at 64 keys (the rest count as
  `other`), plus the last 20 reduced reports, in memory per worker instance.
  `GET /v1/health` reports `cspReports: { accepted, dropped }`.
- The kill switch and sessions do not apply: this is observability, not
  generation. The CORS origin check still does.

## Tests

- `apps/agent/tests/csp-reports.test.ts`: both body formats, the reduction
  (no query, fragment, sample or referrer survives), the limits and status
  codes, the bounded store, the route existing only with a store and past the
  kill switch, the origin check, and the site binding helpers.
- `tests/e2e/csp-report.spec.ts`: real browsers load pages with the site's
  report-only shape and an enforcing variant. The legacy `report-uri` delivery
  reaches `handleCspReport` end to end; an enforcing violation is both blocked
  and reported; and the site-shaped policy raises a report-only violation
  without blocking.

## Not covered, or planned

- **Reporting API delivery is not observed end to end.** With `report-to`
  present, Chromium ignores `report-uri` and queues the report for the
  Reporting API, and headless Chromium under Playwright did not deliver it
  within 75 seconds (probed 2026-10-25). The Reporting API body format is
  covered by unit tests only.
- WebKit is not verified on this host in this run (the browser failed to
  launch), and Firefox is not in the matrix.
- **Planned:** durable aggregation across worker isolates, a rate limit per
  source, and an operator view of the counts.
