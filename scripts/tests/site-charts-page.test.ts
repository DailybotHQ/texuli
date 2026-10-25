// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CHART_FAMILIES,
  familyById,
  familyPath,
  requiredContractNames,
} from '../../apps/website/src/components/charts-page/families.ts';

describe('site charts gallery catalog', () => {
  it('lists every charts package family with a unique id', () => {
    const ids = CHART_FAMILIES.map((f) => f.id);
    expect(ids).toEqual([
      'cartesian',
      'part-whole',
      'compact',
      'matrix',
      'flow',
      'geo',
      'interaction',
      'canvas',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives each family an import path, components and a non-empty contract', () => {
    for (const family of CHART_FAMILIES) {
      expect(family.importPath.startsWith('@texuli/charts/')).toBe(true);
      expect(family.components.length).toBeGreaterThan(0);
      expect(family.contract.length).toBeGreaterThan(0);
      expect(family.summary.length).toBeGreaterThan(10);
      expect(family.sampleNote.length).toBeGreaterThan(10);
      expect(familyPath(family.id)).toBe(`/charts-page/${family.id}/`);
      expect(familyById(family.id)).toEqual(family);
    }
  });

  it('marks core fields required on cartesian and interaction families', () => {
    expect(requiredContractNames(familyById('cartesian')!)).toEqual(
      expect.arrayContaining(['title', 'description', 'series'])
    );
    expect(requiredContractNames(familyById('interaction')!)).toEqual(
      expect.arrayContaining(['series'])
    );
    expect(requiredContractNames(familyById('canvas')!)).toEqual(
      expect.arrayContaining(['series', 'renderer', 'title', 'description'])
    );
  });

  it('keeps geo honest about offline schematic tiles in the sample note', () => {
    const geo = familyById('geo');
    expect(geo?.sampleNote.toLowerCase()).toMatch(/schematic|district|region/);
    expect(geo?.contract.some((c) => c.name === 'shape')).toBe(true);
  });
});
