/**
 * PLAN_016 T-validator-core (ADR-032): `checkDesignSystemFull` returns every finding a design
 * system and an optional prototype can have — structure, extends, allow vs the merged
 * catalog, approval and hash, contrast, data-viz palette, tokens, prototype components and
 * CSS policy — each with a stable code, severity, area, path and fix hint.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SpecCatalog } from '@texuli/spec';
import { designSystemContentHash } from '@texuli/spec/design-system';
import { describe, expect, it } from 'vitest';
import {
  checkDesignSystemFull,
  compiledFindings,
  DS_FULL_FORMAT,
  type DsFullFinding,
  type DsFullReport,
} from '../src/ds-check/index.ts';

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../spec/catalog/components.json'), 'utf8')
) as SpecCatalog;

const base = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.0.0',
  name: 'Harborline',
  color: { brand: { seed: '#0e7490' } },
};

const locked = {
  ...base,
  allow: { button: { variants: ['default', 'outline'], sizes: ['sm', 'md'] }, card: {} },
};

const find = (report: DsFullReport, code: string) => report.findings.filter((f) => f.code === code);

function expectWellFormed(report: DsFullReport) {
  expect(report.format).toBe(DS_FULL_FORMAT);
  expect(report.check.format).toBe('texuli/ds-check');
  for (const finding of report.findings) {
    expect(['error', 'warning', 'info'], finding.code).toContain(finding.severity);
    expect(finding.code.length, JSON.stringify(finding)).toBeGreaterThan(0);
    expect(finding.path.length, finding.code).toBeGreaterThan(0);
    expect(finding.hint.length, finding.code).toBeGreaterThan(0);
  }
  // Errors first, then warnings, then info.
  const ranks = report.findings.map((f) => ['error', 'warning', 'info'].indexOf(f.severity));
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  expect(report.ok).toBe(report.summary.errors === 0);
  expect(report.codes).toEqual(
    [...new Set(report.findings.filter((f) => f.severity === 'error').map((f) => f.code))].sort()
  );
  // The embedded ds check report carries no compiled maps.
  for (const run of report.check.runs) expect(run).not.toHaveProperty('compiled');
}

describe('checkDesignSystemFull: the design system', () => {
  it('passes a valid locked document, with the ds check report embedded', async () => {
    const report = await checkDesignSystemFull(locked, { catalog });
    expectWellFormed(report);
    expect(report).toMatchObject({
      ok: true,
      codes: [],
      document: { id: 'harborline', version: '1.0.0' },
    });
    expect(report.check.locked).toMatchObject({
      locked: true,
      allowed: ['button', 'card'],
      catalogChecked: true,
    });
    expect(report.prototype).toBeUndefined();
  });

  it('reports structure, allow and extends problems with their areas', async () => {
    const report = await checkDesignSystemFull(
      {
        ...locked,
        colour: 'teal',
        allow: { ...locked.allow, 'no-such': {}, badge: { variants: ['sparkly'] } },
      },
      { catalog }
    );
    expectWellFormed(report);
    expect(find(report, 'unknown-key')[0]).toMatchObject({
      severity: 'error',
      area: 'structure',
      path: '$.colour',
    });
    expect(find(report, 'unknown-component')[0]).toMatchObject({
      area: 'allow',
      path: '$.allow["no-such"]',
    });
    expect(find(report, 'unknown-variant')[0]).toMatchObject({ area: 'allow' });
    const extended = await checkDesignSystemFull({ ...base, extends: 'acme@^2' }, { catalog });
    expect(find(extended, 'extends-range')[0]).toMatchObject({
      area: 'extends',
      path: '$.extends',
    });
  });

  it('checks the approval hash, and lets a caller report a stale approval without refusing it', async () => {
    const approved = {
      ...locked,
      approval: {
        status: 'approved',
        approvedBy: 'Design reviewer',
        approvedAt: '2026-11-09T14:30:00Z',
        version: '1.0.0',
        contentHash: designSystemContentHash(locked),
      },
    };
    expect((await checkDesignSystemFull(approved, { catalog })).ok).toBe(true);
    const edited = { ...approved, name: 'Harborline 2' };
    const stale = await checkDesignSystemFull(edited, { catalog });
    expect(find(stale, 'content-hash-mismatch')[0]).toMatchObject({
      severity: 'error',
      area: 'approval',
      path: '$.approval.contentHash',
    });
    expect((await checkDesignSystemFull(edited, { catalog, hashes: false })).ok).toBe(true);
    // An approved status without who and when is refused by the spec, under the approval area.
    const bare = await checkDesignSystemFull(
      { ...locked, approval: { status: 'approved', version: '1.0.0' } },
      { catalog }
    );
    expect(find(bare, 'approval-invalid')[0]).toMatchObject({
      area: 'approval',
      path: '$.approval',
    });
    expect(find(bare, 'approval-invalid')[0]?.hint).toContain('texuli ds approve');
  });

  it('reports contrast failures from the compiler with their pairs as findings', async () => {
    const report = await checkDesignSystemFull(
      {
        ...base,
        color: {
          brand: { seed: '#4f46e5' },
          roles: { light: { background: '#ffffff', foreground: '#eeeeee' } },
        },
      },
      { catalog }
    );
    expectWellFormed(report);
    expect(report.ok).toBe(false);
    expect(find(report, 'aa-text')[0]).toMatchObject({ severity: 'error', area: 'contrast' });
  });

  it('flags a categorical palette with a repeated or unreadable color as data-viz warnings', async () => {
    const report = await checkDesignSystemFull(
      {
        ...base,
        color: {
          brand: { seed: '#0e7490' },
          dataViz: { light: { categorical: ['#0e7490', '#0e7490', '#ffff66'] } },
        },
      },
      { catalog }
    );
    expectWellFormed(report);
    const duplicate = find(report, 'dataviz-duplicate').filter((f) => f.mode === 'light');
    expect(duplicate[0]).toMatchObject({ severity: 'warning', area: 'data-viz', value: '#0e7490' });
    expect(
      find(report, 'dataviz-contrast').some((f) => f.mode === 'light' && f.value === '#ffff66')
    ).toBe(true);
    expect(report.ok).toBe(true);
  });

  it('reports missing tokens and chart colors of a compiled map as errors', () => {
    const findings = compiledFindings({ light: { '--tx-background': '#ffffff' } }, 'high-contrast');
    const codes = new Set(findings.map((f: DsFullFinding) => f.code));
    expect(codes).toEqual(new Set(['token-missing', 'dataviz-missing']));
    expect(findings[0]).toMatchObject({
      severity: 'error',
      mode: 'light',
      variant: 'high-contrast',
    });
    expect(findings.length).toBeLessThanOrEqual(32);
  });

  it('merges host catalog extensions and reports a refused one', async () => {
    const report = await checkDesignSystemFull(locked, {
      catalog,
      extensions: [{ namespace: 'Bad NS' }],
    });
    expect(find(report, 'catalog-extension')[0]).toMatchObject({
      severity: 'error',
      area: 'catalog',
    });
  });
});

describe('checkDesignSystemFull: with a prototype', () => {
  const page = `<script lang="ts">
  import { Button, Card, Badge } from 'texuli';
  let kind = $state('default');
</script>

<Card>
  <Button variant="ghost">Cancel</Button>
  <Button variant={kind} class="flex gap-2 text-red-500">Go</Button>
  <Badge label="New" />
  <div style="color: red">raw</div>
</Card>
`;

  it('adds the components, props and CSS policy findings of the prototype', async () => {
    const report = await checkDesignSystemFull(locked, {
      catalog,
      prototype: {
        files: { 'src/Page.svelte': page },
        blueprints: { home: { tree: { id: 'button', props: { size: 'lg' } } } },
      },
    });
    expectWellFormed(report);
    expect(report.ok).toBe(false);
    expect(find(report, 'variant-not-allowed')[0]).toMatchObject({
      area: 'prototype-components',
      path: 'src/Page.svelte:7:3',
      component: 'button',
      value: 'ghost',
    });
    expect(find(report, 'not-allowed')[0]).toMatchObject({
      component: 'badge',
      path: 'src/Page.svelte:9:3',
    });
    expect(find(report, 'size-not-allowed')[0]).toMatchObject({ path: 'home#$.tree', value: 'lg' });
    expect(find(report, 'dynamic-value')[0]).toMatchObject({
      severity: 'warning',
      path: 'src/Page.svelte:8:3',
    });
    const css = report.findings.filter((f) => f.area === 'prototype-css');
    expect(css.length).toBeGreaterThan(0);
    expect(css.every((f) => f.severity === 'error' && f.code.startsWith('css-'))).toBe(true);
    expect(css.some((f) => f.code === 'css-inline-style')).toBe(true);
    expect(report.prototype).toMatchObject({
      files: 1,
      blueprints: 1,
      components: { card: 1, button: 3, badge: 1 },
    });
  });

  it('skips the CSS policy for an unlocked design system', async () => {
    const report = await checkDesignSystemFull(base, {
      catalog,
      prototype: { files: { 'src/Page.svelte': page } },
    });
    expect(report.findings.filter((f) => f.area === 'prototype-css')).toEqual([]);
    expect(find(report, 'not-allowed')).toEqual([]);
  });

  it('is total over hostile input', async () => {
    const report = await checkDesignSystemFull(null, {
      catalog,
      prototype: { files: { 'x.svelte': '<' }, blueprints: { b: 1 } },
    });
    expectWellFormed(report);
    expect(report.ok).toBe(false);
    expect(find(report, 'invalid-type')[0]).toMatchObject({ area: 'structure', path: '$' });
  });
});
