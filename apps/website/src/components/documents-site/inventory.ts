/**
 * The block vocabulary of /documents-page/, read from the packages so the
 * page cannot drift: every block type of `@texuli/document/model`
 * (`DOCUMENT_BLOCK_TYPES`, described in a record keyed by the type, so a
 * new block type fails the type check until the page describes it), the
 * slash menu the editor builds (`coreSlashItems` and the content blocks of
 * `loadBlockItems`), and what each embed kind paints today. Build-time
 * only (the page awaits `slashInventory` in its frontmatter). Checked by
 * apps/website/tests/site-documents.test.ts.
 */
import type { DocumentBlockType, EmbedKind } from '@texuli/document/model';
import {
  coreSlashItems,
  DEFAULT_COMPONENT_EMBEDS,
  loadBlockItems,
  resolvePagesLabels,
  type SlashGroup,
} from '@texuli/pages/editor';

export const BLOCK_NOTES: Readonly<Record<DocumentBlockType, string>> = {
  paragraph: 'Rich text: bold, italic, strikethrough, code, links and host mentions',
  heading: 'Levels 1 to 4; the outline and anchors follow them',
  code: 'Code with a language label',
  list: 'Bulleted, numbered or to-do, with nested items',
  quote: 'A quotation that holds blocks',
  divider: 'A thematic break',
  media: 'An image the host resolves; the URL policy checks it',
  callout: 'A toned box that holds blocks',
  toggle: 'A disclosure that holds blocks',
  columns: 'Two or three resizable columns of blocks',
  'page-link': 'A link to a nested page',
  block: 'Any @texuli/blocks content block (charts, tables, polls, maps…)',
  embed: 'A component, a deck, a sheet or a canvas',
};

export interface EmbedStatus {
  readonly kind: EmbedKind;
  readonly paints: string;
}

/** What each embed kind paints in the editor, the reader and the paged view today. */
const EMBEDS: Readonly<Record<EmbedKind, string>> = {
  component:
    'Live: a one-node catalog blueprint the player validates and paints (the chart and table in the handbook).',
  deck: 'Live: the player paints the deck as a document flow; a host can pass deckHost to present it on the slides stage.',
  sheet: 'A typed reference with its title; painting sheets inside a document is planned.',
  canvas:
    'A typed reference with its title; painting canvases inside a document is planned (the canvas itself is on the canvas page).',
};

export const EMBED_STATUSES: readonly EmbedStatus[] = (Object.keys(EMBEDS) as EmbedKind[]).map(
  (kind) => ({ kind, paints: EMBEDS[kind] })
);

export interface SlashEntry {
  readonly group: SlashGroup;
  readonly label: string;
  /** The block type the item inserts (`page-link` for the page item). */
  readonly creates: string;
}

export const SLASH_GROUP_LABELS: Readonly<Record<SlashGroup, string>> = {
  text: 'Text',
  layout: 'Layout',
  pages: 'Pages',
  embeds: 'Embeds',
  blocks: 'Content blocks',
};

/** Every slash menu item, in menu order, with the block type it inserts. */
export async function slashInventory(): Promise<readonly SlashEntry[]> {
  let next = 0;
  const newId = () => {
    next += 1;
    return `inventory-${next}`;
  };
  const core = coreSlashItems(resolvePagesLabels(), {
    components: DEFAULT_COMPONENT_EMBEDS,
    pages: true,
  });
  const blocks = await loadBlockItems();
  return [...core, ...blocks].map((item) => ({
    group: item.group,
    label: item.label,
    creates: item.needsPage
      ? 'page-link'
      : (item.create(newId, { ref: 'pages/inventory', title: 'Inventory' })?.type ?? 'nothing'),
  }));
}
