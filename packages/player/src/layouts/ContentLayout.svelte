<script lang="ts">
import type { Snippet } from 'svelte';
import { getPlayerLabels, getPlayerLandmarks } from '../context.ts';
import { safeLang } from '../labels.ts';
import type { ContentLayoutId, FrameInfo } from './outline.ts';

let {
  variant,
  txFrame,
  title,
  description,
  columns = 2,
  gap,
  toc = true,
  notes,
  locale,
  align,
  wrap = true,
  ratio = '1:1',
  span = 1,
  rowSpan = 1,
  children,
}: {
  variant: ContentLayoutId;
  /** Player-owned frame data (heading rank, id, contents); overrides any blueprint value. */
  txFrame?: FrameInfo;
  title?: string;
  description?: string;
  columns?: number;
  gap?: string;
  toc?: boolean;
  notes?: string;
  locale?: string;
  align?: string;
  wrap?: boolean;
  ratio?: string;
  span?: number;
  rowSpan?: number;
  children?: Snippet;
} = $props();

const labels = getPlayerLabels();
// A host embedding the player inline inside its own landmark passes
// `landmarks={false}`; the page layout then paints a plain section.
const landmarks = getPlayerLandmarks();

let boundedColumns = $derived(
  Number.isFinite(columns) ? Math.max(1, Math.min(4, Math.floor(columns))) : 2
);
// `gap` is untrusted text headed for a style attribute: only a bounded length passes.
let safeGap = $derived(
  typeof gap === 'string' && /^(?:0|\d{1,2}(?:\.\d{1,2})?(?:rem|em)|\d{1,3}px)$/.test(gap)
    ? gap
    : undefined
);
let gridStyle = $derived(
  `--tx-player-columns: ${boundedColumns}${safeGap ? `; --tx-player-gap: ${safeGap}` : ''}`
);
let level = $derived(txFrame?.headingLevel ?? null);
let headingTag = $derived(`h${level ?? 2}`);
let headingId = $derived(txFrame ? `${txFrame.frameId}-title` : undefined);
let contents = $derived(
  toc !== false && (txFrame?.toc.length ?? 0) >= 2 ? (txFrame?.toc ?? []) : []
);
let deckLang = $derived(safeLang(locale));

// G20 values reach the DOM only as closed tokens (data attributes the CSS maps)
// or clamped integers; free text never becomes a style.
const GAPS = ['none', 'small', 'medium', 'large'];
const ALIGNS = ['start', 'center', 'end', 'stretch'];
const RATIOS = ['1:1', '1:2', '2:1', '1:3', '3:1'];
let gapToken = $derived(typeof gap === 'string' && GAPS.includes(gap) ? gap : 'medium');
let alignToken = $derived(typeof align === 'string' && ALIGNS.includes(align) ? align : 'stretch');
let ratioToken = $derived(typeof ratio === 'string' && RATIOS.includes(ratio) ? ratio : '1:1');
function clampInt(value: unknown, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(max, Math.floor(value)))
    : 1;
}
let tileStyle = $derived(
  `--tx-player-span: ${clampInt(span, 4)}; --tx-player-row-span: ${clampInt(rowSpan, 2)}`
);

function jump(event: MouseEvent, frameId: string): void {
  // Focus the frame directly: a hash change could reach the host's router.
  const target = (event.currentTarget as HTMLElement).ownerDocument.getElementById(frameId);
  if (!target) return;
  event.preventDefault();
  target.focus();
  target.scrollIntoView?.({ block: 'start' });
}
</script>

{#snippet heading()}
  {#if title && level !== null}
    <svelte:element this={headingTag} id={headingId} class="tx-player-layout__title">{title}</svelte:element>
  {/if}
{/snippet}

{#if variant === 'layout-card' || variant === 'deck-slide'}
  <section
    class="tx-player-layout tx-player-layout--{variant === 'deck-slide' ? 'slide' : 'card'}"
    id={txFrame?.frameId}
    aria-labelledby={title && level !== null ? headingId : undefined}
    aria-label={title && level !== null ? undefined : variant === 'deck-slide' ? 'Slide' : 'Content card'}
    data-tx-player-frame
    data-tx-player-path={txFrame?.path}
    tabindex="-1"
  >
    {@render heading()}
    {#if children}{@render children()}{/if}
    {#if variant === 'deck-slide' && notes}
      <details class="tx-player-layout__notes">
        <summary>{labels().speakerNotes}</summary>
        <p>{notes}</p>
      </details>
    {/if}
  </section>
{:else if variant === 'layout-page'}
  <svelte:element
    this={landmarks() ? 'main' : 'section'}
    class="tx-player-layout tx-player-layout--page"
    id={txFrame?.frameId}
    data-tx-player-frame
    data-tx-player-path={txFrame?.path}
    tabindex="-1"
  >
    {@render heading()}
    {#if description}<p class="tx-player-layout__description">{description}</p>{/if}
    {#if children}{@render children()}{/if}
  </svelte:element>
{:else if variant === 'layout-doc' || variant === 'layout-deck'}
  <article
    class="tx-player-layout tx-player-layout--{variant === 'layout-deck' ? 'deck' : 'doc'}"
    id={txFrame?.frameId}
    aria-labelledby={title && level !== null ? headingId : undefined}
    lang={variant === 'layout-deck' ? deckLang : undefined}
    data-tx-player-frame
    data-tx-player-path={txFrame?.path}
    tabindex="-1"
  >
    {@render heading()}
    {#if description}<p class="tx-player-layout__description">{description}</p>{/if}
    {#if contents.length > 0}
      <nav class="tx-player-layout__toc" aria-label={labels().contents}>
        <ol>
          {#each contents as entry (entry.frameId)}
            <li data-level={entry.level}>
              <a href={`#${entry.frameId}`} onclick={(event) => jump(event, entry.frameId)}>{entry.title}</a>
            </li>
          {/each}
        </ol>
      </nav>
    {/if}
    {#if children}{@render children()}{/if}
  </article>
{:else if variant === 'layout-stack' || variant === 'layout-row' || variant === 'layout-split'}
  <div
    class="tx-player-layout tx-player-layout--{variant.slice('layout-'.length)}"
    id={txFrame?.frameId}
    data-tx-player-frame
    data-tx-player-path={txFrame?.path}
    data-gap={gapToken}
    data-align={variant === 'layout-row' ? alignToken : undefined}
    data-wrap={variant === 'layout-row' ? String(wrap !== false) : undefined}
    data-ratio={variant === 'layout-split' ? ratioToken : undefined}
    tabindex="-1"
  >
    {#if children}{@render children()}{/if}
  </div>
{:else if variant === 'layout-tile'}
  <section
    class="tx-player-layout tx-player-layout--tile"
    id={txFrame?.frameId}
    aria-labelledby={title && level !== null ? headingId : undefined}
    aria-label={title && level !== null ? undefined : 'Tile'}
    data-tx-player-frame
    data-tx-player-path={txFrame?.path}
    tabindex="-1"
    style={tileStyle}
  >
    {@render heading()}
    {#if children}{@render children()}{/if}
  </section>
{:else}
  <div
    class="tx-player-layout tx-player-layout--grid"
    id={txFrame?.frameId}
    data-tx-player-frame
    data-tx-player-path={txFrame?.path}
    tabindex="-1"
    style={gridStyle}
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
