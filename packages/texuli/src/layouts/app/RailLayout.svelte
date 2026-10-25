<script lang="ts">
/**
 * Icon rail layout: a narrow primary nav of icons (tooltips + accessible names).
 * Expands to labeled items at wide widths. Host falls back to mobile-tabs below minWidth.
 */

import Tooltip from '../../components/tooltip/Tooltip.svelte';
import type { ClassValue } from '../../internal/cx.ts';
import { cx } from '../../internal/cx.ts';
import LayoutChrome from '../host/LayoutChrome.svelte';
import { onNavigate } from '../host/layout-kit.ts';
import NavIcon from '../host/NavIcon.svelte';
import { navBadge, type ResolvedNavItem, resolveNav } from '../host/nav-model.ts';
import type { LayoutProps } from '../host/registry.ts';
import { currentHashPath } from './model.ts';
import './app.css';

type Props = LayoutProps & {
  skipLabel?: string;
  /** Accessible name for the rail landmark. */
  railLabel?: string;
  /** Force expanded labels (also expands from container width via CSS). */
  expanded?: boolean;
  class?: ClassValue;
};

let {
  mountScreen,
  nav,
  path,
  options,
  skipLabel,
  railLabel = 'Main',
  expanded = false,
  class: className,
}: Props = $props();

const uid = $props.id();
const mainId = `${uid}-main`;
let hashPath = $state('/');
let target = $state<HTMLDivElement | undefined>();

$effect(() => {
  if (path !== undefined) {
    hashPath = path;
    return;
  }
  const syncPath = () => (hashPath = currentHashPath());
  syncPath();
  return onNavigate(syncPath);
});
$effect(() => {
  if (target) mountScreen(target);
});

const resolved = $derived(resolveNav(nav ?? { sections: [] }, path ?? hashPath));
const items = $derived(resolved.flatMap((section) => section.items) as readonly ResolvedNavItem[]);
const expandOpt = $derived(expanded || options?.expanded === true || options?.expanded === 'true');

function itemHref(item: ResolvedNavItem): string {
  return item.href.startsWith('#') || item.href.startsWith('/') ? item.href : `#${item.href}`;
}
</script>

<div
  class={cx('tx-app-layout', 'tx-app-layout--rail', className)}
  data-tx-app-layout="rail"
  data-expanded={expandOpt ? 'true' : undefined}
>
  <LayoutChrome part="skip" {mainId} {nav} {skipLabel} />
  <div class="tx-app-layout__rail-shell">
    <nav class="tx-app-layout__rail" aria-label={railLabel} data-tx-rail="">
      <div class="tx-app-layout__rail-brand">
        <LayoutChrome part="brand" {nav} compact={!expandOpt} />
      </div>
      <ul class="tx-app-layout__rail-list">
        {#each items as item (item.id)}
          {@const badge = navBadge(item.badge)}
          {@const href = itemHref(item)}
          <li>
            <Tooltip content={item.label} side="right" delayDuration={200}>
              {#snippet children({ props })}
                <a
                  {...props}
                  {href}
                  class="tx-app-layout__rail-link"
                  aria-label={item.label}
                  aria-current={item.active || item.inTrail ? 'page' : undefined}
                  data-trail={item.inTrail ? '' : undefined}
                  data-tx-rail-item={item.id}
                >
                  <span class="tx-app-layout__rail-icon" aria-hidden="true">
                    <NavIcon icon={item.icon} />
                  </span>
                  <span class="tx-app-layout__rail-label" aria-hidden="true">{item.label}</span>
                  {#if badge !== undefined}
                    <span class="tx-app-layout__badge" data-tx-rail-badge="">{badge}</span>
                  {/if}
                </a>
              {/snippet}
            </Tooltip>
          </li>
        {/each}
      </ul>
      <div class="tx-app-layout__rail-footer">
        <LayoutChrome part="actions" {nav} />
        <LayoutChrome part="user" {nav} compact />
      </div>
    </nav>
    <div bind:this={target} id={mainId} class="tx-app-layout__screen" tabindex="-1" role="main"></div>
  </div>
</div>
