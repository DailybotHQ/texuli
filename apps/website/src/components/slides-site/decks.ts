/**
 * The page's gallery decks, all plain deck model v2 data that `DeckStage`
 * validates itself at the untrusted tier:
 *
 * - `layoutGalleryDeck`: one slide per catalog layout, from the layout's own
 *   catalog sample (`DECK_LAYOUTS[id].sample`), with remote sample images
 *   moved to the page's same-origin image;
 * - `backgroundGalleryDeck`: the 13 presets and one spec of each kind;
 * - `componentsDeck`: catalog components on slides (a bar chart, a data
 *   grid, a workflow graph in view mode, a sortable list), painted by the
 *   stage's default component renderers through the player.
 *
 * Fictional data only (example.com, Example Co., Harborline).
 */
import {
  DECK_BACKGROUND_PRESET_IDS,
  DECK_CATALOG_LAYOUT_IDS,
  DECK_LAYOUTS,
  type DeckCatalogLayoutId,
} from '@texuli/deck/model';
import { FLAGSHIP_IMAGE } from './flagship.ts';

type Bag = Record<string, unknown>;

const isBag = (value: unknown): value is Bag =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Remote sample media → the page's own files (images) or a same-origin clip path (video). */
function localMedia(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((item) => localMedia(item));
  if (!isBag(value)) return value;
  const out: Bag = {};
  for (const [name, item] of Object.entries(value)) out[name] = localMedia(item, name);
  if (typeof out.src === 'string' && out.src.startsWith('https://')) {
    if (key === 'video') {
      // No clip ships with the site: the player shows its unavailable state.
      out.src = 'media/sample-clip.mp4';
    } else {
      out.src = FLAGSHIP_IMAGE;
      out.alt = 'The Texuli mark: a rounded square of small tiles';
      out.width = 512;
      out.height = 512;
    }
  }
  return out;
}

export interface GalleryEntry {
  /** The slide id. */
  id: string;
  label: string;
  /** One line about when to use it. */
  summary: string;
}

const slideId = (layout: string) => `layout-${layout}`;

/** One entry per catalog layout (label and its first "use when"). */
export const LAYOUT_GALLERY: readonly GalleryEntry[] = DECK_CATALOG_LAYOUT_IDS.map((id) => ({
  id: slideId(id),
  label: DECK_LAYOUTS[id].label,
  summary: DECK_LAYOUTS[id].useWhen[0] ?? DECK_LAYOUTS[id].description,
}));

/** Every catalog layout with its own sample, in catalog order. */
export function layoutGalleryDeck(): Bag {
  return {
    formatVersion: 2,
    meta: { title: 'Layout gallery', locale: 'en' },
    slides: DECK_CATALOG_LAYOUT_IDS.map((id: DeckCatalogLayoutId) => ({
      id: slideId(id),
      title: DECK_LAYOUTS[id].label,
      layout: id,
      props: localMedia(structuredClone(DECK_LAYOUTS[id].sample)),
      notes: DECK_LAYOUTS[id].description,
    })),
  };
}

const SPECS: readonly { id: string; label: string; background: Bag }[] = [
  { id: 'bg-spec-solid', label: 'Solid #0f766e', background: { kind: 'solid', color: '#0f766e' } },
  {
    id: 'bg-spec-gradient',
    label: 'Gradient dusk, 45°',
    background: { kind: 'gradient', gradient: 'dusk', angle: 45 },
  },
  {
    id: 'bg-spec-image',
    label: 'Image, light tone',
    background: { kind: 'image', src: FLAGSHIP_IMAGE, tone: 'light', fit: 'contain' },
  },
  {
    id: 'bg-spec-image-full',
    label: 'Full image, dark tone',
    background: { kind: 'image-full', src: FLAGSHIP_IMAGE, tone: 'dark', overlay: 0.4 },
  },
];

/** The 13 presets, then one spec of each kind. */
export const BACKGROUND_GALLERY: readonly GalleryEntry[] = [
  ...DECK_BACKGROUND_PRESET_IDS.map((id) => ({
    id: `bg-${id}`,
    label: id,
    summary: 'Preset',
  })),
  ...SPECS.map((spec) => ({ id: spec.id, label: spec.label, summary: 'Spec' })),
];

/** One section-divider slide over each background. */
export function backgroundGalleryDeck(): Bag {
  const backgrounds: { id: string; label: string; background: unknown }[] = [
    ...DECK_BACKGROUND_PRESET_IDS.map((id) => ({ id: `bg-${id}`, label: id, background: id })),
    ...SPECS,
  ];
  return {
    formatVersion: 2,
    meta: { title: 'Background gallery', locale: 'en' },
    slides: backgrounds.map((entry) => ({
      id: entry.id,
      title: entry.label,
      layout: 'section-divider',
      props: { eyebrow: 'Background', title: entry.label },
      background: entry.background,
    })),
  };
}

/** The showcase's slides, in order. */
export const COMPONENT_GALLERY: readonly GalleryEntry[] = [
  { id: 'chart', label: 'Bar chart', summary: 'charts-bar with its accessible data table' },
  { id: 'grid', label: 'Data grid', summary: 'data-grid: sortable columns, keyboard cells' },
  { id: 'workflow', label: 'Workflow', summary: 'workflow-graph in view mode' },
  { id: 'sortable', label: 'Sortable list', summary: 'sortable-list: reorder by drag or keyboard' },
];

/** Catalog components on slides, painted by the stage's default component renderers. */
export function componentsDeck(): Bag {
  return {
    formatVersion: 2,
    meta: { title: 'Components on slides', locale: 'en' },
    slides: [
      {
        id: 'chart',
        title: 'Releases per month',
        layout: 'free',
        blocks: [
          { type: 'heading', level: 2, text: 'Releases per month' },
          {
            type: 'component',
            component: 'charts-bar',
            props: {
              title: 'Releases per month',
              description: 'Releases grew from 12 in January to 31 in March.',
              series: [
                {
                  id: 'releases',
                  label: 'Releases',
                  points: [
                    { x: 'Jan', y: 12 },
                    { x: 'Feb', y: 22 },
                    { x: 'Mar', y: 31 },
                  ],
                },
              ],
            },
          },
        ],
      },
      {
        id: 'grid',
        title: 'Open orders',
        layout: 'component',
        component: {
          component: 'data-grid',
          props: {
            caption: 'Open orders',
            columns: [
              { id: 'customer', header: 'Customer' },
              { id: 'route', header: 'Route' },
              { id: 'total', header: 'Total', kind: 'number', align: 'end', sortable: true },
            ],
            rows: [
              { id: 'o1', cells: { customer: 'Northwind Example', route: 'North', total: '1240' } },
              { id: 'o2', cells: { customer: 'Contoso Example', route: 'Harbor', total: '310' } },
              { id: 'o3', cells: { customer: 'Lumen Example', route: 'East', total: '875' } },
            ],
          },
        },
      },
      {
        id: 'workflow',
        title: 'Expense approval',
        layout: 'component',
        component: {
          component: 'workflow-graph',
          props: {
            label: 'Expense approval',
            mode: 'view',
            graph: {
              version: 1,
              cycles: 'forbid',
              nodeTypes: [
                {
                  id: 'step',
                  label: 'Step',
                  ports: [
                    { id: 'in', direction: 'in' },
                    { id: 'out', direction: 'out', multiple: true },
                  ],
                },
              ],
              nodes: [
                { id: 'ask', type: 'step', label: 'Request', position: { x: 0, y: 0 } },
                { id: 'review', type: 'step', label: 'Review', position: { x: 260, y: 0 } },
                { id: 'paid', type: 'step', label: 'Paid', position: { x: 520, y: 0 } },
              ],
              edges: [
                {
                  id: 'e1',
                  from: { node: 'ask', port: 'out' },
                  to: { node: 'review', port: 'in' },
                },
                {
                  id: 'e2',
                  from: { node: 'review', port: 'out' },
                  to: { node: 'paid', port: 'in' },
                },
              ],
            },
          },
        },
      },
      {
        id: 'sortable',
        title: 'This week',
        layout: 'free',
        blocks: [
          { type: 'heading', level: 2, text: 'Rank this week’s work' },
          {
            type: 'component',
            component: 'sortable-list',
            props: {
              label: 'This week',
              reorder: { bind: { $state: 'priorities' }, axis: 'vertical' },
              $declare: {
                priorities: {
                  type: 'list',
                  initial: [
                    { id: 'notes', label: 'Write the launch notes' },
                    { id: 'pricing', label: 'Refresh the pricing page' },
                    { id: 'status', label: 'Check the status page' },
                  ],
                },
              },
            },
          },
        ],
      },
    ],
  };
}
