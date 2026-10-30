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
  class?: ClassValue;
};

let {
  list,
  detail,
  empty,
  listLabel: listLabelProp,
  detailLabel: detailLabelProp,
  detailActive = $bindable(false),
  class: className,
  ...rest
}: Props = $props();
const msg = useMessages();
const listLabel = $derived(listLabelProp ?? msg('texuli.split-view.list-label', 'List'));
const detailLabel = $derived(detailLabelProp ?? msg('texuli.split-view.detail-label', 'Details'));

const hasDetail = $derived(Boolean(detail));
const selectedDetail = $derived(detailActive && hasDetail);
</script>

<div
  class={cx('tx-app-layout__split', className)}
  data-tx-split-view
  data-has-detail={hasDetail ? 'true' : 'false'}
  data-detail-active={selectedDetail ? 'true' : 'false'}
  {...rest}
>
  <div class="tx-app-layout__split-panes">
    <section class="tx-app-layout__split-list" aria-label={listLabel}>{@render list()}</section>
    <section class="tx-app-layout__split-detail" aria-label={detailLabel}>
      {#if detail}
        {@render detail()}
      {:else if empty}
        {@render empty()}
      {/if}
    </section>
  </div>
</div>
