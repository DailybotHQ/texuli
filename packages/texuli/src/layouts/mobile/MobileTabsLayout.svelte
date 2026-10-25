<script lang="ts">
import { safeHref } from '@texuli/core/url-policy';
import { Sheet } from '../../components/sheet/index.ts';
import LayoutChrome from '../host/LayoutChrome.svelte';
import { onNavigate } from '../host/layout-kit.ts';
import NavIcon from '../host/NavIcon.svelte';
import { navBadge, type ResolvedNavItem, resolveNav } from '../host/nav-model.ts';
import type { LayoutProps } from '../host/registry.ts';
import { mobileLabels } from './labels.ts';
import MobileFrame from './MobileFrame.svelte';
import {
  currentHashPath,
  MOBILE_TAB_LIMIT,
  navCurrent,
  splitTabs,
  stackHeader,
  topLevelItems,
} from './model.ts';

/**
 * Mobile tab bar layout (`mobile-tabs`), ported from Protoyard's
 * MobileTabsLayout and completed with stacked navigation: a sticky header with
 * the screen's title and Back below a tab's root, the routed screen, and a
 * bottom tab bar of the top-level items. Up to five fit; with more, four stay
 * and a More tab opens a bottom sheet with the rest and the user. The first
 * nav action becomes the bar's primary action; the others sit in the header.
 */
let { mountScreen, nav, path, options }: LayoutProps = $props();

let hashPath = $state('/');
let moreOpen = $state(false);
let root = $state<HTMLElement>();

$effect(() => {
  hashPath = currentHashPath(root);
  return onNavigate(() => {
    hashPath = currentHashPath(root);
    moreOpen = false;
  }, root);
});

const text = $derived(mobileLabels(options));
const limit = $derived(typeof options?.tabLimit === 'number' ? options.tabLimit : MOBILE_TAB_LIMIT);
const resolved = $derived(resolveNav(nav ?? { sections: [] }, path ?? hashPath));
const items = $derived(topLevelItems(resolved));
const split = $derived(splitTabs(items, limit));
const moreInTrail = $derived(split.more.some((item) => item.inTrail));
const header = $derived(
  stackHeader(resolved, path ?? hashPath, nav?.brand?.label ?? text.home, text.title)
);
const primaryAction = $derived(nav?.actions?.[0]);
const primaryHref = $derived(
  primaryAction?.href ? safeHref(primaryAction.href, 'developer') : undefined
);
const headerNav = $derived(
  nav ? { ...nav, actions: nav.actions?.slice(primaryAction ? 1 : 0) } : undefined
);

const currentPath = $derived(path ?? hashPath);
const current = (item: ResolvedNavItem) => navCurrent(item, currentPath);
</script>

{#snippet headerActions()}
  <LayoutChrome part="actions" nav={headerNav} compact />
{/snippet}

<div bind:this={root} class="tx-mobile-layout-root" data-tx-layout="mobile-tabs">
  <MobileFrame
    kind="tabs"
    {header}
    onscreen={mountScreen}
    backLabel={text.back}
    actions={headerNav?.actions?.length ? headerActions : undefined}
  >
    {#snippet bottom()}
      {#if items.length || primaryAction}
        <nav class="tx-mobile-tabs" aria-label={text.tabs} data-tx-mobile-tabs="">
          <ul class="tx-mobile-tabs__list">
            {#each split.tabs as item (item.id)}
              {@const href = safeHref(item.href, 'developer')}
              {@const badge = navBadge(item.badge)}
              <li class="tx-mobile-tabs__item">
                <a class="tx-mobile-tabs__tab" {href} aria-current={current(item)} data-tx-mobile-tab={item.id}>
                  <NavIcon icon={item.icon} class="tx-mobile-tabs__icon" />
                  <span class="tx-mobile-tabs__label">{item.label}</span>
                  {#if badge !== undefined}<span class="tx-mobile-tabs__badge">{badge}</span>{/if}
                </a>
              </li>
            {/each}
            {#if primaryAction}
              <li class="tx-mobile-tabs__item">
                {#if primaryHref}
                  <a class="tx-mobile-tabs__tab tx-mobile-tabs__primary" href={primaryHref}>
                    <span class="tx-mobile-tabs__primary-mark" aria-hidden="true">
                      {#if primaryAction.icon}<NavIcon icon={primaryAction.icon} />{:else}+{/if}
                    </span>
                    <span class="tx-mobile-tabs__label">{primaryAction.label}</span>
                  </a>
                {:else}
                  <button type="button" class="tx-mobile-tabs__tab tx-mobile-tabs__primary" onclick={() => primaryAction.onSelect?.()}>
                    <span class="tx-mobile-tabs__primary-mark" aria-hidden="true">
                      {#if primaryAction.icon}<NavIcon icon={primaryAction.icon} />{:else}+{/if}
                    </span>
                    <span class="tx-mobile-tabs__label">{primaryAction.label}</span>
                  </button>
                {/if}
              </li>
            {/if}
            {#if split.more.length}
              <li class="tx-mobile-tabs__item">
                <button
                  type="button"
                  class="tx-mobile-tabs__tab"
                  aria-haspopup="dialog"
                  aria-expanded={moreOpen}
                  data-in-trail={moreInTrail ? '' : undefined}
                  onclick={() => (moreOpen = true)}
                >
                  <svg class="tx-mobile-tabs__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                  <span class="tx-mobile-tabs__label">{text.more}</span>
                  {#if moreInTrail}<span class="tx-layout-host__loading-label">{text.moreCurrent}</span>{/if}
                </button>
              </li>
            {/if}
          </ul>
        </nav>
      {/if}
    {/snippet}
  </MobileFrame>
</div>

{#if split.more.length}
  <Sheet.Root bind:open={moreOpen}>
    <Sheet.Portal>
      <Sheet.Overlay />
      <Sheet.Content side="bottom" class="tx-mobile-more">
        <Sheet.Title class="tx-mobile-more__title">{text.more}</Sheet.Title>
        <nav aria-label={text.more}>
          <ul class="tx-mobile-more__list">
            {#each split.more as item (item.id)}
              {@const href = safeHref(item.href, 'developer')}
              {@const badge = navBadge(item.badge)}
              <li>
                <a class="tx-mobile-more__link" {href} aria-current={current(item)} onclick={() => (moreOpen = false)}>
                  <NavIcon icon={item.icon} />
                  <span>{item.label}</span>
                  {#if badge !== undefined}<span class="tx-mobile-tabs__badge">{badge}</span>{/if}
                </a>
              </li>
            {/each}
          </ul>
        </nav>
        {#if nav?.user}<div class="tx-mobile-more__user"><LayoutChrome part="user" {nav} /></div>{/if}
        <Sheet.Close class="tx-mobile-more__close">{text.close}</Sheet.Close>
      </Sheet.Content>
    </Sheet.Portal>
  </Sheet.Root>
{/if}
