/// <reference types="node" />
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import {
  type CspReportStore,
  createCspReportStore,
  handleCspReport,
} from '../../apps/agent/src/csp-reports.ts';
import {
  reportingEndpointsHeader,
  reportOnlyPolicy,
} from '../../apps/website/src/components/security/csp.ts';

/**
 * CSP report-only observability end to end (Task 82): a real browser loads a
 * page carrying the site's report-only shape (`report-to texuli-csp` plus
 * `report-uri` and a `Reporting-Endpoints` binding, as a build with
 * `PUBLIC_TEXULI_CSP_REPORT_URL` emits them), violates the policy, and the
 * agent service's intake (`handleCspReport`) receives the report and keeps
 * only reduced fields. A second page enforces the same policy and must both
 * block and report.
 *
 * Delivery paths: with `report-to` present, Chromium ignores `report-uri` and
 * queues the report for the Reporting API, which headless Chromium under
 * Playwright did not deliver within 75 s when probed (2026-10-25). So the
 * site-shaped page asserts the browser raised a report-only violation, and a
 * legacy page (`report-uri` only, what browsers without the Reporting API
 * use) asserts end-to-end delivery. Parsing of the Reporting API format is
 * covered by apps/agent/tests/csp-reports.test.ts.
 */

let server: Server;
let origin = '';
let store: CspReportStore;

const BASE = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'";
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CSP report probe</title>
<style>#probe { color: rgb(255, 0, 0); }</style></head>
<body><p id="probe">Report probe</p></body></html>`;

async function bodyOf(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

test.beforeAll(async () => {
  store = createCspReportStore();
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', origin || 'http://127.0.0.1');
    if (url.pathname === '/v1/csp-reports' && request.method === 'POST') {
      const answer = await handleCspReport(
        new Request(url, {
          method: 'POST',
          headers: { 'content-type': request.headers['content-type'] ?? '' },
          body: new Uint8Array(await bodyOf(request)),
        }),
        store
      );
      response.writeHead(answer.status).end();
      return;
    }
    const endpoint = `${origin}/v1/csp-reports`;
    const headers: Record<string, string> = {
      'content-type': 'text/html; charset=utf-8',
      'reporting-endpoints': reportingEndpointsHeader(endpoint),
    };
    if (url.pathname === '/report-only') {
      headers['content-security-policy-report-only'] = reportOnlyPolicy(BASE, endpoint);
    } else if (url.pathname === '/report-only-legacy') {
      headers['content-security-policy-report-only'] = `${BASE}; report-uri ${endpoint}`;
    } else if (url.pathname === '/enforced') {
      headers['content-security-policy'] = `${BASE}; report-uri ${endpoint}`;
    } else {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, headers).end(PAGE);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>((done) => server.close(() => done())));

async function reportsFor(page: string, timeout = 20_000) {
  await expect
    .poll(() => store.snapshot().recent.filter((report) => report.page === page).length, {
      timeout,
    })
    .toBeGreaterThan(0);
  return store.snapshot().recent.filter((report) => report.page === page);
}

test.describe('csp · report-only observability', () => {
  test('the site-shaped report-only policy raises a report-only violation and never blocks', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const seen: { directive: string; disposition: string }[] = [];
      (window as unknown as { __violations: typeof seen }).__violations = seen;
      document.addEventListener('securitypolicyviolation', (event) => {
        seen.push({ directive: event.effectiveDirective, disposition: event.disposition });
      });
    });
    await page.goto(`${origin}/report-only`);
    await expect(page.locator('#probe')).toHaveCSS('color', 'rgb(255, 0, 0)');
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __violations: { disposition: string }[] }).__violations
        )
      )
      .toContainEqual(expect.objectContaining({ disposition: 'report' }));
  });

  test('a report-only violation is delivered to the intake, reduced, and never blocks', async ({
    page,
  }) => {
    await page.goto(`${origin}/report-only-legacy?session=fictional-secret#frag`);
    // Report-only never enforces: the inline style still applies.
    await expect(page.locator('#probe')).toHaveCSS('color', 'rgb(255, 0, 0)');
    const reports = await reportsFor('/report-only-legacy');
    expect(reports[0]).toMatchObject({ blocked: 'inline' });
    expect(reports[0]?.directive).toMatch(/^style-src(-elem)?$/);
    // Only the reduced fields are kept: no query, fragment or sample.
    expect(JSON.stringify(store.snapshot())).not.toMatch(/fictional-secret|frag|255/);
  });

  test('the enforcing policy blocks the same violation and reports it', async ({
    page,
    browserName,
  }) => {
    await page.goto(`${origin}/enforced`);
    await expect(page.locator('#probe')).not.toHaveCSS('color', 'rgb(255, 0, 0)');
    const reports = await reportsFor('/enforced');
    expect(reports[0]).toMatchObject({ blocked: 'inline' });
    // WebKit's legacy report body has no disposition field; Chromium's does.
    if (browserName === 'chromium') expect(reports[0]?.disposition).toBe('enforce');
  });
});
