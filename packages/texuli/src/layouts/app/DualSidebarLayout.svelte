<script lang="ts">
import AppNav from '../../components/sidebar/AppNav.svelte';
import type { SidebarItem } from '../../components/sidebar/types.ts';
import type { ClassValue } from '../../internal/cx.ts';
import { cx } from '../../internal/cx.ts';
import LayoutChrome from '../host/LayoutChrome.svelte';
import { onNavigate } from '../host/layout-kit.ts';
import NavIcon from '../host/NavIcon.svelte';
import { resolveNav } from '../host/nav-model.ts';
import { isNestedInMain } from '../host/nested-main.ts';
import type { LayoutProps } from '../host/registry.ts';
import { appSidebarSections, currentHashPath } from './model.ts';
import './app.css';

type Props = LayoutProps & {
  contextLabel?: string;
  skipLabel?: string;
  menuLabel?: string;
  closeLabel?: string;
  class?: ClassValue;
};

let {
  mountScreen,
  nav,
  path,
  aside,
  contextLabel = 'Context panel',
  skipLabel,
  menuLabel,
  closeLabel,
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
const sections = $derived(appSidebarSections(resolved));
</script>

<div
  bind:this={root}
  class={cx('tx-app-layout', 'tx-app-layout--three-pane', className)}
  data-tx-app-layout="three-pane"
>
  <LayoutChrome part="skip" {mainId} {nav} {skipLabel} />
  <!--
    One main landmark: AppNav's, unless the layout already sits inside a page
    <main> (then none). The screen is its focusable skip target, never a second main.
  -->
  <AppNav
    {sections}
    mainLandmark={!nested}
    label="Main"
    {menuLabel}
    closeLabel={closeLabel ?? 'Close navigation'}
    hrefTrust="developer"
  >
    {#snippet itemIcon(item: SidebarItem)}
      {#if item.icon}
        <NavIcon icon={item.icon as import('../host/nav-model.ts').NavIconRef} />
      {:else}
        {(item.shortLabel ?? item.label).slice(0, 2)}
      {/if}
    {/snippet}
    {#snippet header({ collapsed })}
      <LayoutChrome part="brand" {nav} compact={collapsed} />
    {/snippet}
    {#snippet topBar()}
      <LayoutChrome part="actions" {nav} />
      <LayoutChrome part="user" {nav} compact />
    {/snippet}
    <div class="tx-app-layout__three-pane">
      <div bind:this={target} id={mainId} class="tx-app-layout__screen" tabindex="-1"></div>
      {#if aside}
        <aside class="tx-app-layout__context" aria-label={contextLabel}>{@render aside()}</aside>
      {/if}
    </div>
  </AppNav>
</div>
