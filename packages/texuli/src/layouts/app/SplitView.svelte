<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './app.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  list: Snippet;
  detail?: Snippet;
  empty?: Snippet;
  listLabel?: string;
  detailLabel?: string;
  /** On narrow containers the caller selects which pane is visible. */
  detailActive?: boolean;
  /**
   * Width of the list pane once both panes show: a CSS length or track
   * (`20rem`, `30%`, `minmax(16rem, 24rem)`). Default `minmax(15rem, 22.5rem)`.
   */
  listWidth?: string;
  /**
   * Container width from which list and detail show side by side: `sm`
   * (40rem), `md` (56rem, the default) or `lg` (72rem). Narrower, one pane shows.
   */
  breakpoint?: 'sm' | 'md' | 'lg';
  /**
   * A third pane after the detail (properties, activity), shown only when the
   * container is at least 72rem wide; offer its content another way below that.
   */
  context?: Snippet;
  /** Accessible name of the context pane (it is a named region only with one). */
  contextLabel?: string;
  class?: ClassValue;
  /** The root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  list,
  detail,
  empty,
  listLabel: listLabelProp,
  detailLabel: detailLabelProp,
  detailActive = $bindable(false),
  listWidth,
  breakpoint,
  context,
  contextLabel,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const listLabel = $derived(listLabelProp ?? msg('texuli.split-view.list-label', 'List'));
const detailLabel = $derived(detailLabelProp ?? msg('texuli.split-view.detail-label', 'Details'));

const hasDetail = $derived(Boolean(detail));
// A length or track only: no `;`, `:`, braces, quotes or `url()`, so the
// value cannot leave the custom property when rendered on the server.
const listTrack = $derived(
  listWidth && /^(?!.*url)[\w.%+\-*/(), ]+$/i.test(listWidth) ? listWidth : undefined
);
const selectedDetail = $derived(detailActive && hasDetail);
</script>

<div
  bind:this={ref}
  class={cx('tx-app-layout__split', className)}
  data-tx-split-view
  data-has-detail={hasDetail ? 'true' : 'false'}
  data-detail-active={selectedDetail ? 'true' : 'false'}
  data-breakpoint={breakpoint}
  style:--tx-split-view-list-width={listTrack}
  {...rest}
 data-tx-component="split-view">
  <div class="tx-app-layout__split-panes">
    <section class="tx-app-layout__split-list" aria-label={listLabel}>{@render list()}</section>
    <section class="tx-app-layout__split-detail" aria-label={detailLabel}>
      {#if detail}
        {@render detail()}
      {:else if empty}
        {@render empty()}
      {/if}
    </section>
    {#if context}
      <section class="tx-app-layout__split-context" aria-label={contextLabel} data-tx-split-context="">
        {@render context()}
      </section>
    {/if}
  </div>
</div>
