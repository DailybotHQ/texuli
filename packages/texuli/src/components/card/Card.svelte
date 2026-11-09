<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { designDefaults } from '../../internal/design-defaults.ts';
import { type CardVariant, cardClass } from './variants.ts';
import './card.css';

type Props = HTMLAttributes<HTMLElement> & {
  /** Visual elevation. */
  variant?: CardVariant;
  /**
   * When set, the card is a stretched primary link (clickable card). Value is
   * filtered by {@link safeHref}; rejected schemes render as a non-interactive div.
   */
  href?: string;
  /** Trust tier for `href` (default `developer` for app chrome cards). */
  hrefTrust?: HrefTrust;
  /** Accessible name of the stretched primary link. */
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
  /**
   * Secondary actions (pin, menu). They sit above the stretched link, stay
   * separately focusable, and follow the link in tab order.
   */
  actions?: Snippet;
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
  actions,
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

<div
  bind:this={ref}
  class={classes}
  data-tx-card
  data-variant={variant}
  data-tx-component="card"
  data-tx-variant={variant}
  data-interactive={interactive ? 'true' : undefined}
  {...rest as HTMLAttributes<HTMLDivElement>}
>
  {#if safe}
    <a
      href={safe}
      {target}
      rel={linkRel}
      download={linkDownload}
      class="tx-card__link"
      data-tx-card
      aria-label={linkLabel}
    ></a>
  {/if}
  {@render children?.()}
  {#if actions}
    <div class="tx-card__actions">{@render actions()}</div>
  {/if}
</div>
