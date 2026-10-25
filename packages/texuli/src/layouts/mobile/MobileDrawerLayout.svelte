<script lang="ts">
import { safeHref } from '@texuli/core/url-policy';
import LayoutChrome from '../host/LayoutChrome.svelte';
import LayoutDrawer from '../host/LayoutDrawer.svelte';
import { onNavigate } from '../host/layout-kit.ts';
import NavIcon from '../host/NavIcon.svelte';
import { navBadge, type ResolvedNavItem, resolveNav } from '../host/nav-model.ts';
import type { LayoutProps } from '../host/registry.ts';
import { mobileLabels } from './labels.ts';
import MobileFrame from './MobileFrame.svelte';
import { currentHashPath, navCurrent, stackHeader } from './model.ts';

/**
 * Mobile drawer layout (`mobile-drawer`), ported from Protoyard's
 * MobileDrawerLayout and completed with stacked navigation: a sticky header
 * with Back below a section's root, the screen's title, the actions and a
 * menu button; the whole nav model (brand, sections with nested items,
 * actions, user) sits in a side drawer that closes on Escape, a link or any
 * in-app navigation. No bottom bar, so a screen's composer reaches the edge.
 */
let { mountScreen, nav, path, options }: LayoutProps = $props();

let hashPath = $state('/');
let drawerOpen = $state(false);
let root = $state<HTMLElement>();

$effect(() => {
  hashPath = currentHashPath(root);
  return onNavigate(() => (hashPath = currentHashPath(root)), root);
});

const text = $derived(mobileLabels(options));
const resolved = $derived(resolveNav(nav ?? { sections: [] }, path ?? hashPath));
const header = $derived(
  stackHeader(resolved, path ?? hashPath, nav?.brand?.label ?? text.home, text.title)
);
const drawerLabel = $derived(nav?.brand?.label ?? text.menu);

const currentPath = $derived(path ?? hashPath);
const current = (item: ResolvedNavItem) => navCurrent(item, currentPath);
</script>

{#snippet links(items: readonly ResolvedNavItem[])}
  <ul class="tx-mobile-drawer-nav__list">
    {#each items as item (item.id)}
      {@const href = safeHref(item.href, 'developer')}
      {@const badge = navBadge(item.badge)}
      <li>
        <a class="tx-mobile-drawer-nav__link" {href} aria-current={current(item)}>
          <NavIcon icon={item.icon} />
          <span>{item.label}</span>
          {#if badge !== undefined}<span class="tx-mobile-tabs__badge">{badge}</span>{/if}
        </a>
        {#if item.children.length}{@render links(item.children)}{/if}
      </li>
    {/each}
  </ul>
{/snippet}

<div bind:this={root} class="tx-mobile-layout-root" data-tx-layout="mobile-drawer">
  <MobileFrame kind="drawer" {header} onscreen={mountScreen} backLabel={text.back}>
    {#snippet actions()}
      {#if nav?.actions?.length}<LayoutChrome part="actions" {nav} compact />{/if}
      {#if nav}
        <button
          type="button"
          class="tx-mobile-layout__menu"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onclick={() => (drawerOpen = true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          <span class="tx-layout-host__loading-label">{text.menu}</span>
        </button>
      {/if}
    {/snippet}
  </MobileFrame>
</div>

{#if nav}
  <LayoutDrawer bind:open={drawerOpen} label={drawerLabel} closeLabel={text.close}>
    <div class="tx-mobile-drawer-nav">
      <LayoutChrome part="brand" {nav} />
      <nav class="tx-mobile-drawer-nav__sections" aria-label={drawerLabel}>
        {#each resolved as section (section.id)}
          <div class="tx-mobile-drawer-nav__section">
            {#if section.label}<p class="tx-mobile-drawer-nav__heading">{section.label}</p>{/if}
            {@render links(section.items)}
          </div>
        {/each}
      </nav>
      <LayoutChrome part="actions" {nav} />
      <LayoutChrome part="user" {nav} />
    </div>
  </LayoutDrawer>
{/if}
