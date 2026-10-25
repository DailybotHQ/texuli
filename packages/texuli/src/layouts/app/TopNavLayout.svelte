<script lang="ts">
import { safeHref } from '@texuli/core/url-policy';
import type { ClassValue } from '../../internal/cx.ts';
import { cx } from '../../internal/cx.ts';
import LayoutChrome from '../host/LayoutChrome.svelte';
import { onNavigate } from '../host/layout-kit.ts';
import NavIcon from '../host/NavIcon.svelte';
import { navBadge, resolveNav } from '../host/nav-model.ts';
import { isNestedInMain } from '../host/nested-main.ts';
import type { LayoutProps } from '../host/registry.ts';
import { currentHashPath } from './model.ts';
import './app.css';

type Props = LayoutProps & {
  navigationLabel?: string;
  skipLabel?: string;
  class?: ClassValue;
};

let {
  mountScreen,
  nav,
  path,
  navigationLabel = 'Main navigation',
  skipLabel,
  class: className,
}: Props = $props();

const uid = $props.id();
const mainId = `${uid}-main`;
let hashPath = $state('/');
let target = $state<HTMLElement | undefined>();
let root = $state<HTMLElement | undefined>();
let nested = $state(false);

$effect(() => {
  nested = isNestedInMain(root);
});
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
const items = $derived(resolved.flatMap((section) => section.items));
const active = $derived(items.find((item) => item.inTrail));
const tabs = $derived(active?.children ?? []);
</script>

<div
  bind:this={root}
  class={cx('tx-app-layout', 'tx-app-layout--top-nav', className)}
  data-tx-app-layout="top-nav"
>
  <LayoutChrome part="skip" {mainId} {nav} {skipLabel} />
  <header class="tx-app-layout__top-header">
    <div class="tx-app-layout__top-row">
      <LayoutChrome part="brand" {nav} />
      <nav aria-label={navigationLabel} class="tx-app-layout__top-nav">
        <ul>
          {#each items as item (item.id)}
            {@const href = safeHref(item.href, 'developer')}
            {@const badge = navBadge(item.badge)}
            <li>
              {#if href}
                <a href={href} aria-current={item.active ? 'page' : undefined} data-trail={item.inTrail || undefined}>
                  {#if item.icon}<NavIcon icon={item.icon} />{/if}
                  <span>{item.label}</span>
                  {#if badge !== undefined}<span class="tx-app-layout__badge">{badge}</span>{/if}
                </a>
              {:else}
                <span aria-disabled="true">{item.label}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </nav>
      <div class="tx-app-layout__top-actions">
        <LayoutChrome part="actions" {nav} />
        <LayoutChrome part="user" {nav} compact />
      </div>
    </div>
    {#if tabs.length}
      <nav aria-label={`${active?.label ?? navigationLabel} sections`} class="tx-app-layout__top-tabs">
        <ul>
          {#each tabs as item (item.id)}
            {@const href = safeHref(item.href, 'developer')}
            <li>
              {#if href}
                <a href={href} aria-current={item.active ? 'page' : undefined}>{item.label}</a>
              {:else}
                <span aria-disabled="true">{item.label}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </nav>
    {/if}
  </header>
  <svelte:element
    this={nested ? 'div' : 'main'}
    bind:this={target}
    id={mainId}
    class="tx-app-layout__screen"
    tabindex="-1"
  ></svelte:element>
</div>
