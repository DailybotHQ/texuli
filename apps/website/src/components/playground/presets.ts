/**
 * Editor presets: safe demos plus every hostile corpus sample (trees only).
 */
import { HOSTILE_SAMPLES, type HostileSample } from '@texuli/catalog/render/hostile';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';

export type PlaygroundPreset = {
  id: string;
  label: string;
  description: string;
  /** 'safe' demos or hostile category. */
  group: 'safe' | HostileSample['category'] | 'other';
  tree: CatalogTreeInput | CatalogTreeInput[];
};

const SAFE_PRESETS: readonly PlaygroundPreset[] = [
  {
    id: 'safe-card',
    label: 'Card with title',
    description: 'A simple emittable card (untrusted-safe).',
    group: 'safe',
    tree: {
      id: 'card',
      props: { variant: 'flat', title: 'Harbor Notes', description: 'Fictional ferry briefing.' },
    },
  },
  {
    id: 'safe-stack',
    label: 'Card with children',
    description: 'Nested badge and stat under a card.',
    group: 'safe',
    tree: {
      id: 'card',
      props: { title: 'Quarterly pulse', variant: 'elevated' },
      children: [
        { id: 'badge', props: { label: 'On track', variant: 'secondary' } },
        { id: 'stat', props: { label: 'Trips', value: '128' } },
      ],
    },
  },
  {
    id: 'safe-list',
    label: 'Two root cards',
    description: 'An array of roots.',
    group: 'safe',
    tree: [
      { id: 'card', props: { title: 'Inbound', description: '12 waiting' } },
      { id: 'card', props: { title: 'Outbound', description: '4 underway' } },
    ],
  },
];

function hostilePresets(): PlaygroundPreset[] {
  return HOSTILE_SAMPLES.filter((sample) => sample.tree != null).map((sample) => ({
    id: `hostile-${sample.id}`,
    label: sample.title,
    description: `Hostile · ${sample.category}`,
    group: sample.category,
    tree: sample.tree as CatalogTreeInput | CatalogTreeInput[],
  }));
}

export const PLAYGROUND_PRESETS: readonly PlaygroundPreset[] = Object.freeze([
  ...SAFE_PRESETS,
  ...hostilePresets(),
]);

export function presetById(id: string): PlaygroundPreset | undefined {
  return PLAYGROUND_PRESETS.find((p) => p.id === id);
}

export function defaultEditorJson(): string {
  const first = SAFE_PRESETS[0];
  if (!first) return '{}\n';
  return `${JSON.stringify(first.tree, null, 2)}\n`;
}
