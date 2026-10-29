<script lang="ts">
// The read-only reader: the same document the editor edits, rendered as an
// article with anchored headings and an "On this page" outline.
import type { TexuliDocument } from '@texuli/document/model';
import type { DeckPlayerHost } from '@texuli/player';
import Breadcrumb from '../shared/Breadcrumb.svelte';
import type { EmbedResolver } from '../shared/embeds.ts';
import { type PagesLabels, resolvePagesLabels } from '../shared/labels.ts';
import type { MediaResolver } from '../shared/media.ts';
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
  class: className,
}: Props = $props();

const labels = $derived(resolvePagesLabels(labelOverrides));
const entries = $derived(documentOutline(doc, { prefix: anchorPrefix }));
const anchors = $derived(new Map(entries.map((entry) => [entry.id, entry.anchor])));
const title = $derived(doc.meta.title);
</script>

<article
  class={['tx-pages', 'tx-pages-reader', className]}
  aria-label={title || labels.reader}
  {...(doc.meta.locale ? { lang: doc.meta.locale } : {})}
  {...(doc.meta.dir ? { dir: doc.meta.dir } : {})}
>
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
    />
  </div>
</article>
