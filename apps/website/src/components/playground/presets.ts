/**
 * Editor presets: safe demos plus every hostile corpus sample (trees only).
 * Each preset carries a one-line "what this proves" caption so the page
 * states the safety property a run demonstrates (T-82 punch-list row 5).
 */
import { HOSTILE_SAMPLES, type HostileSample } from '@texuli/catalog/render/hostile';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';

export type PlaygroundPreset = {
  id: string;
  label: string;
  description: string;
  /** One line: the safety property this preset demonstrates when rendered. */
  proves: string;
  /** 'safe' demos or hostile category. */
  group: 'safe' | HostileSample['category'] | 'other';
  tree: CatalogTreeInput | CatalogTreeInput[];
};

/**
 * What rendering a sample of each hostile category proves. Every category in
 * `HostileCategory` must have a row — a unit test pins that, so a new corpus
 * category cannot ship without saying what it proves.
 */
export const HOSTILE_PROVES: Readonly<Record<HostileSample['category'], string>> = Object.freeze({
  'script-url':
    'Executable URLs are refused: javascript:, vbscript: and data:text/html never render.',
  'fake-dialog':
    'Dialog and alert chrome are not emittable at the untrusted tier: fake confirms render as named placeholders.',
  bidi: 'Bidi overrides and zero-width marks are not removed from text: the title renders as plain text with them kept, so it can still read reordered. What the untrusted URL policy refuses is a link that carries them.',
  'giant-tree': 'Depth and breadth limits refuse trees built to exhaust the renderer.',
  'prompt-injection':
    'Prompt text is only ever text: an injection renders as copy, never as instructions to a host.',
  'html-string': 'HTML strings stay strings: tags and event handlers never reach a markup sink.',
  'style-class':
    'class and style are not pass-through props, so hostile CSS cannot restyle the host page.',
  'unknown-id':
    'Ids outside the catalog render as named placeholders, not as errors or custom code.',
  'deep-nesting': 'Structures past the depth limit are refused before they can blow the stack.',
  unicode:
    'Invisible Unicode tricks (zero-width spaces inside a scheme, fullwidth look-alikes) do not smuggle an executable URL past the policy.',
  prototype:
    'Prototype-pollution keys (__proto__, constructor) cannot reach the components: unknown props never bind.',
  oversized:
    'Size and prop-count limits bite: a too-big payload is refused or stripped with a diagnostic, never painted whole.',
  'duplicate-key':
    'Duplicate JSON keys resolve one way (last wins), so a tree cannot be two trees.',
  'url-trick':
    'Tabs, newlines and mixed case in a scheme cannot smuggle javascript: past the policy. The untrusted tier keeps only https:, mailto: and #fragment links and refuses protocol-relative (//host) links, relative paths and credentials before the host; any other https: host still passes.',
});

const SAFE_PRESETS: readonly PlaygroundPreset[] = [
  {
    id: 'safe-card',
    label: 'Card with title',
    description: 'A simple emittable card (untrusted-safe).',
    proves: 'The baseline: a clean tree renders whole.',
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
    proves: 'Nesting is kept: children render under their parent.',
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
    proves: 'Multiple roots render in reading order.',
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
    proves: HOSTILE_PROVES[sample.category],
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
