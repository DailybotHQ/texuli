// @vitest-environment node
/**
 * Catalog widening, inputs set (T-widen-inputs, ADR-032): ToggleGroup,
 * Rating, FileUpload, TagsInput, PinInput, NumberField and MobileAppFrame
 * (host chrome) are catalog ids the allow set governs.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitTiers } from '../src/build/tiers.ts';
import { IMPORTS_BY_ID } from '../src/manifest/imports-map.ts';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';
import { CATALOG_EXCLUSIONS } from './coverage-exclusions.ts';

const IDS = [
  'toggle-group',
  'rating',
  'file-upload',
  'tags-input',
  'pin-input',
  'number-field',
  'mobile-app-frame',
] as const;

const ROOTS: Record<(typeof IDS)[number], string> = {
  'toggle-group': 'components/toggle/ToggleGroup.svelte',
  rating: 'components/rating/Rating.svelte',
  'file-upload': 'components/file-upload/FileUpload.svelte',
  'tags-input': 'components/tags-color/TagsInput.svelte',
  'pin-input': 'components/number-pin/PinInputRoot.svelte',
  'number-field': 'components/number-pin/NumberFieldRoot.svelte',
  'mobile-app-frame': 'layouts/mobile/MobileAppFrame.svelte',
};

const source = (file: string) =>
  readFileSync(resolve(process.cwd(), 'packages/texuli/src', file), 'utf8');

const byId = new Map(
  ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests).map((manifest) => [manifest.id, manifest])
);

describe('catalog widening: inputs set', () => {
  it('catalogues toggle groups, ratings, file upload, tags, PIN, number and the mobile app frame', () => {
    for (const id of IDS) {
      const manifest = byId.get(id);
      expect(manifest, id).toBeDefined();
      expect(manifest?.package, id).toBe('texuli');
      expect(manifest?.examples.length, id).toBeGreaterThan(0);
      expect(IMPORTS_BY_ID[id]?.length, id).toBeGreaterThan(0);
      expect(manifest?.agentEmittable, id).toBe(false);
    }
    expect(byId.get('toggle-group')?.axes).toEqual({ variant: 'variant', size: 'size' });
    expect(byId.get('rating')?.axes).toEqual({ size: 'size', tone: 'tone' });
    expect(byId.get('file-upload')?.axes).toEqual({ variant: 'variant' });
    expect(byId.get('number-field')?.axes).toEqual({ size: 'size' });
    expect(byId.get('pin-input')?.axes).toEqual({ size: 'size' });
    const excluded = CATALOG_EXCLUSIONS.map((row) => row.key);
    expect(excluded).not.toContain('texuli::ToggleGroup');
    expect(excluded).not.toContain('texuli::Rating');
    expect(excluded).not.toContain('texuli::FileUpload');
    expect(excluded).not.toContain('texuli::TagsInput');
    expect(excluded).not.toContain('texuli::MobileAppFrame');
  });

  it('keeps host chrome and app inputs out of every emit tier', () => {
    for (const id of IDS) {
      const manifest = byId.get(id)!;
      const group = ALL_MANIFEST_GROUPS.find((entry) =>
        entry.manifests.some((item) => item.id === id)
      );
      expect(emitTiers(manifest, group!.name), id).toEqual([]);
    }
  });

  it('stamps data-tx-component on each root', () => {
    for (const id of IDS) {
      expect(source(ROOTS[id])).toContain(`data-tx-component="${id}"`);
    }
    expect(source(ROOTS['toggle-group'])).toContain('data-tx-variant={variant}');
    expect(source(ROOTS['toggle-group'])).toContain('data-tx-size={size}');
    expect(source(ROOTS.rating)).toContain('data-tx-size={size}');
    expect(source(ROOTS.rating)).toContain('data-tx-tone={tone}');
    expect(source(ROOTS['file-upload'])).toContain('data-tx-variant={variant}');
    expect(source(ROOTS['number-field'])).toContain('data-tx-size={size}');
    expect(source(ROOTS['pin-input'])).toContain('data-tx-size={size}');
  });
});
