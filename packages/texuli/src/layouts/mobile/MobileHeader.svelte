<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './mobile.css';

/**
 * A standalone mobile stack header: Back (a link or a button), the screen
 * title with an optional subtitle, then actions. Sticky at the top of its
 * scroll container by default.
 */
type OwnProps = {
  title: string;
  subtitle?: string;
  /** The title element: `h1` (default), or `p`/`div` when the screen renders its own heading. */
  titleAs?: 'h1' | 'h2' | 'p' | 'div';
  /** Back as a link… */
  backHref?: string;
  /** …or as a button. */
  onBack?: (event: MouseEvent) => void;
  /** Visible Back text. Default "Back". */
  backLabel?: string;
  /** Where Back goes, added to its accessible name (`Back: Deals`). */
  backTarget?: string;
  /** URL trust for `backHref`. Default `developer`. */
  hrefTrust?: HrefTrust;
  actions?: Snippet;
  /** Stick to the top of the scroll container. Default `true`. */
  sticky?: boolean;
  class?: ClassValue;
  /** The `header` element (bindable). */
  ref?: HTMLElement | null;
};
type Props = OwnProps & Omit<HTMLAttributes<HTMLElement>, keyof OwnProps>;

let {
  title,
  subtitle,
  titleAs = 'h1',
  backHref,
  onBack,
  backLabel: backLabelProp,
  backTarget,
  hrefTrust = 'developer',
  actions,
  sticky = true,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const backLabel = $derived(backLabelProp ?? msg('texuli.mobile-header.back-label', 'Back'));

const href = $derived(backHref === undefined ? undefined : safeHref(backHref, hrefTrust));
// The name keeps the visible word first (WCAG 2.5.3) and adds where Back goes.
const backName = $derived(backTarget ? `${backLabel}: ${backTarget}` : undefined);
</script>

{#snippet backContent()}
  <svg class="tx-mobile-layout__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
  <span class="tx-mobile-layout__back-label">{backLabel}</span>
{/snippet}

<header
  {...rest}
  bind:this={ref}
  class={cx(
    'tx-mobile-layout__header tx-mobile-header',
    !sticky && 'tx-mobile-header--static',
    className
  )}
  data-tx-mobile-header=""
>
  {#if href}
    <a class="tx-mobile-layout__back" {href} aria-label={backName} data-tx-mobile-back="">
      {@render backContent()}
    </a>
  {:else if onBack}
    <button
      type="button"
      class="tx-mobile-layout__back tx-mobile-header__back-button"
      aria-label={backName}
      data-tx-mobile-back=""
      onclick={onBack}
    >
      {@render backContent()}
    </button>
  {/if}
  <div class="tx-mobile-header__titles">
    <svelte:element this={titleAs} class="tx-mobile-layout__title" data-tx-mobile-title="">
      {title}
    </svelte:element>
    {#if subtitle}<p class="tx-mobile-header__subtitle">{subtitle}</p>{/if}
  </div>
  {#if actions}<div class="tx-mobile-layout__actions">{@render actions()}</div>{/if}
</header>
