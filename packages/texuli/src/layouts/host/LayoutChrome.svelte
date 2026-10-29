<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import { Avatar } from '../../components/avatar/index.ts';
import { Button } from '../../components/button/index.ts';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import NavIcon from './NavIcon.svelte';
import type { NavModel } from './nav-model.ts';
import type { ChromePart } from './types.ts';
import './host.css';

/**
 * Shared desktop layout chrome: skip link, brand, primary actions and user.
 * Every href goes through `safeHref`.
 */
type Props = {
  part: ChromePart;
  nav?: NavModel;
  /** `id` of the screen region the skip link focuses. */
  mainId?: string;
  /** Icon-only rendering (rail). */
  compact?: boolean;
  /** Trust for brand / action / user hrefs. Default developer (app-authored). */
  hrefTrust?: HrefTrust;
  skipLabel?: string;
  class?: ClassValue;
};

let {
  part,
  nav,
  mainId,
  compact = false,
  hrefTrust = 'developer',
  skipLabel: skipLabelProp,
  class: className,
}: Props = $props();
const msg = useMessages();
const skipLabel = $derived(
  skipLabelProp ?? msg('texuli.layout-chrome.skip-label', 'Skip to content')
);

const brandHref = $derived(
  nav?.brand?.href !== undefined ? safeHref(nav.brand.href, hrefTrust) : safeHref('#/', hrefTrust)
);
const userHref = $derived(
  nav?.user?.href !== undefined ? safeHref(nav.user.href, hrefTrust) : undefined
);

function focusMain(event: MouseEvent): void {
  event.preventDefault();
  if (!mainId) return;
  const node = document.getElementById(mainId);
  node?.focus();
}
</script>

{#if part === 'skip' && mainId}
  <a
    href={`#${mainId}`}
    class={cx('tx-layout-chrome-skip', className)}
    data-tx-layout-chrome="skip"
    onclick={focusMain}
  >
    {skipLabel}
  </a>
{:else if part === 'brand' && nav?.brand}
  {#if brandHref}
    <a
      href={brandHref}
      class={cx('tx-layout-chrome-brand', className)}
      data-tx-layout-chrome="brand"
      data-compact={compact ? 'true' : 'false'}
    >
      <span class="tx-layout-chrome-brand__mark" aria-hidden="true">
        {#if nav.brand.icon}
          <NavIcon icon={nav.brand.icon} />
        {:else}
          {nav.brand.label.slice(0, 1)}
        {/if}
      </span>
      <span class="tx-layout-chrome-brand__label" data-compact={compact ? 'true' : 'false'}
        >{nav.brand.label}</span
      >
    </a>
  {:else}
    <div
      class={cx('tx-layout-chrome-brand', className)}
      data-tx-layout-chrome="brand"
      data-compact={compact ? 'true' : 'false'}
    >
      <span class="tx-layout-chrome-brand__mark" aria-hidden="true">
        {#if nav.brand.icon}
          <NavIcon icon={nav.brand.icon} />
        {:else}
          {nav.brand.label.slice(0, 1)}
        {/if}
      </span>
      <span class="tx-layout-chrome-brand__label" data-compact={compact ? 'true' : 'false'}
        >{nav.brand.label}</span
      >
    </div>
  {/if}
{:else if part === 'actions' && nav?.actions?.length}
  <div
    class={cx('tx-layout-chrome-actions', className)}
    data-tx-layout-chrome="actions"
    data-compact={compact ? 'true' : 'false'}
  >
    {#each nav.actions as action (action.id)}
      <Button
        size={compact ? 'icon' : 'sm'}
        href={action.href}
        hrefTrust={hrefTrust}
        aria-label={compact ? action.label : undefined}
        onclick={action.onSelect ? () => action.onSelect?.() : undefined}
      >
        {#if action.icon}<NavIcon icon={action.icon} />{/if}
        {#if !compact}{action.label}{/if}
      </Button>
    {/each}
  </div>
{:else if part === 'user' && nav?.user}
  {#if userHref}
    <a
      href={userHref}
      class={cx('tx-layout-chrome-user', className)}
      data-tx-layout-chrome="user"
      data-compact={compact ? 'true' : 'false'}
    >
      <Avatar name={nav.user.name} src={nav.user.image?.src} size="sm" decorative />
      <span class="tx-layout-chrome-user__meta" data-compact={compact ? 'true' : 'false'}>
        <span class="tx-layout-chrome-user__name">{nav.user.name}</span>
        {#if nav.user.detail}
          <span class="tx-layout-chrome-user__detail">{nav.user.detail}</span>
        {/if}
      </span>
    </a>
  {:else}
    <div
      class={cx('tx-layout-chrome-user', className)}
      data-tx-layout-chrome="user"
      data-compact={compact ? 'true' : 'false'}
    >
      <Avatar name={nav.user.name} src={nav.user.image?.src} size="sm" decorative />
      <span class="tx-layout-chrome-user__meta" data-compact={compact ? 'true' : 'false'}>
        <span class="tx-layout-chrome-user__name">{nav.user.name}</span>
        {#if nav.user.detail}
          <span class="tx-layout-chrome-user__detail">{nav.user.detail}</span>
        {/if}
      </span>
    </div>
  {/if}
{/if}
