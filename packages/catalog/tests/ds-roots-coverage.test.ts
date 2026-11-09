import './ds-roots-a.test.ts';
import './ds-roots-b.test.ts';
import './ds-roots-c.test.ts';
import './ds-roots-d.test.ts';
import { describe, expect, it } from 'vitest';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';

const DOCUMENTED_ROOT_EXCEPTIONS = ['data-dashboard-widget', 'inline-text'] as const;

describe('catalog design-system root coverage', () => {
  it('runs the root-render checks for all 174 catalog ids and lists both documented exceptions', () => {
    const entries = ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests);
    const ids = entries.map((entry) => entry.id);

    expect(ids).toHaveLength(174);
    expect(new Set(ids).size).toBe(174);
    expect(DOCUMENTED_ROOT_EXCEPTIONS).toEqual(['data-dashboard-widget', 'inline-text']);
    for (const id of DOCUMENTED_ROOT_EXCEPTIONS) expect(ids).toContain(id);
  });
});
