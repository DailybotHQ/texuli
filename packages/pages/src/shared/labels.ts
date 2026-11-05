/**
 * Every visible and announced string of the page editor and reader. Hosts
 * pass a partial object to translate; functions build sentences so word
 * order stays the translator's.
 */
import { englishMessages, type MessageLookup } from '@texuli/core/i18n';
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
  /** A list kind's slash menu name ("Bulleted list"). */
  listKind: (kind: 'bullet' | 'ordered' | 'todo') => string;
  /** A content block's slash menu name; `english` is the blocks catalog name. */
  contentBlock: (type: string, english: string) => string;
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

/**
 * The label set for one message lookup (ADR-026): every string resolves as
 * `messages('pages.<id>', english, values)`, so the label dictionary in
 * context translates it (ids in `PAGES_MESSAGES_EN`, `{name}` placeholders,
 * so word order stays the translator's). Block and embed names are their
 * own ids (`pages.type-names.paragraph`), and a content block's slash name
 * is `pages.content-block.<type>`. With `englishMessages` it is
 * `DEFAULT_PAGES_LABELS`.
 */
export function pagesLabelsFor(messages: MessageLookup): PagesLabels {
  const m = messages;
  const type = (name: DocumentBlockType) => m(`pages.type-names.${name}`, TYPE_NAMES[name]);
  const kind = (name: EmbedKind) => m(`pages.embed-names.${name}`, EMBED_NAMES[name]);
  return {
    editor: m('pages.editor', 'Page editor'),
    reader: m('pages.reader', 'Page'),
    breadcrumb: m('pages.breadcrumb', 'Breadcrumb'),
    outline: m('pages.outline', 'On this page'),
    designSystemRefused: m(
      'pages.design-system-refused',
      'The design system could not be applied. Showing the default theme.'
    ),
    blockType: (name, detail) =>
      detail
        ? m('pages.block-type-detail', '{type} {detail}', { type: type(name), detail })
        : type(name),
    handle: (name, excerpt) =>
      excerpt ? m('pages.handle', '{type}: {excerpt}', { type: name, excerpt }) : name,
    handleHelp: m(
      'pages.handle-help',
      'Press Space or Enter to pick the block up, the arrow keys to move it, Space or Enter to drop it and Escape to cancel. Alt+Up and Alt+Down move it at once. Delete removes it.'
    ),
    insertBelow: m('pages.insert-below', 'Insert a block below'),
    slashMenu: m('pages.slash-menu', 'Insert block'),
    slashFilter: m('pages.slash-filter', 'Filter block types'),
    slashEmpty: m('pages.slash-empty', 'No block type matches.'),
    slashGroups: {
      text: m('pages.slash-groups.text', 'Text'),
      layout: m('pages.slash-groups.layout', 'Layout'),
      pages: m('pages.slash-groups.pages', 'Pages'),
      embeds: m('pages.slash-groups.embeds', 'Embeds'),
      blocks: m('pages.slash-groups.blocks', 'Content blocks'),
    },
    listKind: (name) => m(`pages.list-kinds.${name}`, LIST_NAMES[name]),
    contentBlock: (name, english) => m(`pages.content-block.${name}`, english),
    textRow: (name) => name,
    toggleSummary: m('pages.toggle-summary', 'Toggle summary'),
    calloutTitle: m('pages.callout-title', 'Callout title'),
    columnsResize: (index) =>
      m('pages.columns-resize', 'Resize columns {index} and {next}', { index, next: index + 1 }),
    column: (index, count) => m('pages.column', 'Column {index} of {count}', { index, count }),
    openPage: (title) => m('pages.open-page', 'Open page {title}', { title }),
    embed: (name, title) =>
      title ? m('pages.embed-titled', '{kind}: {title}', { kind: kind(name), title }) : kind(name),
    untrusted: m('pages.untrusted', 'Untrusted content'),
    refused: m('pages.refused', 'This embed was refused: it did not pass validation.'),
    embedLoading: m('pages.embed-loading', 'Loading the embed'),
    embedUnavailable: (name) =>
      m(
        'pages.embed-unavailable',
        '{kind} embeds are not available here yet; the reference is kept.',
        { kind: kind(name) }
      ),
    embedOff: (name) =>
      m('pages.embed-off', '{kind} embeds are not shown here; the embed is kept.', {
        kind: kind(name),
      }),
    blockRefused: m('pages.block-refused', 'This block was refused: it did not pass validation.'),
    mediaFallback: (alt) =>
      alt
        ? m('pages.media-fallback-alt', 'Image: {alt}', { alt })
        : m('pages.media-fallback', 'Image unavailable'),
    done: m('pages.done', 'Done'),
    notDone: m('pages.not-done', 'Not done'),
    undo: m('pages.undo', 'Undo'),
    redo: m('pages.redo', 'Redo'),
    inserted: (name) => m('pages.inserted', '{type} inserted.', { type: name }),
    removed: (name) => m('pages.removed', '{type} removed.', { type: name }),
    moved: (label, position, total) =>
      m('pages.moved', '{label} moved to position {position} of {total}.', {
        label,
        position,
        total,
      }),
    cannotMove: (label) => m('pages.cannot-move', '{label} cannot move further.', { label }),
    resized: (index, width) =>
      m('pages.resized', 'Column {index} is {width} of 12 wide.', { index, width }),
    undone: m('pages.undone', 'Undone.'),
    redone: m('pages.redone', 'Redone.'),
    nothingToUndo: m('pages.nothing-to-undo', 'Nothing to undo.'),
    editRefused: (reason) => m('pages.edit-refused', 'Edit refused: {reason}', { reason }),
  };
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

const LIST_NAMES = { bullet: 'Bulleted list', ordered: 'Numbered list', todo: 'To-do list' };

export const DEFAULT_PAGES_LABELS: PagesLabels = pagesLabelsFor(englishMessages);

/** Merge partial labels over the English defaults; empty strings never replace a default. */
export function resolvePagesLabels(
  overrides?: Partial<PagesLabels>,
  /** The defaults to merge over (`localizePagesLabels(useMessages())` in the views). */
  defaults: PagesLabels = DEFAULT_PAGES_LABELS
): PagesLabels {
  const out: PagesLabels = { ...defaults };
  if (!overrides) return out;
  for (const [key, value] of Object.entries(overrides) as [keyof PagesLabels, unknown][]) {
    if (value === undefined || value === '' || value === null) continue;
    if (key === 'slashGroups' && typeof value === 'object') {
      out.slashGroups = { ...defaults.slashGroups, ...(value as object) };
      continue;
    }
    (out as unknown as Record<string, unknown>)[key] = value;
  }
  return out;
}
