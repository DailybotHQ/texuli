<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { type CardVariant, cardClass } from './variants.ts';
import './card.css';

type Props = HTMLAttributes<HTMLElement> & {
  /** Visual elevation. */
  variant?: CardVariant;
  /**
   * When set, the card is a single link (clickable card). Value is filtered by
   * {@link safeHref}; rejected schemes render as a non-interactive div.
   */
  href?: string;
  /** Trust tier for `href` (default `developer` for app chrome cards). */
  hrefTrust?: HrefTrust;
  /** Accessible name when the card is a link without a nested heading. */
  linkLabel?: string;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  variant = 'elevated',
  href,
  hrefTrust = 'developer',
  linkLabel,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const safe = $derived(href === undefined ? undefined : safeHref(href, hrefTrust));
const interactive = $derived(Boolean(safe));
const classes = $derived(
  cardClass({
    variant,
    class: cx(interactive && 'tx-card--interactive', className),
  })
);
</script>

{#if safe}
  <a
    bind:this={ref}
    href={safe}
    class={classes}
    data-tx-card
    data-variant={variant}
    data-interactive="true"
    aria-label={linkLabel}
    {...rest as HTMLAttributes<HTMLAnchorElement>}
  >
    {@render children?.()}
  </a>
{:else}
  <div
    bind:this={ref}
    class={classes}
    data-tx-card
    data-variant={variant}
    {...rest as HTMLAttributes<HTMLDivElement>}
  >
    {@render children?.()}
  </div>
{/if}
