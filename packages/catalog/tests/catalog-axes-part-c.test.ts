// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CATALOG_AXIS_NAMES, CATALOG_STATE_NAMES } from '../src/manifest/index.ts';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';
import { COMPOSITION_AXIS_STAMP } from '../src/manifests/composition/axes.ts';
import { DATA_AXIS_STAMP } from '../src/manifests/data/axes.ts';
import { LAYOUTS_AXIS_STAMP } from '../src/manifests/layouts/axes.ts';
import { SCHEMA_FORMS_AXIS_STAMP } from '../src/manifests/schema-forms/axes.ts';
import { SHEETS_AXIS_STAMP } from '../src/manifests/sheets/axes.ts';
import { STATE_AXIS_STAMP } from '../src/manifests/state/axes.ts';
import { WORKFLOWS_AXIS_STAMP } from '../src/manifests/workflows/axes.ts';

const PART_C_GROUPS = [
  'composition',
  'data',
  'layouts',
  'schema-forms',
  'sheets',
  'state',
  'workflows',
] as const;
const STAMP = {
  ...COMPOSITION_AXIS_STAMP,
  ...DATA_AXIS_STAMP,
  ...LAYOUTS_AXIS_STAMP,
  ...SCHEMA_FORMS_AXIS_STAMP,
  ...SHEETS_AXIS_STAMP,
  ...STATE_AXIS_STAMP,
  ...WORKFLOWS_AXIS_STAMP,
};

describe('catalog axes part C (layouts, data, state, composition, schema-forms, sheets, workflows)', () => {
  const groups = ALL_MANIFEST_GROUPS.filter((group) =>
    (PART_C_GROUPS as readonly string[]).includes(group.name)
  );
  const manifests = groups.flatMap((group) => group.manifests);

  it('covers every part C catalog id once', () => {
    expect(groups.map((group) => group.name).sort()).toEqual([...PART_C_GROUPS]);
    expect(manifests).toHaveLength(60);
    expect(new Set(manifests.map((manifest) => manifest.id)).size).toBe(60);
  });

  it('lists the expected axes and states, with axis values equal to the prop enum', () => {
    for (const manifest of manifests) {
      const extra = STAMP[manifest.id] ?? {};
      expect(manifest.axes ?? {}, manifest.id).toEqual(extra.axes ?? {});
      expect([...(manifest.states ?? [])], manifest.id).toEqual([...(extra.states ?? [])]);
      for (const axis of CATALOG_AXIS_NAMES) {
        const propName = manifest.axes?.[axis];
        if (propName === undefined) continue;
        const prop = manifest.props.find((entry) => entry.name === propName);
        expect(prop?.kind, `${manifest.id}.${axis}`).toBe('enum');
        expect(prop?.enumValues, `${manifest.id}.${axis}`).toEqual(expect.any(Array));
        expect(prop?.enumValues?.length, `${manifest.id}.${axis}`).toBeGreaterThan(0);
        expect(prop?.enumValues, `${manifest.id}.${axis}`).toContain(prop?.default);
      }
      for (const state of manifest.states ?? []) {
        expect(CATALOG_STATE_NAMES, manifest.id).toContain(state);
      }
    }
  });

  it('keeps states in the closed-list order and never invents an axis', () => {
    for (const manifest of manifests) {
      const states = [...(manifest.states ?? [])];
      const ordered = CATALOG_STATE_NAMES.filter((state) => states.includes(state));
      expect(states, manifest.id).toEqual([...ordered]);
      for (const axis of Object.keys(manifest.axes ?? {})) {
        expect(CATALOG_AXIS_NAMES, `${manifest.id}.${axis}`).toContain(axis);
      }
    }
  });
});
