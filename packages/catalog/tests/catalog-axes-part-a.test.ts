// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CATALOG_AXIS_NAMES, CATALOG_STATE_NAMES } from '../src/manifest/index.ts';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';
import { FORMS_AXIS_STAMP } from '../src/manifests/forms/axes.ts';
import { OVERLAYS_AXIS_STAMP } from '../src/manifests/overlays/axes.ts';

const PART_A_GROUPS = ['forms', 'overlays'] as const;
const STAMP = { ...FORMS_AXIS_STAMP, ...OVERLAYS_AXIS_STAMP };

describe('catalog axes part A (forms, overlays)', () => {
  const groups = ALL_MANIFEST_GROUPS.filter((group) =>
    (PART_A_GROUPS as readonly string[]).includes(group.name)
  );
  const manifests = groups.flatMap((group) => group.manifests);

  it('covers every forms and overlays catalog id once', () => {
    expect(groups.map((group) => group.name).sort()).toEqual(['forms', 'overlays']);
    expect(manifests).toHaveLength(56);
    expect(new Set(manifests.map((manifest) => manifest.id)).size).toBe(56);
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
