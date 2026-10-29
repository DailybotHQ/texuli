/**
 * The slash menu's closed vocabulary: every block type a person can insert,
 * as data (`SlashItem`), and the filter the menu runs as they type.
 * Framework-free. Content block items (every `@texuli/blocks` family) come
 * from the blocks catalog, which loads on first use (`loadBlockItems`).
 */
import type {
  BlockFamily,
  DocumentBlock,
  DocumentIdSource,
  DocumentJsonObject,
} from '@texuli/document/model';
import type { PagesLabels } from '../shared/labels.ts';
import type { PageRef } from '../shared/types.ts';

export type SlashGroup = 'text' | 'layout' | 'pages' | 'embeds' | 'blocks';

export type { PageRef } from '../shared/types.ts';

export interface SlashItem {
  /** Unique within the menu. */
  value: string;
  label: string;
  group: SlashGroup;
  /** Extra words the filter matches (English defaults plus the type name). */
  keywords: readonly string[];
  /**
   * Build the new block with fresh ids. `page` is the host's new page (page
   * link items only); `null` means nothing is inserted.
   */
  create: (newId: DocumentIdSource, page?: PageRef) => DocumentBlock | null;
  /** True for the page item: the host creates the page first. */
  needsPage?: boolean;
}

/** A catalog component a host offers in the menu (a one-node blueprint). */
export interface ComponentEmbedOption {
  /** The catalog component id, e.g. `charts-line`. */
  id: string;
  label: string;
  title?: string;
  props?: DocumentJsonObject;
  keywords?: readonly string[];
}

const paragraph = (newId: DocumentIdSource): DocumentBlock => ({
  id: newId(),
  type: 'paragraph',
  content: [],
});

/** Fictional sample data for the default component embeds (validated by a test). */
export const DEFAULT_COMPONENT_EMBEDS: readonly ComponentEmbedOption[] = Object.freeze<
  ComponentEmbedOption[]
>([
  {
    id: 'charts-line',
    label: 'Line chart',
    title: 'Tickets per day',
    keywords: ['chart', 'graph', 'trend'],
    props: {
      title: 'Tickets per day',
      description: 'Opened tickets per day (fictional)',
      series: [
        {
          id: 'opened',
          label: 'Opened',
          points: [
            { x: 'Mon', y: 21 },
            { x: 'Tue', y: 19 },
            { x: 'Wed', y: 24 },
            { x: 'Thu', y: 17 },
            { x: 'Fri', y: 15 },
          ],
        },
      ],
    },
  },
  {
    id: 'charts-donut',
    label: 'Donut chart',
    title: 'Tickets by channel',
    keywords: ['chart', 'pie', 'share'],
    props: {
      title: 'Tickets by channel',
      description: 'Share of tickets by channel (fictional)',
      data: [
        { id: 'email', label: 'Email', value: 54 },
        { id: 'chat', label: 'Chat', value: 48 },
        { id: 'phone', label: 'Phone', value: 25 },
      ],
      labels: { table: 'Data table', category: 'Channel', value: 'Tickets' },
    },
  },
  {
    id: 'data-grid',
    label: 'Table',
    title: 'Accounts',
    keywords: ['table', 'grid', 'rows'],
    props: {
      caption: 'Accounts (fictional)',
      columns: [
        { id: 'account', header: 'Account' },
        { id: 'region', header: 'Region' },
      ],
      rows: [
        { id: 'r1', account: 'Northwind Labs', region: 'North' },
        { id: 'r2', account: 'Example Corp', region: 'South' },
      ],
    },
  },
]);

/** A two-slide deck (deck model v2, fictional) for the deck item. */
export const SAMPLE_DECK: DocumentJsonObject = Object.freeze({
  formatVersion: 2,
  meta: { title: 'Launch plan' },
  slides: [
    { id: 's1', layout: 'title-hero', props: { title: 'Launch plan' } },
    { id: 's2', layout: 'title-hero', props: { title: 'Questions' } },
  ],
}) as DocumentJsonObject;

/** The built-in items: text, layout, pages and embeds. */
export function coreSlashItems(
  labels: PagesLabels,
  options: { components?: readonly ComponentEmbedOption[]; pages?: boolean } = {}
): SlashItem[] {
  const name = labels.blockType;
  const items: SlashItem[] = [
    {
      value: 'paragraph',
      label: name('paragraph'),
      group: 'text',
      keywords: ['text', 'plain'],
      create: paragraph,
    },
    ...([1, 2, 3] as const).map(
      (level): SlashItem => ({
        value: `heading-${level}`,
        label: name('heading', String(level)),
        group: 'text',
        keywords: ['heading', 'title', `h${level}`],
        create: (newId) => ({ id: newId(), type: 'heading', level, content: [] }),
      })
    ),
    ...(
      [
        ['bullet', 'Bulleted list', ['bullet', 'unordered', 'ul']],
        ['ordered', 'Numbered list', ['numbered', 'ordered', 'ol']],
        ['todo', 'To-do list', ['todo', 'task', 'checkbox', 'check']],
      ] as const
    ).map(
      ([kind, label, keywords]): SlashItem => ({
        value: `list-${kind}`,
        label,
        group: 'text',
        keywords: ['list', ...keywords],
        create: (newId) => ({
          id: newId(),
          type: 'list',
          kind,
          items: [
            {
              id: newId(),
              ...(kind === 'todo' ? { checked: false } : {}),
              blocks: [paragraph(newId)],
            },
          ],
        }),
      })
    ),
    {
      value: 'quote',
      label: name('quote'),
      group: 'text',
      keywords: ['quote', 'blockquote', 'citation'],
      create: (newId) => ({ id: newId(), type: 'quote', blocks: [paragraph(newId)] }),
    },
    {
      value: 'code',
      label: name('code'),
      group: 'text',
      keywords: ['code', 'snippet', 'pre'],
      create: (newId) => ({ id: newId(), type: 'code', text: '' }),
    },
    {
      value: 'divider',
      label: name('divider'),
      group: 'text',
      keywords: ['divider', 'rule', 'separator', 'hr'],
      create: (newId) => ({ id: newId(), type: 'divider' }),
    },
    {
      value: 'callout',
      label: name('callout'),
      group: 'layout',
      keywords: ['callout', 'note', 'info', 'warning'],
      create: (newId) => ({
        id: newId(),
        type: 'callout',
        tone: 'info',
        blocks: [paragraph(newId)],
      }),
    },
    {
      value: 'toggle',
      label: name('toggle'),
      group: 'layout',
      keywords: ['toggle', 'details', 'disclosure', 'collapse'],
      create: (newId) => ({
        id: newId(),
        type: 'toggle',
        summary: [],
        open: true,
        blocks: [paragraph(newId)],
      }),
    },
    ...([2, 3] as const).map(
      (count): SlashItem => ({
        value: `columns-${count}`,
        label: name('columns', String(count)),
        group: 'layout',
        keywords: ['columns', 'layout', 'side by side', `${count}`],
        create: (newId) => ({
          id: newId(),
          type: 'columns',
          columns: Array.from({ length: count }, () => ({
            id: newId(),
            type: 'column' as const,
            width: 12 / count,
            blocks: [paragraph(newId)],
          })),
        }),
      })
    ),
  ];
  if (options.pages)
    items.push({
      value: 'page',
      label: name('page-link'),
      group: 'pages',
      keywords: ['page', 'subpage', 'nested', 'link'],
      needsPage: true,
      create: (newId, page) =>
        page ? { id: newId(), type: 'page-link', ref: page.ref, title: page.title } : null,
    });
  for (const component of options.components ?? DEFAULT_COMPONENT_EMBEDS)
    items.push({
      value: `component:${component.id}`,
      label: component.label,
      group: 'embeds',
      keywords: ['embed', 'component', component.id, ...(component.keywords ?? [])],
      create: (newId) => ({
        id: newId(),
        type: 'embed',
        kind: 'component',
        title: component.title ?? component.label,
        inline: {
          id: component.id,
          ...(component.props ? { props: structuredClone(component.props) } : {}),
        },
      }),
    });
  items.push({
    value: 'deck',
    label: name('embed', 'deck'),
    group: 'embeds',
    keywords: ['deck', 'slides', 'presentation', 'embed'],
    create: (newId) => ({
      id: newId(),
      type: 'embed',
      kind: 'deck',
      title: 'Launch plan',
      inline: structuredClone(SAMPLE_DECK) as DocumentJsonObject,
    }),
  });
  return items;
}

/** One `@texuli/blocks` catalog entry, as the slash menu reads it. */
export interface BlockCatalogLike {
  type: string;
  label: string;
  family: string;
  exampleMinimal: unknown;
}

/**
 * Samples for the `@texuli/blocks` families the blocks catalog metadata
 * does not list yet (diagram, interactive, map, embed); a test checks each
 * against its family validator. Fictional data only.
 */
export const EXTRA_BLOCK_SAMPLES: readonly BlockCatalogLike[] = Object.freeze([
  {
    type: 'flow',
    label: 'Flow diagram',
    family: 'diagram',
    exampleMinimal: {
      type: 'flow',
      nodes: [
        { id: 'brief', label: 'Collect brief' },
        { id: 'ship', label: 'Ship prototype' },
      ],
    },
  },
  {
    type: 'terminal',
    label: 'Terminal',
    family: 'diagram',
    exampleMinimal: {
      type: 'terminal',
      lines: [
        { kind: 'prompt', text: 'pnpm build' },
        { kind: 'output', text: 'done' },
      ],
    },
  },
  {
    type: 'poll',
    label: 'Poll',
    family: 'interactive',
    exampleMinimal: {
      type: 'poll',
      id: 'poll',
      question: 'Which fictional harbor is busiest?',
      options: [
        { id: 'north', label: 'North Pier' },
        { id: 'south', label: 'South Basin' },
      ],
    },
  },
  {
    type: 'checklist',
    label: 'Checklist',
    family: 'interactive',
    exampleMinimal: {
      type: 'checklist',
      title: 'Launch checklist',
      items: [
        { id: 'fuel', label: 'Check fuel' },
        { id: 'lines', label: 'Secure lines' },
      ],
    },
  },
  {
    type: 'map',
    label: 'Map',
    family: 'map',
    exampleMinimal: {
      type: 'map',
      label: 'North Pier depot',
      points: [{ id: 'depot', label: 'North Pier depot', lng: 0, lat: 0 }],
    },
  },
  {
    type: 'link-preview',
    label: 'Link preview',
    family: 'embed',
    exampleMinimal: {
      type: 'link-preview',
      href: 'https://example.com/guide',
      title: 'Guide',
      description: 'Read the guide',
    },
  },
]);

/** Slash items for every `@texuli/blocks` block type (every family). */
export function blockSlashItems(catalog: readonly BlockCatalogLike[]): SlashItem[] {
  const seen = new Set<string>();
  const items: SlashItem[] = [];
  for (const entry of [...catalog, ...EXTRA_BLOCK_SAMPLES]) {
    const example = entry.exampleMinimal;
    if (seen.has(entry.type) || example === null || typeof example !== 'object') continue;
    seen.add(entry.type);
    const { type: _type, ...props } = example as Record<string, unknown>;
    items.push({
      value: `block:${entry.type}`,
      label: entry.label,
      group: 'blocks',
      keywords: ['block', entry.family, entry.type],
      create: (newId) => ({
        id: newId(),
        type: 'block',
        family: entry.family as BlockFamily,
        block: entry.type,
        props: structuredClone(props) as DocumentJsonObject,
      }),
    });
  }
  return items;
}

let blockItems: Promise<SlashItem[]> | null = null;

/** Load the content block items once (the blocks catalog is its own chunk). */
export function loadBlockItems(): Promise<SlashItem[]> {
  blockItems ??= import('@texuli/blocks/core').then(
    (module) => blockSlashItems(module.BLOCK_CATALOG as readonly BlockCatalogLike[]),
    () => {
      blockItems = null;
      return [];
    }
  );
  return blockItems;
}

/** Lower case, decomposed, combining marks removed: "Título" matches "titulo". */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

/**
 * The items that match `query` (every word must appear in the label or a
 * keyword), best first: label prefix, then a word start, then the rest, in
 * menu order within each rank. Linear in the items and their words.
 */
export function filterSlashItems(items: readonly SlashItem[], query: string): SlashItem[] {
  const words = foldText(query).trim().split(/\s+/).filter(Boolean).slice(0, 8);
  if (words.length === 0) return [...items];
  const ranked: { item: SlashItem; rank: number; order: number }[] = [];
  items.forEach((item, order) => {
    const label = foldText(item.label);
    const haystack = `${label} ${item.keywords.map(foldText).join(' ')}`;
    if (!words.every((word) => haystack.includes(word))) return;
    const first = words[0] as string;
    const rank = label.startsWith(first)
      ? 0
      : label.split(/[\s-]+/).some((part) => part.startsWith(first))
        ? 1
        : 2;
    ranked.push({ item, rank, order });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return ranked.map((entry) => entry.item);
}
