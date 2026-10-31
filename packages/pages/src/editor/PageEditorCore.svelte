<script lang="ts">
// The page editor core: a document of blocks edited through
// `@texuli/document` operations. Text rows use `@texuli/editor`; blocks
// drag and move by keyboard through `@texuli/primitives/sortable` on
// `@texuli/drag`; `/` opens the slash menu; embeds are painted by
// `@texuli/player` at the untrusted tier, loaded through the host's
// `loadPlayer` (G123). `PageEditor` is this component with the default
// loader.
import type { DocumentBlockId, TexuliDocument } from '@texuli/document/model';
import type { OpLogEntry } from '@texuli/document/ops';
import type { DeckPlayerHost } from '@texuli/player';
import { Sortable, type SortableMove } from '@texuli/primitives/sortable';
import { untrack } from 'svelte';
import type { MotionProp } from 'texuli/motion';
import Breadcrumb from '../shared/Breadcrumb.svelte';
import { blockPainter, type PagesBlockHost, type PagesBlockSnippet } from '../shared/block-host.ts';
import type { EmbedResolver } from '../shared/embeds.ts';
import { type PagesLabels, resolvePagesLabels } from '../shared/labels.ts';
import type { MediaResolver } from '../shared/media.ts';
import type { PagesPlayerLoader } from '../shared/player-loader.ts';
import type { PageRef } from '../shared/types.ts';
import BlockList from './BlockList.svelte';
import { setPagesContext } from './context.ts';
import { blockContainers, parentOfList } from './moves.ts';
import {
  type ComponentEmbedOption,
  coreSlashItems,
  loadBlockItems,
  type SlashItem,
} from './slash.ts';
import { PagesEditor } from './state.svelte.ts';
import '../styles.css';

interface Props {
  /** The document (validated: `loadUntrustedDocument` from `@texuli/document/schema`). A new value from outside restarts history. */
  document: TexuliDocument;
  /** Every accepted change, with the op log entry that made it. */
  onChange?: (doc: TexuliDocument, entry: OpLogEntry) => void;
  /** The editor region's accessible name. Default: the document title. */
  label?: string;
  labels?: Partial<PagesLabels>;
  readonly?: boolean;
  /** Ancestor pages, outermost first; the breadcrumb ends with this document's title. */
  trail?: readonly PageRef[];
  /** A page link or breadcrumb entry was activated. */
  onNavigate?: (ref: string) => void;
  /** An `href` for a page ref (passes `safeHref`); without it page links are buttons. */
  pageHref?: (ref: string) => string | null | undefined;
  /** Create a nested page for the slash menu's page item; without it the item is hidden. */
  createPage?: () => PageRef | null | undefined | Promise<PageRef | null | undefined>;
  /** Resolve `ref` embeds. */
  resolveEmbed?: EmbedResolver;
  /** Resolve media refs to image sources (they pass `safeImageSrc`). */
  resolveMedia?: MediaResolver;
  /** Present deck embeds on a stage (the player's seam; `@texuli/slides` provides the stage). */
  deckHost?: DeckPlayerHost | null;
  /** Catalog components the slash menu offers (default: a line chart, a donut chart and a table). */
  components?: readonly ComponentEmbedOption[];
  /** Layout motion of inserts, removes and reorders (`false` turns it off). */
  motion?: MotionProp;
  /** The editor state, for hosts that drive it (undo, insert, log). */
  editor?: PagesEditor;
  /** Polite announcements. Default: `@texuli/core/announcer`. */
  announce?: (message: string) => void;
  /**
   * The host's own blocks (G111): a snippet handed each wrapped block or
   * embed the host claims, read-only. Host blocks are opaque rows: they
   * select, move and delete from their handle like any block. Host code is
   * developer-tier; the node may come from a user or an agent.
   */
  renderBlock?: PagesBlockSnippet;
  /**
   * The host's block renderer: `claim` (who paints a node: `'host'`,
   * `'fallback'` by default, or `'library'`), and a `component` or a
   * `present` mount when there is no `renderBlock` snippet.
   */
  blockHost?: PagesBlockHost | null;
  /**
   * Loads `@texuli/player` for live embeds (G123). On this core component
   * there is no default: without one, an embed that needs the player shows
   * a notice (or goes to the host's block renderer when it claims the
   * fallback), and the build has no player reference. Pass
   * `() => import('@texuli/player')` to paint them.
   */
  loadPlayer?: PagesPlayerLoader | null;
  class?: string;
}

let {
  document: doc,
  onChange,
  label,
  labels: labelOverrides,
  readonly = false,
  trail = [],
  onNavigate,
  pageHref,
  createPage,
  resolveEmbed,
  resolveMedia,
  deckHost = null,
  components,
  motion,
  editor = $bindable(),
  announce,
  renderBlock,
  blockHost = null,
  loadPlayer = null,
  class: className,
}: Props = $props();

const uid = $props.id();
const labels = $derived(resolvePagesLabels(labelOverrides));
const painter = $derived(blockPainter(blockHost, renderBlock));
const pages = untrack(
  () =>
    new PagesEditor({
      document: doc,
      labels: resolvePagesLabels(labelOverrides),
      ...(announce ? { announce } : {}),
      onChange: (next, entry) => onChange?.(next, entry),
    })
);
editor = pages;

$effect(() => {
  pages.labels = labels;
});

// A new document from outside replaces the session (history restarts).
$effect(() => {
  const next = doc;
  untrack(() => {
    if (next !== pages.doc) pages.load(next);
  });
});

let blockItems = $state.raw<SlashItem[]>([]);
const items = $derived([
  ...coreSlashItems(labels, { components, pages: Boolean(createPage) }),
  ...blockItems,
]);

// The content block items (every @texuli/blocks family) load once a menu opens.
$effect(() => {
  if (!pages.slash || blockItems.length > 0) return;
  let live = true;
  loadBlockItems().then((loaded) => {
    if (live) blockItems = loaded;
  });
  return () => {
    live = false;
  };
});

setPagesContext({
  editor: pages,
  helpId: `${uid}-help`,
  items: () => items,
  readonly: () => readonly,
  motion: () => motion,
  painter: () => painter,
  loadPlayer: () => loadPlayer,
  get resolveEmbed() {
    return resolveEmbed;
  },
  get resolveMedia() {
    return resolveMedia;
  },
  get deckHost() {
    return deckHost;
  },
  get onNavigate() {
    return onNavigate;
  },
  get pageHref() {
    return pageHref;
  },
  get createPage() {
    return createPage;
  },
});

const containers = $derived(
  blockContainers(pages.doc).map((container) =>
    readonly ? { ...container, disabled: true } : container
  )
);
const title = $derived(pages.doc.meta.title);

function onmove(move: SortableMove): boolean {
  const moved = move.items[0];
  if (!moved || move.kind !== 'move' || readonly) return false;
  pages.moveTo(moved.id, parentOfList(move.to), move.index, { quiet: true });
  pages.select(moved.id as DocumentBlockId);
  return false;
}
</script>

<section
  class={['tx-pages', 'tx-pages-editor', className]}
  aria-label={label ?? (title || labels.editor)}
  data-readonly={readonly ? '' : undefined}
  {...(pages.doc.meta.locale ? { lang: pages.doc.meta.locale } : {})}
  {...(pages.doc.meta.dir ? { dir: pages.doc.meta.dir } : {})}
>
  {#if trail.length > 0}
    <Breadcrumb {trail} current={title} label={labels.breadcrumb} {onNavigate} {pageHref} />
  {/if}
  {#if !readonly}
    <div class="tx-pages-actions">
      <button type="button" class="tx-pages-action" aria-disabled={!pages.canUndo} onclick={() => pages.undo()}>{labels.undo}</button>
      <button type="button" class="tx-pages-action" aria-disabled={!pages.canRedo} onclick={() => pages.redo()}>{labels.redo}</button>
    </div>
  {/if}
  <p id={`${uid}-help`} hidden>{labels.handleHelp}</p>
  <Sortable.Root
    class="tx-pages-blocks"
    {containers}
    crossContainers
    preview="overlay"
    onMove={onmove}
    {...announce ? { announce } : {}}
  >
    <BlockList parent={null} blocks={pages.doc.blocks} label={title || labels.editor} />
  </Sortable.Root>
</section>
