// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMPORTS_BY_ID, NON_COMPONENT_IMPORTS } from '../src/manifest/imports-map.ts';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';
import { DISPLAY_MANIFESTS } from '../src/manifests/display/index.ts';
import { CATALOG_EXCLUSIONS } from './coverage-exclusions.ts';

const IDS = [
  'icon',
  'avatar',
  'skeleton',
  'progress',
  'spinner',
  'carousel',
  'separator',
  'list-item',
] as const;

const ROOTS: Record<(typeof IDS)[number], string> = {
  icon: 'components/icons/Icon.svelte',
  avatar: 'components/avatar/Avatar.svelte',
  skeleton: 'components/feedback/Skeleton.svelte',
  progress: 'components/feedback/Progress.svelte',
  spinner: 'components/feedback/Spinner.svelte',
  carousel: 'components/carousel/Carousel.svelte',
  separator: 'components/separator-aspect/Separator.svelte',
  'list-item': 'components/list-item/ListItem.svelte',
};

const source = (file: string) =>
  readFileSync(resolve(process.cwd(), 'packages/texuli/src', file), 'utf8');

describe('catalog widen display', () => {
  const byId = new Map(
    ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests).map((manifest) => [
      manifest.id,
      manifest,
    ])
  );

  it('lists Icon, Avatar, Skeleton, Progress, Spinner, Carousel, Separator and ListItem', () => {
    for (const id of IDS) {
      const manifest = DISPLAY_MANIFESTS.find((entry) => entry.id === id);
      expect(manifest, id).toBeDefined();
      expect(byId.get(id)?.id, id).toBe(id);
      expect(manifest?.examples.length, id).toBeGreaterThan(0);
      expect(IMPORTS_BY_ID[id]?.length, id).toBeGreaterThan(0);
    }
    expect(byId.get('icon')?.axes).toEqual({ size: 'size', tone: 'tone' });
    expect(CATALOG_EXCLUSIONS.map((row) => row.key)).not.toContain('texuli::Icon');
    expect(CATALOG_EXCLUSIONS.map((row) => row.key)).not.toContain('texuli::Avatar');
    expect(CATALOG_EXCLUSIONS.map((row) => row.key)).not.toContain('texuli::ListItem');
  });

  it('stamps data-tx-component on each display root', () => {
    for (const id of IDS) {
      expect(source(ROOTS[id])).toContain(`data-tx-component="${id}"`);
    }
    expect(source(ROOTS.icon)).toContain('data-tx-size={size}');
    expect(source(ROOTS.icon)).toContain('data-tx-tone={tone}');
  });

  it('lists MotionProvider and SafeArea as non-component exports', () => {
    const names = new Set(
      NON_COMPONENT_IMPORTS.flatMap((entry) =>
        entry.exports.map((name) => `${entry.module}::${name}`)
      )
    );
    expect(
      [...names].some((key) => key.endsWith('::MotionProvider')),
      'MotionProvider'
    ).toBe(true);
    expect(
      [...names].some((key) => key.endsWith('::SafeArea')),
      'SafeArea'
    ).toBe(true);
  });
});
