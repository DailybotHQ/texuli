// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CATALOG_AXIS_NAMES, CATALOG_STATE_NAMES } from '../src/manifest/index.ts';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';

const PART_B_GROUP_IDS = {
  canvas: ['canvas'],
  chat: ['chat-message', 'chat-thread', 'composer'],
  content: [
    'blocks-code',
    'blocks-data',
    'blocks-diagram',
    'blocks-embed',
    'blocks-interactive',
    'blocks-map',
    'blocks-media',
    'blocks-structure',
    'blocks-text',
    'charts-area',
    'charts-bar',
    'charts-bubble',
    'charts-bullet',
    'charts-canvas-renderer',
    'charts-cartesian',
    'charts-combo',
    'charts-donut',
    'charts-funnel',
    'charts-gauge',
    'charts-geo-map',
    'charts-geo-point-map',
    'charts-heatmap',
    'charts-line',
    'charts-network',
    'charts-pie',
    'charts-progress-ring',
    'charts-sankey',
    'charts-scatter',
    'charts-sparkline',
    'charts-stacked-bar',
    'charts-sunburst',
    'charts-treemap',
    'media-composition-canvas',
    'media-composition-svg',
    'media-image',
  ],
  display: [
    'accordion',
    'alert',
    'avatar-group-grid',
    'badge',
    'banner',
    'box',
    'callout',
    'card',
    'chip',
    'code',
    'empty-state',
    'error-state',
    'heading',
    'inline-text',
    'kbd',
    'kpi',
    'prose',
    'stat',
    'stepper',
    'table',
    'tabs',
    'tag',
    'text',
    'timeline',
  ],
  documents: ['document'],
} as const;

type Expected = {
  readonly axes?: Readonly<Partial<Record<(typeof CATALOG_AXIS_NAMES)[number], string>>>;
  readonly states?: readonly (typeof CATALOG_STATE_NAMES)[number][];
};

const EXPECTED: Readonly<Record<string, Expected>> = {
  canvas: {
    states: [
      'hover',
      'focus-visible',
      'active',
      'disabled',
      'selected',
      'expanded',
      'checked',
      'open',
      'readonly',
    ],
  },
  accordion: {
    axes: { variant: 'variant' },
    states: ['hover', 'focus-visible', 'disabled', 'expanded'],
  },
  'chat-thread': { states: ['disabled'] },
  composer: { states: ['disabled', 'loading'] },
  'blocks-code': {
    states: ['hover', 'focus-visible', 'disabled', 'loading', 'invalid', 'selected', 'readonly'],
  },
  'blocks-diagram': { states: ['focus-visible'] },
  'blocks-embed': { states: ['focus-visible', 'disabled', 'loading'] },
  'blocks-interactive': { states: ['disabled', 'checked'] },
  'blocks-map': { states: ['focus-visible', 'active', 'selected'] },
  'blocks-media': { states: ['invalid'] },
  'blocks-structure': { states: ['focus-visible'] },
  'blocks-text': { states: ['focus-visible', 'invalid', 'checked', 'open'] },
  'charts-cartesian': { states: ['open'] },
  'charts-sparkline': { axes: { variant: 'variant' }, states: ['focus-visible'] },
  'media-composition-canvas': { states: ['focus-visible', 'disabled'] },
  'media-composition-svg': { states: ['focus-visible', 'invalid'] },
  'media-image': { states: ['focus-visible'] },
  alert: { axes: { tone: 'tone' }, states: ['hover', 'focus-visible'] },
  'avatar-group-grid': { axes: { size: 'size' } },
  badge: {
    axes: { variant: 'variant' },
    states: ['hover', 'focus-visible', 'disabled', 'selected'],
  },
  banner: { axes: { tone: 'tone' } },
  box: { axes: { variant: 'surface' } },
  heading: { axes: { size: 'size', tone: 'tone' } },
  prose: { axes: { size: 'size' } },
  text: { axes: { size: 'size', tone: 'tone' } },
  callout: { axes: { tone: 'tone' } },
  card: { axes: { variant: 'variant' }, states: ['hover', 'focus-visible'] },
  chip: { axes: { variant: 'variant' }, states: ['active', 'disabled', 'selected'] },
  code: { axes: { variant: 'variant' }, states: ['hover', 'focus-visible', 'disabled'] },
  'empty-state': { axes: { size: 'size' } },
  kbd: { states: ['hover', 'focus-visible', 'disabled'] },
  kpi: { axes: { variant: 'variant' }, states: ['hover', 'focus-visible', 'loading'] },
  stat: { axes: { variant: 'variant' }, states: ['hover'] },
  stepper: { states: ['focus-visible', 'selected'] },
  tabs: {
    axes: { variant: 'variant' },
    states: ['hover', 'focus-visible', 'disabled', 'selected'],
  },
  table: {
    axes: { variant: 'variant', density: 'density' },
    states: ['focus-visible', 'loading'],
  },
  tag: { axes: { variant: 'variant' }, states: ['hover', 'focus-visible', 'disabled', 'loading'] },
  timeline: { states: ['focus-visible', 'selected'] },
  document: { states: ['checked', 'open'] },
};

describe('catalog axes part B (content, display, chat, documents, canvas)', () => {
  const groups = ALL_MANIFEST_GROUPS.filter((group) => Object.hasOwn(PART_B_GROUP_IDS, group.name));
  const manifests = groups.flatMap((group) => group.manifests);

  it('covers every Part B catalog id exactly once', () => {
    expect(groups.map((group) => group.name).sort()).toEqual([
      'canvas',
      'chat',
      'content',
      'display',
      'documents',
    ]);
    expect(manifests).toHaveLength(64);
    expect(new Set(manifests.map((manifest) => manifest.id)).size).toBe(64);
    for (const group of groups) {
      expect(group.manifests.map((manifest) => manifest.id).sort(), group.name).toEqual(
        [...PART_B_GROUP_IDS[group.name as keyof typeof PART_B_GROUP_IDS]].sort()
      );
    }
  });

  it('matches the audited axes and states, and axes use their enum props', () => {
    for (const manifest of manifests) {
      const expected = EXPECTED[manifest.id] ?? {};
      expect(manifest.axes ?? {}, manifest.id).toEqual(expected.axes ?? {});
      expect([...(manifest.states ?? [])], manifest.id).toEqual([...(expected.states ?? [])]);

      for (const axis of CATALOG_AXIS_NAMES) {
        const propName = manifest.axes?.[axis];
        if (propName === undefined) continue;
        const prop = manifest.props.find((entry) => entry.name === propName);
        expect(prop?.kind, `${manifest.id}.${axis}`).toBe('enum');
        expect(prop?.enumValues?.length, `${manifest.id}.${axis}`).toBeGreaterThan(0);
        expect(prop?.enumValues, `${manifest.id}.${axis}`).toContain(prop?.default);
      }

      for (const state of manifest.states ?? []) {
        expect(CATALOG_STATE_NAMES, manifest.id).toContain(state);
      }
      const states = [...(manifest.states ?? [])];
      expect(states, manifest.id).toEqual(
        CATALOG_STATE_NAMES.filter((state) => states.includes(state))
      );
    }
  });
});
