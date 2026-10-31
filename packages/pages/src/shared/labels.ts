/**
 * Every visible and announced string of the page editor and reader. Hosts
 * pass a partial object to translate; functions build sentences so word
 * order stays the translator's.
 */
import type { DocumentBlockType, EmbedKind } from '@texuli/document/model';

export interface PagesLabels {
  /** The editor region's name when the host gives none. */
  editor: string;
  /** The reader's article name when the document has no title. */
  reader: string;
  breadcrumb: string;
  /** The reader's headings outline. */
  outline: string;
  /** Shown when the document's design system (spec 0.10.0) is not resolved or is refused. */
  designSystemRefused: string;
  /** A block type's spoken name (`paragraph` → "Paragraph"). */
  blockType: (type: DocumentBlockType, detail?: string) => string;
  /** The drag handle's name: block type and a short excerpt. */
  handle: (type: string, excerpt: string) => string;
  /** The keyboard help every handle is described by. */
  handleHelp: string;
  insertBelow: string;
  // Slash menu
  slashMenu: string;
  slashFilter: string;
  slashEmpty: string;
  slashGroups: { text: string; layout: string; pages: string; embeds: string; blocks: string };
  // Text rows
  textRow: (type: string) => string;
  toggleSummary: string;
  calloutTitle: string;
  columnsResize: (index: number) => string;
  column: (index: number, count: number) => string;
  // Pages and embeds
  openPage: (title: string) => string;
  embed: (kind: EmbedKind, title: string) => string;
  untrusted: string;
  refused: string;
  embedLoading: string;
  embedUnavailable: (kind: EmbedKind) => string;
  /** An embed that needs the player where the host turned live embeds off (no `loadPlayer`, G123). */
  embedOff: (kind: EmbedKind) => string;
  blockRefused: string;
  mediaFallback: (alt: string) => string;
  /** Todo items in the reader. */
  done: string;
  notDone: string;
  // Undo
  undo: string;
  redo: string;
  // Announcements
  inserted: (type: string) => string;
  removed: (type: string) => string;
  moved: (label: string, position: number, total: number) => string;
  cannotMove: (label: string) => string;
  resized: (index: number, width: number) => string;
  undone: string;
  redone: string;
  nothingToUndo: string;
  editRefused: (reason: string) => string;
}

const TYPE_NAMES: Record<DocumentBlockType, string> = {
  paragraph: 'Paragraph',
  heading: 'Heading',
  code: 'Code',
  list: 'List',
  quote: 'Quote',
  divider: 'Divider',
  media: 'Image',
  callout: 'Callout',
  toggle: 'Toggle',
  columns: 'Columns',
  'page-link': 'Page',
  block: 'Block',
  embed: 'Embed',
};

const EMBED_NAMES: Record<EmbedKind, string> = {
  component: 'Component',
  deck: 'Deck',
  sheet: 'Sheet',
  canvas: 'Canvas',
};

export const DEFAULT_PAGES_LABELS: PagesLabels = {
  editor: 'Page editor',
  reader: 'Page',
  breadcrumb: 'Breadcrumb',
  outline: 'On this page',
  designSystemRefused: 'The design system could not be applied. Showing the default theme.',
  blockType: (type, detail) => (detail ? `${TYPE_NAMES[type]} ${detail}` : TYPE_NAMES[type]),
  handle: (type, excerpt) => (excerpt ? `${type}: ${excerpt}` : type),
  handleHelp:
    'Press Space or Enter to pick the block up, the arrow keys to move it, Space or Enter to drop it and Escape to cancel. Alt+Up and Alt+Down move it at once. Delete removes it.',
  insertBelow: 'Insert a block below',
  slashMenu: 'Insert block',
  slashFilter: 'Filter block types',
  slashEmpty: 'No block type matches.',
  slashGroups: {
    text: 'Text',
    layout: 'Layout',
    pages: 'Pages',
    embeds: 'Embeds',
    blocks: 'Content blocks',
  },
  textRow: (type) => type,
  toggleSummary: 'Toggle summary',
  calloutTitle: 'Callout title',
  columnsResize: (index) => `Resize columns ${index} and ${index + 1}`,
  column: (index, count) => `Column ${index} of ${count}`,
  openPage: (title) => `Open page ${title}`,
  embed: (kind, title) => (title ? `${EMBED_NAMES[kind]}: ${title}` : EMBED_NAMES[kind]),
  untrusted: 'Untrusted content',
  refused: 'This embed was refused: it did not pass validation.',
  embedLoading: 'Loading the embed',
  embedUnavailable: (kind) =>
    `${EMBED_NAMES[kind]} embeds are not available here yet; the reference is kept.`,
  embedOff: (kind) => `${EMBED_NAMES[kind]} embeds are not shown here; the embed is kept.`,
  blockRefused: 'This block was refused: it did not pass validation.',
  mediaFallback: (alt) => (alt ? `Image: ${alt}` : 'Image unavailable'),
  done: 'Done',
  notDone: 'Not done',
  undo: 'Undo',
  redo: 'Redo',
  inserted: (type) => `${type} inserted.`,
  removed: (type) => `${type} removed.`,
  moved: (label, position, total) => `${label} moved to position ${position} of ${total}.`,
  cannotMove: (label) => `${label} cannot move further.`,
  resized: (index, width) => `Column ${index} is ${width} of 12 wide.`,
  undone: 'Undone.',
  redone: 'Redone.',
  nothingToUndo: 'Nothing to undo.',
  editRefused: (reason) => `Edit refused: ${reason}`,
};

/** Merge partial labels over the English defaults; empty strings never replace a default. */
export function resolvePagesLabels(overrides?: Partial<PagesLabels>): PagesLabels {
  const out: PagesLabels = { ...DEFAULT_PAGES_LABELS };
  if (!overrides) return out;
  for (const [key, value] of Object.entries(overrides) as [keyof PagesLabels, unknown][]) {
    if (value === undefined || value === '' || value === null) continue;
    if (key === 'slashGroups' && typeof value === 'object') {
      out.slashGroups = { ...DEFAULT_PAGES_LABELS.slashGroups, ...(value as object) };
      continue;
    }
    (out as unknown as Record<string, unknown>)[key] = value;
  }
  return out;
}
