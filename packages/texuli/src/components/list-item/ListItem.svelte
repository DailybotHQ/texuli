<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLLiAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import Icon from '../icons/Icon.svelte';
import type { IconRef } from '../icons/types.ts';
import './list-item.css';

interface OwnProps {
  /** The primary line, as escaped text. `children` replaces it when given. */
  title?: string;
  /** A secondary line under the title (escaped text). */
  description?: string;
  /** Short trailing text inside the row (a time, a count, a status). */
  meta?: string;
  /**
   * A leading icon: a built-in name, a registered name or a Svelte SVG
   * component (decorative). `leading` replaces it when given.
   */
  icon?: IconRef;
  /** Leading media (an avatar, a thumbnail); give decorative images `alt=""`. */
  leading?: Snippet;
  /**
   * Controls after the row (a menu, a button). They render outside the
   * link or button, so they are never nested in another control.
   */
  trailing?: Snippet;
  /** Rich title content; replaces `title`. */
  children?: Snippet;
  /**
   * Makes the row one link. Filtered by the URL policy: a rejected value
   * renders a plain, non-interactive row.
   */
  href?: string;
  /** Trust tier for `href` (default `developer`: app-authored rows). */
  hrefTrust?: HrefTrust;
  /** Link target when `href` is set; `_blank` always adds `noopener`. */
  target?: HTMLAnchorAttributes['target'];
  /** Marks the link as the current page or item (`aria-current`). */
  current?: boolean;
  /** Makes the row one button (when no safe `href` is given). */
  onSelect?: () => void;
  /** Disables the `onSelect` button. */
  disabled?: boolean;
  class?: ClassValue;
  /** The root `li` (bindable). */
  ref?: HTMLLIElement | null;
}
/** Other attributes (`id`, `aria-*`, `data-*`, `style`, handlers) land on the root `li`. */
type Props = OwnProps & Omit<HTMLLiAttributes, keyof OwnProps>;

let {
  title,
  description,
  meta,
  icon,
  leading,
  trailing,
  children,
  href,
  hrefTrust = 'developer',
  target,
  current = false,
  onSelect,
  disabled = false,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const safe = $derived(href ? safeHref(href, hrefTrust) : undefined);
</script>

{#snippet body()}
  {#if leading}
    <span class="tx-list-item__leading">{@render leading()}</span>
  {:else if icon}
    <span class="tx-list-item__leading"><Icon {icon} /></span>
  {/if}
  <span class="tx-list-item__text">
    <span class="tx-list-item__title">{#if children}{@render children()}{:else}{title}{/if}</span>
    {#if description}<span class="tx-list-item__description">{description}</span>{/if}
  </span>
  {#if meta}<span class="tx-list-item__meta">{meta}</span>{/if}
{/snippet}

<li {...rest} bind:this={ref} class={cx('tx-list-item', className)} data-tx-list-item data-tx-component="list-item">
  {#if safe}
    <a
      class="tx-list-item__main"
      href={safe}
      {target}
      rel={target?.toLowerCase() === '_blank' ? 'noopener noreferrer' : undefined}
      aria-current={current ? 'page' : undefined}
    >
      {@render body()}
    </a>
  {:else if onSelect}
    <button type="button" class="tx-list-item__main" {disabled} onclick={() => onSelect?.()}>
      {@render body()}
    </button>
  {:else}
    <div class="tx-list-item__main">{@render body()}</div>
  {/if}
  {#if trailing}<div class="tx-list-item__trailing">{@render trailing()}</div>{/if}
</li>
