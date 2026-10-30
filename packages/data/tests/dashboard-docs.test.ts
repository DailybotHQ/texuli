// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The dashboard subpaths are documented: the README links both pages, every
 * name the entries export is mentioned in its page, and every prop of the
 * two components is in the view page's tables.
 */
const ROOT = 'packages/data';
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8');

function exportedNames(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const raw of (match[1] ?? '').split(',')) {
      const part = raw.trim().replace(/^type\s+/, '');
      const name = /(?:\w+\s+as\s+)?(\w+)$/.exec(part)?.[1];
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}

const mentions = (doc: string, name: string) => new RegExp(`\`${name}\\b`).test(doc);

function propNames(file: string, iface: string): string[] {
  const body = new RegExp(`interface ${iface} \\{([\\s\\S]*?)\\n\\}`).exec(read(file))?.[1] ?? '';
  return [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((match) => match[1] as string);
}

describe('dashboard documentation', () => {
  it('links both pages from the README and the package exports', () => {
    const readme = read('README.md');
    expect(readme).toContain('packages/data/docs/data-dashboard.md');
    expect(readme).toContain('packages/data/docs/data-dashboard-engine.md');
    const pkg = JSON.parse(read('package.json')) as { exports: Record<string, unknown> };
    expect(Object.keys(pkg.exports)).toEqual(
      expect.arrayContaining(['./dashboard', './dashboard/engine'])
    );
  });

  it('mentions every engine export in the engine page', () => {
    const doc = read('docs/data-dashboard-engine.md');
    const missing = exportedNames(read('src/dashboard/engine/index.ts')).filter(
      (name) => !mentions(doc, name)
    );
    expect(missing).toEqual([]);
  });

  it('mentions every view export and every component prop in the view page', () => {
    const doc = read('docs/data-dashboard.md');
    const names = exportedNames(read('src/dashboard/index.ts'));
    expect(names.length).toBeGreaterThan(5);
    expect(names.filter((name) => !mentions(doc, name))).toEqual([]);
    const props = [
      ...propNames('src/dashboard/Dashboard.svelte', 'DashboardProps'),
      ...propNames('src/dashboard/DashboardWidget.svelte', 'DashboardWidgetProps'),
    ];
    expect(props.length).toBeGreaterThan(20);
    expect(props.filter((name) => !mentions(doc, name))).toEqual([]);
  });
});
