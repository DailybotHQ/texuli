/**
 * ADR-032: the committed catalog vocabulary carries axes and states that
 * match the live manifests. Variant, size, tone and density axes equal the
 * source enum props; every component lists the states its manifest names.
 * A drift in either direction fails this gate.
 */
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CATALOG_AXIS_NAMES, CATALOG_STATE_NAMES } from '@texuli/catalog/manifest';
import { ALL_MANIFEST_GROUPS } from '@texuli/catalog/manifests/all';
import { describe, expect, it } from 'vitest';
import { checkCatalogVariants, type SpecCatalog } from '../../packages/spec/src/catalog.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const committed = JSON.parse(
  readFileSync(join(ROOT, 'packages/spec/catalog/components.json'), 'utf8')
) as SpecCatalog;

describe('catalog variants source (ADR-032)', () => {
  const manifests = ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests);
  const byId = new Map(committed.components.map((component) => [component.id, component]));

  it('covers every catalog id once', () => {
    expect(committed.components).toHaveLength(174);
    expect(manifests).toHaveLength(174);
    expect(new Set(manifests.map((manifest) => manifest.id)).size).toBe(174);
    expect([...byId.keys()].sort()).toEqual(
      manifests
        .map((manifest) => manifest.id)
        .slice()
        .sort()
    );
  });

  it('keeps committed axes equal to the live enum props and lists every source state', () => {
    expect(checkCatalogVariants(committed)).toEqual([]);
    for (const manifest of manifests) {
      const component = byId.get(manifest.id);
      expect(component, manifest.id).toBeDefined();
      if (!component) continue;

      for (const axis of CATALOG_AXIS_NAMES) {
        const propName =
          manifest.axes?.[axis] ??
          (manifest.props.some((entry) => entry.name === axis && entry.kind === 'enum')
            ? axis
            : undefined);
        const declared = component.axes?.[axis];
        if (propName === undefined) {
          expect(declared, `${manifest.id}.${axis}`).toBeUndefined();
          continue;
        }
        const source = manifest.props.find((entry) => entry.name === propName);
        expect(source?.kind, `${manifest.id}.${axis}`).toBe('enum');
        const values = [...(source?.enumValues ?? [])];
        const fallback = declared?.default;
        expect(declared, `${manifest.id}.${axis}`).toEqual({
          prop: propName,
          values,
          default: typeof source?.default === 'string' ? source.default : fallback,
        });
        expect(values, `${manifest.id}.${axis}`).toContain(declared?.default);
      }

      const expectedStates = CATALOG_STATE_NAMES.filter((state) =>
        (manifest.states ?? []).includes(state)
      );
      if (expectedStates.length === 0) {
        expect(component.states, manifest.id).toBeUndefined();
      } else {
        expect(component.states, manifest.id).toEqual([...expectedStates]);
      }
    }
  });
});
