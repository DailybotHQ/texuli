import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_COMPATIBILITY } from '../../src/data/native/compatibility.ts';

interface ParityComponent {
  readonly id: string;
  readonly native: 'painted' | 'placeholder';
  readonly readOnly: boolean;
  readonly golden: boolean;
  readonly parityTrace: boolean;
  readonly semanticRule: boolean;
}

const parity = JSON.parse(readFileSync(resolve('native/docs/parity.json'), 'utf8')) as {
  readonly specVersion: string;
  readonly totals: {
    readonly catalog: number;
    readonly painted: number;
    readonly placeholder: number;
  };
  readonly components: readonly ParityComponent[];
};

describe('Native compatibility data', () => {
  it('generates the catalog matrix from parity metadata with truthful renderer statuses', () => {
    expect(NATIVE_COMPATIBILITY.specVersion).toBe(parity.specVersion);
    expect(NATIVE_COMPATIBILITY.totals).toEqual(parity.totals);
    expect(NATIVE_COMPATIBILITY.components).toHaveLength(parity.totals.catalog);
    expect(new Set(NATIVE_COMPATIBILITY.components.map((row) => row.id)).size).toBe(
      parity.totals.catalog
    );

    for (const component of parity.components) {
      const row = NATIVE_COMPATIBILITY.components.find((entry) => entry.id === component.id);
      expect(row, component.id).toBeDefined();
      if (!row) continue;
      expect(row.web).toBe('Supported');
      expect(row.composeDesktop).toBe(
        component.native === 'placeholder'
          ? 'Unsupported'
          : component.readOnly
            ? 'Partial'
            : 'Supported'
      );
      expect(row.evidence.parity).toBe('native/docs/parity.json');
      expect(existsSync(resolve(row.evidence.parity))).toBe(true);
    }
  });

  it('derives conformance coverage from the checked-in golden and parity traces', () => {
    for (const component of parity.components) {
      const row = NATIVE_COMPATIBILITY.components.find((entry) => entry.id === component.id);
      if (!row) continue;
      expect(row.evidence.traces.length > 0).toBe(component.golden || component.parityTrace);
      expect(row.conformance).toBe(
        row.evidence.traces.length > 0
          ? 'Supported'
          : component.semanticRule
            ? 'Experimental'
            : 'Not applicable'
      );
      for (const evidence of row.evidence.traces) expect(existsSync(resolve(evidence))).toBe(true);
    }
    expect(NATIVE_COMPATIBILITY.platforms.map(({ target }) => target)).toEqual([
      'KMP shared spec (JVM + iOS targets)',
      'Compose Desktop',
      'iOS UI renderer',
      'Android UI renderer',
    ]);
    expect(NATIVE_COMPATIBILITY.platforms.map(({ status }) => status)).toEqual([
      'Experimental',
      'Partial',
      'Planned',
      'Planned',
    ]);
    for (const platform of NATIVE_COMPATIBILITY.platforms) {
      expect(platform.evidence.length).toBeGreaterThan(0);
      for (const evidence of platform.evidence)
        expect(existsSync(resolve(evidence)), evidence).toBe(true);
    }
  });
});
