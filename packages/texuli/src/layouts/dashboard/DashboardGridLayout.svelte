<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import { type ClassValue, cx } from '../../internal/cx.ts';
import LayoutChrome from '../host/LayoutChrome.svelte';
import { onNavigate } from '../host/layout-kit.ts';
import {
  isNavPathActive,
  type NavModel,
  navBadge,
  navPath,
  type ResolvedNavItem,
  resolveNav,
} from '../host/nav-model.ts';
import { isNestedInMain } from '../host/nested-main.ts';
import type { LayoutProps } from '../host/registry.ts';
import './dashboard.css';

/**
 * `dashboard-grid` layout: top chrome + container-query widget grid.
 * Screens mount into the grid; children with `data-span="2|3|4"` span columns.
 * Options: `dense` (boolean), `title` (string), `gap` (CSS length string).
 */

type Props = LayoutProps & {
  class?: ClassValue;
  hrefTrust?: HrefTrust;
};

let {
  mountScreen,
  nav,
  path,
  options,
  class: className,
  hrefTrust = 'developer',
}: Props = $props();

const uid = $props.id();
const mainId = `tx-dashboard-${uid}-main`;
const dense = $derived(options?.dense === true);
const title = $derived(
  typeof options?.title === 'string' && options.title.length > 0
    ? options.title
    : (nav?.brand?.label ?? 'Dashboard')
);
const gap = $derived(
  typeof options?.gap === 'string' && options.gap.length > 0 ? options.gap : '1rem'
);

let hashPath = $state('');
let gridTarget = $state<HTMLElement | undefined>();
let root = $state<HTMLElement | undefined>();
let nested = $state(false);

$effect(() => {
  nested = isNestedInMain(root);
});

function readHashPath(): string {
  try {
    if (typeof location !== 'undefined') return navPath(location.hash || '#/');
  } catch {
    /* SSR / private contexts */
  }
  return '/';
}

$effect(() => {
  hashPath = readHashPath();
  return onNavigate(() => {
    hashPath = readHashPath();
  });
});

$effect(() => {
  if (gridTarget) mountScreen(gridTarget);
});

const activePath = $derived(path ?? hashPath);
const sections = $derived(resolveNav(nav ?? ({ sections: [] } satisfies NavModel), activePath));
const primaryItems = $derived(
  sections.flatMap((section) => section.items).filter((item) => !item.children?.length)
);

function itemHref(item: ResolvedNavItem): string | undefined {
  return safeHref(item.href, hrefTrust);
}

function itemActive(item: ResolvedNavItem): boolean {
  return item.active || isNavPathActive(item.href, activePath);
}
</script>

<div
  bind:this={root}
  class={cx('tx-layout-dashboard', dense && 'tx-layout-dashboard--dense', className)}
  data-tx-layout="dashboard-grid"
  data-dense={dense ? 'true' : 'false'}
  style:--tx-dashboard-gap={gap}
>
  <LayoutChrome part="skip" {mainId} />

  <header class="tx-layout-dashboard__header" data-tx-layout-chrome="header">
    <LayoutChrome part="brand" {nav} />
    {#if primaryItems.length > 0}
      <nav aria-label="Main">
        <ul class="tx-layout-dashboard__nav">
          {#each primaryItems as item (item.id)}
            {@const href = itemHref(item)}
            {@const badge = navBadge(item.badge)}
            <li>
              {#if href}
                <a
                  class="tx-layout-dashboard__link"
                  {href}
                  aria-current={itemActive(item) ? 'page' : undefined}
                >
                  <span>{item.label}</span>
                  {#if badge !== undefined && badge !== ''}
                    <span class="tx-layout-dashboard__badge" dir="ltr"><bdi>{badge}</bdi></span>
                  {/if}
                </a>
              {:else}
                <span class="tx-layout-dashboard__link">{item.label}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </nav>
    {:else}
      <h1 class="tx-layout-dashboard__title">{title}</h1>
    {/if}
    <div class="tx-layout-dashboard__tools">
      <LayoutChrome part="actions" {nav} />
      <LayoutChrome part="user" {nav} />
    </div>
  </header>

  <svelte:element
    this={nested ? 'div' : 'main'}
    id={mainId}
    class="tx-layout-dashboard__main"
    tabindex="-1"
    data-tx-layout-main
  >
    <div
      bind:this={gridTarget}
      class="tx-layout-dashboard__grid"
      data-tx-dashboard-grid
      data-tx-layout-screen-target
    ></div>
  </svelte:element>
</div>
