<script lang="ts">
// The read-only reader core: the same document the editor edits, rendered as
// an article with anchored headings and an "On this page" outline. Embeds
// load the player through the host's `loadPlayer` (G123), and a design
// system's `texuli:<theme>` bases load through the host's `loadLibraryBase`
// (G127); `PageReader` is this component with the default loaders.
import type { TexuliDocument } from '@texuli/document/model';
import type { DeckPlayerHost } from '@texuli/player';
import { untrack } from 'svelte';
import Breadcrumb from '../shared/Breadcrumb.svelte';
import { blockPainter, type PagesBlockHost, type PagesBlockSnippet } from '../shared/block-host.ts';
import type {
  PagesDesignSystemEvent,
  PagesDesignSystems,
  PagesLibraryBaseLoader,
} from '../shared/design-system-types.ts';
import type { EmbedResolver } from '../shared/embeds.ts';
import { type PagesLabels, resolvePagesLabels } from '../shared/labels.ts';
import type { MediaResolver } from '../shared/media.ts';
import type { PagesPlayerLoader } from '../shared/player-loader.ts';
import type { PageRef } from '../shared/types.ts';
import { documentOutline } from './outline.ts';
import ReaderBlocks from './ReaderBlocks.svelte';
import '../styles.css';

interface Props {
  /** The document (validated: `loadUntrustedDocument` from `@texuli/document/schema`). */
  document: TexuliDocument;
  labels?: Partial<PagesLabels>;
  /** Show the headings outline when the document has at least `outlineMin` headings (default 2; `false` hides it). */
  outline?: boolean;
  outlineMin?: number;
  /** Prefix for heading anchors, so two readers on one page never share an id. */
  anchorPrefix?: string;
  /** Added to every heading level (1 makes a level-1 heading an `h2`). */
  headingOffset?: number;
  trail?: readonly PageRef[];
  onNavigate?: (ref: string) => void;
  pageHref?: (ref: string) => string | null | undefined;
  resolveEmbed?: EmbedResolver;
  resolveMedia?: MediaResolver;
  deckHost?: DeckPlayerHost | null;
  /** Paint embeds without motion. */
  reducedMotion?: boolean;
  /**
   * The document's design system (spec 0.10.0): the host's resolver for a
   * `ref` (the reader never fetches), the mode and the inline trust level.
   * A document with one loads the compiler lazily and applies the result to
   * the article; one without pays nothing. A refusal keeps the default
   * theme and shows a notice.
   */
  designSystems?: PagesDesignSystems | null;
  onDesignSystem?: (event: PagesDesignSystemEvent) => void;
  /**
   * The host's own blocks (G111): a snippet handed each wrapped block or
   * embed the host claims, read-only. Host code is developer-tier; the node
   * may come from a user or an agent. See `blockHost`.
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
  /**
   * Loads a design system's `texuli:<theme>` reference or `extends` base
   * that `designSystems.resolve` leaves `undefined` (G127). On this core
   * component there is no default: without one such a design system is
   * refused (`design-system-unresolved`, the reader keeps its theme with a
   * notice), and the build has no reference to the token theme library.
   * Pass `loadPagesLibraryBase` to load the library on first use.
   */
  loadLibraryBase?: PagesLibraryBaseLoader | null;
  class?: string;
}

let {
  document: doc,
  labels: labelOverrides,
  outline = true,
  outlineMin = 2,
  anchorPrefix = '',
  headingOffset = 0,
  trail = [],
  onNavigate,
  pageHref,
  resolveEmbed,
  resolveMedia,
  deckHost = null,
  reducedMotion = false,
  designSystems = null,
  onDesignSystem,
  renderBlock,
  blockHost = null,
  loadPlayer = null,
  loadLibraryBase = null,
  class: className,
}: Props = $props();

const painter = $derived(blockPainter(blockHost, renderBlock));

const labels = $derived(resolvePagesLabels(labelOverrides));
const entries = $derived(documentOutline(doc, { prefix: anchorPrefix }));
const anchors = $derived(new Map(entries.map((entry) => [entry.id, entry.anchor])));
const title = $derived(doc.meta.title);

// Spec 0.10.0: the document's design system, loaded only when it names one.
let element = $state<HTMLElement | null>(null);
let systemStatus = $state<'pending' | 'applied' | 'refused' | undefined>();
const systemKey = $derived(doc.designSystem ? JSON.stringify(doc.designSystem) : '');
let disposeSystem: (() => void) | undefined;
const dropSystem = () => {
  disposeSystem?.();
  disposeSystem = undefined;
};
$effect(() => {
  const key = systemKey;
  const target = element;
  const reference = untrack(() => doc.designSystem);
  const host = untrack(() => designSystems);
  const libraryBase = untrack(() => loadLibraryBase);
  void designSystems?.mode;
  if (!key || !target || !reference) {
    dropSystem();
    systemStatus = undefined;
    return;
  }
  let live = true;
  systemStatus = 'pending';
  import('../shared/design-system.ts')
    .then((step) => step.applyPagesDesignSystem(target, reference, host, libraryBase))
    .then(
      ({ event, dispose }) => {
        if (!live) return dispose?.();
        dropSystem();
        disposeSystem = dispose;
        systemStatus = event.status;
        untrack(() => onDesignSystem?.(event));
      },
      (error: unknown) => {
        if (!live) return;
        // The step never rejects; a chunk that fails to load still replaces the old system.
        dropSystem();
        systemStatus = 'refused';
        const message = error instanceof Error ? error.message.slice(0, 200) : 'Refused.';
        untrack(() =>
          onDesignSystem?.({
            status: 'refused',
            code: 'design-system-refused',
            path: '$.designSystem',
            message,
          })
        );
      }
    );
  return () => {
    live = false;
  };
});
$effect(() => () => disposeSystem?.());
</script>

<article
  bind:this={element}
  class={['tx-pages', 'tx-pages-reader', className]}
  data-tx-pages-design-system={systemStatus}
  aria-label={title || labels.reader}
  {...(doc.meta.locale ? { lang: doc.meta.locale } : {})}
  {...(doc.meta.dir ? { dir: doc.meta.dir } : {})}
>
  {#if systemStatus === 'refused'}
    <p class="tx-pages-reader__notice" role="status" data-tx-pages-design-system-notice>
      {labels.designSystemRefused}
    </p>
  {/if}
  {#if trail.length > 0}
    <Breadcrumb {trail} current={title} label={labels.breadcrumb} {onNavigate} {pageHref} />
  {/if}
  {#if outline && entries.length >= outlineMin}
    <nav class="tx-pages-outline" aria-label={labels.outline}>
      <ol>
        {#each entries as entry (entry.anchor)}
          <li data-level={entry.level}><a href={`#${entry.anchor}`}>{entry.text}</a></li>
        {/each}
      </ol>
    </nav>
  {/if}
  <div class="tx-pages-reader__body">
    <ReaderBlocks
      blocks={doc.blocks}
      {labels}
      {anchors}
      {headingOffset}
      {resolveEmbed}
      {resolveMedia}
      {deckHost}
      {onNavigate}
      {pageHref}
      {reducedMotion}
      {painter}
      {loadPlayer}
    />
  </div>
</article>
