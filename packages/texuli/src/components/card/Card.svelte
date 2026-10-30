<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { type CardVariant, cardClass } from './variants.ts';
import './card.css';
import { designDefaults } from '../../internal/design-defaults.ts';

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
  /** Link target when `href` is set (ignored otherwise). */
  target?: HTMLAnchorAttributes['target'];
  /**
   * Link relationship when `href` is set. With `target="_blank"`, `noopener`
   * is always added so the opened page gets no `window.opener`.
   */
  rel?: string;
  /** Download the linked resource (`true`, or a suggested file name) when `href` is set. */
  download?: string | boolean;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

const txDefaults = designDefaults('card');
let {
  variant = txDefaults().variant ?? 'elevated',
  href,
  hrefTrust = 'developer',
  linkLabel,
  target,
  rel,
  download,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const safe = $derived(href === undefined ? undefined : safeHref(href, hrefTrust));
const interactive = $derived(Boolean(safe));
const linkRel = $derived(cardLinkRel(rel, target));
const linkDownload = $derived(
  download === true ? '' : download === false || download === undefined ? undefined : download
);

/**
 * Merge the caller's `rel` tokens with `noopener` for a new browsing context.
 * Browsers read `target` keywords and `rel` tokens ASCII case-insensitively,
 * so `_BLANK` opens a new context too.
 */
function cardLinkRel(value: string | undefined, linkTarget: string | null | undefined) {
  const tokens = (value ?? '').split(/\s+/).filter(Boolean);
  if (
    linkTarget?.toLowerCase() === '_blank' &&
    !tokens.some((token) => token.toLowerCase() === 'noopener')
  )
    tokens.push('noopener');
  return tokens.length > 0 ? tokens.join(' ') : undefined;
}
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
    {target}
    rel={linkRel}
    download={linkDownload}
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
