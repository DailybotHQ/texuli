import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NATIVE_MATRIX_GROUPS,
  NATIVE_MATRIX_PLATFORMS,
  NATIVE_MATRIX_ROWS,
  NATIVE_MATRIX_STATUSES,
  NATIVE_MATRIX_TOTALS,
  NATIVE_MATRIX_VERSION,
  nativeMatrixKey,
} from '../../src/components/sections/native/matrix/matrix-data.ts';
import { NATIVE_COMPATIBILITY } from '../../src/data/native/compatibility.ts';

const componentPath =
  'apps/website/src/components/sections/native/matrix/NativeCompatibilityMatrix.astro';
const component = readFileSync(resolve(componentPath), 'utf8');

describe('Native compatibility matrix block', () => {
  it('renders every generated component status with existing evidence paths', () => {
    expect(NATIVE_MATRIX_VERSION).toBe(NATIVE_COMPATIBILITY.specVersion);
    expect(NATIVE_MATRIX_TOTALS).toEqual(NATIVE_COMPATIBILITY.totals);
    expect(NATIVE_MATRIX_ROWS).toHaveLength(NATIVE_MATRIX_TOTALS.catalog);
    expect(NATIVE_MATRIX_GROUPS).toEqual(
      [...new Set(NATIVE_COMPATIBILITY.components.map(({ group }) => group))].sort((a, b) =>
        a.localeCompare(b)
      )
    );

    for (const source of NATIVE_COMPATIBILITY.components) {
      const row = NATIVE_MATRIX_ROWS.find(({ id }) => id === source.id);
      expect(row, source.id).toBeDefined();
      expect(row).toMatchObject({
        group: source.group,
        web: source.web,
        composeDesktop: source.composeDesktop,
        conformance: source.conformance,
        evidence: source.evidence,
      });
      expect(existsSync(resolve(source.evidence.parity)), source.evidence.parity).toBe(true);
      for (const path of source.evidence.traces) expect(existsSync(resolve(path)), path).toBe(true);
    }

    for (const platform of NATIVE_MATRIX_PLATFORMS) {
      expect(platform.detail.length).toBeGreaterThan(0);
      for (const path of platform.evidence) expect(existsSync(resolve(path)), path).toBe(true);
    }
  });

  it('provides accessible group and status filters for the static table', () => {
    expect(component).toContain('Filter components');
    expect(component).toContain('aria-label="Component group"');
    expect(component).toContain('aria-label="Compatibility status"');
    expect(component).toContain('name="native-matrix-group"');
    expect(component).toContain('name="native-matrix-status"');
    expect(component).toContain('id="native-matrix-group-all" checked');
    expect(component).toContain('id="native-matrix-status-all" checked');
    expect(component).toContain(':has(#native-matrix-status-supported:checked)');
    for (const group of NATIVE_MATRIX_GROUPS) {
      expect(component).toContain(`#native-matrix-group-${nativeMatrixKey(group)}:checked`);
    }
    expect(NATIVE_MATRIX_STATUSES).toEqual([
      'Supported',
      'Partial',
      'Experimental',
      'Planned',
      'Unsupported',
      'Not applicable',
    ]);
    expect(component).toContain('{NATIVE_MATRIX_STATUSES.map((status) =>');
  });

  it('has a captioned semantic table, visible status legend, and evidence links without hydration', () => {
    expect(component).toContain('<table class="native-matrix__table">');
    expect(component).toContain('<caption>Web and native compatibility');
    expect(component).toContain('<th scope="col">Component</th>');
    expect(component).toContain('<th scope="row"><code>{row.id}</code></th>');
    expect(component).toContain('Status legend');
    expect(component).toContain('safeHref(');
    expect(component).toContain('row.evidence.parity');
    expect(component).toContain('row.evidence.traces.map');
    expect(component).not.toMatch(/client:(?:load|idle|visible|media|only)/);
    expect(component).not.toContain('<script');
  });
});
