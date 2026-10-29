<script lang="ts">
// The paged view: the document laid out on real pages (size, orientation,
// margins, explicit breaks, headers and footers with page numbers), on
// screen and in print. Every block renders once off-screen to be measured,
// `@texuli/document/paged` lays the measured blocks onto pages, and each
// page paints its slices. A block split across pages renders whole on its
// first page (clipped) and again, inert, on the next, so assistive
// technology and the tab order meet each block once.
import type { PageSettings, TexuliDocument } from '@texuli/document/model';
import {
  documentPageSettings,
  layoutDocument,
  type PagedLayout,
  type PageSlice,
  PX_PER_PT,
  pageGeometry,
} from '@texuli/document/paged';
import type { DeckPlayerHost } from '@texuli/player';
import { tick } from 'svelte';
import { documentOutline } from '../reader/outline.ts';
import ReaderBlocks from '../reader/ReaderBlocks.svelte';
import type { EmbedResolver } from '../shared/embeds.ts';
import { type PagesLabels, resolvePagesLabels } from '../shared/labels.ts';
import type { MediaResolver } from '../shared/media.ts';
import { type PagedLabels, resolvePagedLabels } from './labels.ts';
import { measureUnit } from './measure.ts';
import { adoptCustomPage, pageName } from './page-style.ts';
import '../styles.css';
import './paged.css';

interface Props {
  /** The document (validated: `loadUntrustedDocument` from `@texuli/document/schema`). */
  document: TexuliDocument;
  /** Override the document's page settings (size, orientation, margins, header, footer, breaks). */
  page?: Partial<PageSettings>;
  labels?: Partial<PagesLabels & PagedLabels>;
  /** Number the pages when the settings have no footer (default true). */
  pageNumbers?: boolean;
  /** Space between blocks on a page, in CSS pixels (default 12). */
  gap?: number;
  /** Lines of a split block kept at a page bottom and carried to the next top (default 2 each). */
  orphans?: number;
  widows?: number;
  /** Mark this view as the print target: while it is mounted, printing prints only it (default true). */
  isolate?: boolean;
  /** Scale pages down to fit narrow containers on screen (default true; print is always 1:1). */
  fit?: boolean;
  /** Prefix for heading anchors, so two views on one page never share an id. */
  anchorPrefix?: string;
  /** Called with every new layout (page count, slices). */
  onLayout?: (layout: PagedLayout) => void;
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
  page: pageOverrides,
  labels: labelOverrides,
  pageNumbers = true,
  gap = 12,
  orphans = 2,
  widows = 2,
  isolate = true,
  fit = true,
  anchorPrefix = 'paged-',
  onLayout,
  onNavigate,
  pageHref,
  resolveEmbed,
  resolveMedia,
  deckHost = null,
  reducedMotion = false,
  class: className,
}: Props = $props();

const labels = $derived(resolvePagesLabels(labelOverrides));
const pagedLabels = $derived(resolvePagedLabels(labelOverrides));
const settings = $derived(documentPageSettings(doc, pageOverrides));
const geometry = $derived(pageGeometry(settings));
const px = (points: number) => points * PX_PER_PT;
const contentWidth = $derived(px(geometry.contentWidth));
const name = $derived(pageName(geometry));
const anchors = $derived(
  new Map(documentOutline(doc, { prefix: anchorPrefix }).map((entry) => [entry.id, entry.anchor]))
);
const NO_ANCHORS: ReadonlyMap<string, string> = new Map();

let root: HTMLElement | undefined = $state();
let measureRoot: HTMLElement | undefined = $state();
let layout = $state.raw<PagedLayout | null>(null);
let zoom = $state(1);

function signature(value: PagedLayout): string {
  return JSON.stringify([
    value.geometry.width,
    value.geometry.height,
    value.pages.map((page) => [
      page.header,
      page.footer,
      page.slices.map((slice) => [slice.index, slice.from, slice.to, slice.top]),
    ]),
  ]);
}

function relayout() {
  const container = measureRoot;
  // Hidden (print, display: none): keep the last layout.
  if (!container || container.getBoundingClientRect().width === 0) return;
  const units = container.querySelectorAll<HTMLElement>(':scope > [data-paged-unit]');
  const next = layoutDocument(
    doc,
    (_block, unit) => {
      const element = units[unit.index];
      return element ? measureUnit(element) : { height: 0 };
    },
    { page: pageOverrides, scale: PX_PER_PT, gap, orphans, widows, pageNumbers }
  );
  if (layout && signature(layout) === signature(next)) return;
  layout = next;
  onLayout?.(next);
}

$effect(() => {
  // Lay out again whenever the inputs change or a measured block resizes.
  void [doc, pageOverrides, gap, orphans, widows, pageNumbers, contentWidth];
  const container = measureRoot;
  if (!container) return;
  let frame = 0;
  let live = true;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (live) relayout();
    });
  };
  void tick().then(schedule);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  if (observer) for (const child of container.children) observer.observe(child);
  void container.ownerDocument.fonts?.ready.then(schedule);
  return () => {
    live = false;
    cancelAnimationFrame(frame);
    observer?.disconnect();
  };
});

$effect(() => {
  // Fit the sheets to narrow containers on screen.
  const element = root;
  const pageWidth = px(geometry.width);
  if (!element || !fit || typeof ResizeObserver !== 'function') {
    zoom = 1;
    return;
  }
  const observer = new ResizeObserver(() => {
    const available = element.clientWidth - 24;
    zoom = available > 0 ? Math.min(1, available / pageWidth) : 1;
  });
  observer.observe(element);
  return () => observer.disconnect();
});

$effect(() => {
  if (!root || geometry.size !== 'custom') return;
  return adoptCustomPage(root.ownerDocument, geometry.widthMm, geometry.heightMm);
});

const blockOf = (slice: PageSlice) => doc.blocks[slice.index];
const mm = (points: number) => `${(points / (72 / 25.4)).toFixed(3)}mm`;
</script>

<article
  bind:this={root}
  class={['tx-pages', 'tx-pages-paged', className]}
  aria-label={doc.meta.title || pagedLabels.paged}
  aria-busy={layout ? undefined : 'true'}
  data-paged-ready={layout ? 'true' : 'false'}
  data-page-count={layout?.pages.length}
  data-tx-print-isolate={isolate ? 'true' : undefined}
  {...(doc.meta.locale ? { lang: doc.meta.locale } : {})}
  {...(doc.meta.dir ? { dir: doc.meta.dir } : {})}
>
  <div class="tx-pages-paged__measure" bind:this={measureRoot} aria-hidden="true" inert style:inline-size={`${contentWidth}px`}>
    {#each doc.blocks as block, index (block.id)}
      <div class="tx-pages-paged__unit" data-paged-unit={index}>
        <ReaderBlocks blocks={[block]} {labels} anchors={NO_ANCHORS} headingOffset={0} {resolveEmbed} {resolveMedia} {deckHost} {reducedMotion} />
      </div>
    {/each}
  </div>
  {#if !layout}
    <p class="tx-pages-visually-hidden" role="status">{pagedLabels.paginating}</p>
  {:else}
    <div class="tx-pages-paged__sheets" style:zoom={zoom === 1 ? undefined : String(zoom)}>
      {#each layout.pages as sheet (sheet.number)}
        <div
          class="tx-pages-paged__page"
          role="group"
          aria-label={pagedLabels.pageOf(sheet.number, layout.pages.length)}
          data-page={sheet.number}
          data-page-name={name}
          style:inline-size={`${geometry.widthMm}mm`}
          style:block-size={`${geometry.heightMm}mm`}
        >
          {#if sheet.header}
            <div
              class="tx-pages-paged__band"
              data-band="header"
              aria-hidden="true"
              style:inset-block-start="0"
              style:block-size={mm(geometry.margins.top)}
              style:inset-inline-start={mm(geometry.margins.inlineStart)}
              style:inset-inline-end={mm(geometry.margins.inlineEnd)}
            >
              <span>{sheet.header.start}</span><span>{sheet.header.center}</span><span>{sheet.header.end}</span>
            </div>
          {/if}
          <div
            class="tx-pages-paged__body"
            style:inset-block-start={mm(geometry.margins.top)}
            style:inset-inline-start={mm(geometry.margins.inlineStart)}
            style:inline-size={`${contentWidth}px`}
            style:block-size={`${px(geometry.contentHeight)}px`}
          >
            {#each sheet.slices as slice (`${slice.index}:${slice.from}`)}
              {@const block = blockOf(slice)}
              {#if block}
                <div
                  class="tx-pages-paged__slice"
                  data-block-id={block.id}
                  data-continued={slice.continued ? 'true' : undefined}
                  data-continues={slice.continues ? 'true' : undefined}
                  inert={slice.continued}
                  style:inset-block-start={`${slice.top}px`}
                  style:block-size={`${slice.to - slice.from}px`}
                >
                  <div class="tx-pages-paged__unit" style:margin-block-start={slice.from ? `${-slice.from}px` : undefined}>
                    <ReaderBlocks
                      blocks={[block]}
                      {labels}
                      anchors={slice.continued ? NO_ANCHORS : anchors}
                      headingOffset={0}
                      {resolveEmbed}
                      {resolveMedia}
                      {deckHost}
                      {onNavigate}
                      {pageHref}
                      {reducedMotion}
                    />
                  </div>
                </div>
              {/if}
            {/each}
          </div>
          {#if sheet.footer}
            <div
              class="tx-pages-paged__band"
              data-band="footer"
              aria-hidden="true"
              style:inset-block-end="0"
              style:block-size={mm(geometry.margins.bottom)}
              style:inset-inline-start={mm(geometry.margins.inlineStart)}
              style:inset-inline-end={mm(geometry.margins.inlineEnd)}
            >
              <span>{sheet.footer.start}</span><span>{sheet.footer.center}</span><span>{sheet.footer.end}</span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</article>
