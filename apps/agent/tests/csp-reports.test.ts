import { describe, expect, it } from 'vitest';
import {
  buildCspManifest,
  cspReportEndpoint,
  reportingEndpointsHeader,
  reportOnlyPolicy,
} from '../../website/src/components/security/csp.ts';
import {
  createCspReportStore,
  handleCspReport,
  MAX_CSP_REPORT_BYTES,
  MAX_REPORTS_PER_BODY,
  parseCspReports,
} from '../src/csp-reports.ts';
import { handleRequest } from '../src/http.ts';
import { service } from './helpers.ts';

/*
 * Task 82: CSP report-only observability. Reports come from any visitor's
 * browser, so they are untrusted and reduced to low-cardinality fields.
 */

const legacy = (report: Record<string, unknown>) => JSON.stringify({ 'csp-report': report });
const reportingApi = (bodies: Record<string, unknown>[]) =>
  JSON.stringify(
    bodies.map((body) => ({
      type: 'csp-violation',
      age: 3,
      url: 'https://texuli.example/docs/?q=private#frag',
      user_agent: 'Fictional/1.0',
      body,
    }))
  );
const post = (body: string, type: string, origin?: string) =>
  new Request('https://agent.example/v1/csp-reports', {
    method: 'POST',
    headers: { 'content-type': type, ...(origin ? { origin } : {}) },
    body,
  });

describe('parsing and reduction', () => {
  it('reduces a legacy report-uri body to directive, blocked keyword or origin, path and disposition', () => {
    const parsed = parseCspReports(
      'application/csp-report',
      legacy({
        'document-uri': 'https://texuli.example/agent-chat/?session=secret-token#x',
        'violated-directive': 'style-src-elem',
        'effective-directive': 'style-src-elem',
        'blocked-uri': 'inline',
        'script-sample': 'body{color:red}',
        disposition: 'report',
        referrer: 'https://referrer.example/private',
      })
    );
    expect(parsed).toEqual({
      ok: true,
      skipped: 0,
      violations: [
        {
          directive: 'style-src-elem',
          blocked: 'inline',
          page: '/agent-chat/',
          disposition: 'report',
        },
      ],
    });
    expect(JSON.stringify(parsed)).not.toMatch(/secret-token|color:red|referrer/);
  });

  it('keeps only the origin of a blocked URL and maps data/blob/eval keywords', () => {
    const blocked = (value: string) =>
      parseCspReports(
        'application/csp-report',
        legacy({ 'effective-directive': 'img-src', 'blocked-uri': value })
      );
    const of = (value: string) => {
      const result = blocked(value);
      return result.ok ? result.violations[0]?.blocked : null;
    };
    expect(of('https://tracker.example/pixel.gif?id=42')).toBe('https://tracker.example');
    expect(of('data:image/png;base64,AAAA')).toBe('data');
    expect(of('blob:https://texuli.example/1234')).toBe('blob');
    expect(of('eval')).toBe('eval');
    expect(of('javascript:alert(1)')).toBe('other');
  });

  it('reads Reporting API batches, skipping other report types and capping the batch', () => {
    const body = {
      effectiveDirective: 'script-src-elem',
      blockedURL: 'inline',
      disposition: 'enforce',
    };
    const raw = JSON.parse(reportingApi([body, body])) as unknown[];
    raw.push({ type: 'deprecation', body: { id: 'x' } });
    const parsed = parseCspReports('application/reports+json', JSON.stringify(raw));
    expect(parsed).toMatchObject({ ok: true, skipped: 1 });
    if (parsed.ok) {
      expect(parsed.violations).toEqual([
        { directive: 'script-src-elem', blocked: 'inline', page: '/docs/', disposition: 'enforce' },
        { directive: 'script-src-elem', blocked: 'inline', page: '/docs/', disposition: 'enforce' },
      ]);
    }
    const many = parseCspReports(
      'application/reports+json',
      reportingApi(Array.from({ length: MAX_REPORTS_PER_BODY + 5 }, () => body))
    );
    expect(many).toMatchObject({ ok: true, skipped: 5 });
  });

  it('refuses other content types and malformed bodies, and sanitizes odd fields', () => {
    expect(parseCspReports('text/plain', '{}')).toEqual({ ok: false, reason: 'unsupported-type' });
    expect(parseCspReports('application/csp-report', '{nope')).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(parseCspReports('application/csp-report', '{"other":1}')).toEqual({
      ok: false,
      reason: 'malformed',
    });
    const odd = parseCspReports(
      'application/csp-report',
      legacy({ 'effective-directive': '<script>', 'document-uri': 'not a url', 'blocked-uri': 7 })
    );
    expect(odd).toMatchObject({
      ok: true,
      violations: [{ directive: 'other', page: '/', blocked: 'other', disposition: 'report' }],
    });
  });
});

describe('store and handler', () => {
  it('counts per directive and blocked source with bounded keys and history', () => {
    const store = createCspReportStore({ maxKeys: 2, recent: 2 });
    for (const blocked of ['inline', 'inline', 'eval', 'https://a.example']) {
      store.record({ directive: 'script-src', blocked, page: '/', disposition: 'report' });
    }
    expect(store.snapshot()).toMatchObject({
      accepted: 4,
      byViolation: { 'script-src inline': 2, 'script-src eval': 1, other: 1 },
    });
    expect(store.snapshot().recent).toHaveLength(2);
  });

  it('answers 204, 413, 415 and 400 and never echoes the report', async () => {
    const store = createCspReportStore();
    const ok = await handleCspReport(
      post(
        legacy({ 'effective-directive': 'style-src', 'blocked-uri': 'inline' }),
        'application/csp-report'
      ),
      store
    );
    expect(ok.status).toBe(204);
    expect(await ok.text()).toBe('');
    const huge = await handleCspReport(
      post('x'.repeat(MAX_CSP_REPORT_BYTES + 1), 'application/csp-report'),
      store
    );
    expect(huge.status).toBe(413);
    expect((await handleCspReport(post('{}', 'text/plain'), store)).status).toBe(415);
    expect((await handleCspReport(post('{', 'application/csp-report'), store)).status).toBe(400);
    expect(store.snapshot()).toMatchObject({ accepted: 1, dropped: 3 });
  });

  it('routes POST /v1/csp-reports only when a store is configured, past the kill switch', async () => {
    const off = service({ enabled: () => false });
    const body = legacy({ 'effective-directive': 'style-src-attr', 'blocked-uri': 'inline' });
    expect(
      (await handleRequest(post(body, 'application/csp-report'), { service: off })).status
    ).toBe(404);
    const cspReports = createCspReportStore();
    const res = await handleRequest(
      post(body, 'application/csp-report', 'https://texuli.example'),
      {
        service: off,
        allowedOrigin: 'https://texuli.example',
        cspReports,
      }
    );
    expect(res.status).toBe(204);
    expect(
      (
        await handleRequest(post(body, 'application/csp-report', 'https://evil.example'), {
          service: off,
          allowedOrigin: 'https://texuli.example',
          cspReports,
        })
      ).status
    ).toBe(403);
    const health = await (
      await handleRequest(new Request('https://agent.example/v1/health'), {
        service: off,
        cspReports,
      })
    ).json();
    expect(health.cspReports).toEqual({ accepted: 1, dropped: 0 });
  });
});

describe('site report binding', () => {
  it('binds nothing by default and only safe endpoints when configured', () => {
    expect(cspReportEndpoint(undefined)).toBeNull();
    expect(cspReportEndpoint('http://agent.example/v1/csp-reports')).toBeNull();
    expect(cspReportEndpoint('https://agent.example/v1/csp-reports')).toBe(
      'https://agent.example/v1/csp-reports'
    );
    expect(reportOnlyPolicy("default-src 'none'")).toBe("default-src 'none'; report-to texuli-csp");
    expect(reportOnlyPolicy("default-src 'none'", 'https://agent.example/v1/csp-reports')).toBe(
      "default-src 'none'; report-to texuli-csp; report-uri https://agent.example/v1/csp-reports"
    );
    expect(reportingEndpointsHeader('https://agent.example/v1/csp-reports')).toBe(
      'texuli-csp="https://agent.example/v1/csp-reports"'
    );
  });

  it('adds a reporting block to the host manifest only when an endpoint is bound', () => {
    const page = {
      route: '/',
      enforcing: "default-src 'none'",
      reportOnly: "default-src 'none'; report-to texuli-csp",
      hashes: { scriptSrc: [], styleSrc: [], styleSrcAttr: [] },
    };
    expect(JSON.parse(buildCspManifest([page])).reporting).toBeUndefined();
    expect(
      JSON.parse(buildCspManifest([page], 'https://agent.example/v1/csp-reports')).reporting
    ).toEqual({
      group: 'texuli-csp',
      endpoint: 'https://agent.example/v1/csp-reports',
      header: 'texuli-csp="https://agent.example/v1/csp-reports"',
    });
  });
});
