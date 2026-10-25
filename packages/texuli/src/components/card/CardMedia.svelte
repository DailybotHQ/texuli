<script lang="ts">
import { type HrefTrust, safeImageSrc } from '@texuli/core/url-policy';
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import './card.css';

type Props = HTMLAttributes<HTMLElement> & {
  /** Image URL; filtered by safeImageSrc. */
  src: string;
  /** Required alternative text (empty only when decorative). */
  alt?: string;
  srcTrust?: HrefTrust;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  src,
  alt = '',
  srcTrust = 'untrusted',
  class: className,
  ...rest
}: Props = $props();

const safe = $derived(safeImageSrc(src, srcTrust));
</script>

{#if safe}
  <figure bind:this={ref}
    class={cx('tx-card__media-wrap', className)}
    data-tx-card-media
    {...rest as HTMLAttributes<HTMLElement>}
  >
    <img class="tx-card__media" src={safe} {alt} loading="lazy" decoding="async" />
  </figure>
{/if}
