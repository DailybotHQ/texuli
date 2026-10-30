/**
 * /dashboards-page/ (PLAN_010 T-site-080): honest status copy (new in
 * 0.8.0, on npm in @texuli/data; the published 0.7.0 is without it), fictional data, no HTML
 * sinks, lazy islands, sections that match the page, persistence presets
 * that parse the way the page says (round trip, tampered, refused), the
 * in-page sources answering through the loader, and the agent dashboard
 * accepted with the host's sources while the URL binding is refused.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateDraft } from '@texuli/catalog/validate';
import {
  DEFAULT_DASHBOARD_BREAKPOINTS,
  parseDashboard,
  serializeDashboard,
} from '@texuli/data/dashboard/engine';
import { createPlayerCatalog } from '@texuli/player';
import { describe, expect, it } from 'vitest';
import {
  AGENT_DASHBOARD_BLUEPRINT,
  DASHBOARDS_SPEC,
  HOSTILE_DASHBOARD_BLUEPRINT,
} from '../src/components/dashboards-site/blueprint.ts';
import {
  DASHBOARDS_DOCS,
  DASHBOARDS_RELEASE,
  DASHBOARDS_SECTIONS,
  DASHBOARDS_STATUS,
} from '../src/components/dashboards-site/page.ts';
import { TAMPERED } from '../src/components/dashboards-site/persistence.ts';
import { createDashboardHost } from '../src/components/dashboards-site/sources.ts';

const read = (path: string) => readFileSync(resolve('apps/website/src', path), 'utf8');
const PAGE = read('pages/dashboards-page/index.astro');
const ISLANDS = ['AgentDashboardDemo', 'DashboardWorkbench', 'PersistenceLab'];
const SOURCES = [
  ...ISLANDS.map((name) => `components/dashboards-site/${name}.svelte`),
  'components/dashboards-site/blueprint.ts',
  'components/dashboards-site/page.ts',
  'components/dashboards-site/persistence.ts',
  'components/dashboards-site/sources.ts',
  'pages/dashboards-page/index.astro',
].map((path) => [path, read(path)] as const);

const preset = (id: string) => {
  const entry = TAMPERED.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(id);
  return parseDashboard(entry.text, { breakpoints: DEFAULT_DASHBOARD_BREAKPOINTS });
};

describe('dashboards page: copy and safety', () => {
  it('says the dashboard is new in 0.8.0 and on npm in @texuli/data from that release', () => {
    expect(DASHBOARDS_RELEASE).toBe('0.8.0');
    const data = JSON.parse(readFileSync(resolve('packages/data/package.json'), 'utf8')) as {
      version: string;
    };
    // The subpath ships with @texuli/data from 0.8.0; the copy names that release.
    expect(data.version).toBe(DASHBOARDS_RELEASE);
    expect(DASHBOARDS_STATUS).toBe(
      'New in 0.8.0: on npm in @texuli/data from 0.8.0, a pre-1.0 release.'
    );
    const copy = PAGE.replace(/\s+/g, ' ');
    expect(copy).toMatch(
      /eyebrow=\{`@texuli\/data\/dashboard · new in \$\{DASHBOARDS_RELEASE\}`\}/
    );
    expect(copy).toContain('the previous release, <code>0.7.0</code>, is without it');
    expect(copy).toContain('Planned, not built yet');
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(
        /not (?:yet )?published to npm|coming in 0\.8|unreleased|production[- ]ready/i
      );
      expect(source, path).not.toMatch(/\{@html|set:html|innerHTML|srcdoc/);
      for (const [url] of source.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
        expect(new URL(url).hostname, `${path}: ${url}`).toMatch(/(^|\.)example\.com$/);
      }
    }
  });

  it('mounts every island with client:visible and loads the player lazily', () => {
    const islands = [...PAGE.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
    expect(islands.map(([, name]) => name).sort()).toEqual(ISLANDS);
    for (const [, name, directive] of islands) expect(`${name} ${directive}`).toMatch(/ visible$/);
    for (const name of ISLANDS) {
      expect(read(`components/dashboards-site/${name}.svelte`), name).not.toMatch(
        /^import\s+(?!type\b)[^;]*from\s+'@texuli\/player'/m
      );
    }
    // The persistence lab is engine only: no Svelte view.
    expect(read('components/dashboards-site/PersistenceLab.svelte')).not.toMatch(
      /from '@texuli\/data\/dashboard'/
    );
  });

  it('gives every section an anchor and a unique id, and points at docs that exist', () => {
    const ids = DASHBOARDS_SECTIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(PAGE).toContain(`id="${id}"`);
    expect(PAGE).not.toMatch(/<h1[\s>]/);
    for (const doc of DASHBOARDS_DOCS) expect(existsSync(resolve(doc.path)), doc.path).toBe(true);
  });
});

describe('dashboards page: data', () => {
  it('round-trips the saved layout, repairs the tampered one and refuses the rest', () => {
    const saved = preset('saved');
    expect(saved.issues).toEqual([]);
    expect(saved.state?.layouts.lg).toHaveLength(5);
    const entry = TAMPERED.find((candidate) => candidate.id === 'saved');
    expect(serializeDashboard(saved.state?.layouts ?? {})).toBe(entry?.text);

    const tampered = preset('tampered');
    expect(tampered.state).not.toBeNull();
    expect(tampered.issues.length).toBeGreaterThanOrEqual(4);
    const ids = (tampered.state?.layouts.lg ?? []).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('<img src=x onerror=alert(1)>');
    for (const item of tampered.state?.layouts.lg ?? []) {
      expect(item.x + item.w).toBeLessThanOrEqual(12);
      expect(item.h).toBeLessThanOrEqual(48);
    }
    expect(Object.keys(tampered.state?.layouts ?? {})).toEqual(['lg']);

    for (const id of ['other', 'broken', 'oversized']) expect(preset(id).state, id).toBeNull();
    expect(preset('oversized').issues[0]?.message).toContain('too large');
  });

  it('serves the widgets through the loader, filtered and sorted as the query asks', async () => {
    const calls: string[] = [];
    const host = createDashboardHost((call) => calls.push(call.source), 0);
    const result = await host.loader.list('tickets', {
      filter: {
        type: 'group',
        op: 'and',
        children: [
          { type: 'condition', field: 'status', operator: 'in', value: ['open', 'doing'] },
        ],
      },
      sort: [{ field: 'points', direction: 'desc' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const points = result.value.rows.map((row) => row.points as number);
    expect(points).toEqual([...points].sort((a, b) => b - a));
    expect(result.value.rows.every((row) => row.status !== 'done')).toBe(true);
    const first = await host.loader.list('ops.metrics', {});
    host.advance();
    const second = await host.loader.list('ops.metrics', {});
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok)
      expect(second.value.rows[0]?.value).not.toBe(first.value.rows[0]?.value);
    expect(calls).toEqual(['tickets', 'ops.metrics', 'ops.metrics']);
  });

  it('writes an agent dashboard (spec 0.8.0) the player accepts with the host sources, and refuses the URL', () => {
    expect(DASHBOARDS_SPEC).toBe('0.8.0');
    const sources = createDashboardHost(() => {}).registry.describe();
    const errorsOf = (blueprint: unknown) =>
      validateDraft(blueprint, {
        catalog: createPlayerCatalog(),
        tier: 'untrusted',
        sources,
      }).diagnostics.filter((entry) => entry.severity === 'error');
    expect(errorsOf(AGENT_DASHBOARD_BLUEPRINT)).toEqual([]);
    expect(errorsOf(HOSTILE_DASHBOARD_BLUEPRINT).length).toBeGreaterThan(0);
  });
});
