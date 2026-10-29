<script lang="ts">
import AppNav from '../../components/sidebar/AppNav.svelte';
import type { SidebarItem } from '../../components/sidebar/types.ts';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import LayoutChrome from '../host/LayoutChrome.svelte';
import { onNavigate } from '../host/layout-kit.ts';
import NavIcon from '../host/NavIcon.svelte';
import { resolveNav } from '../host/nav-model.ts';
import type { LayoutProps } from '../host/registry.ts';
import { appSidebarSections, currentHashPath } from './model.ts';
import './app.css';

type Props = LayoutProps & {
  skipLabel?: string;
  menuLabel?: string;
  closeLabel?: string;
  class?: ClassValue;
};

let {
  mountScreen,
  nav,
  path,
  skipLabel,
  menuLabel,
  closeLabel,
  class: className,
}: Props = $props();
const msg = useMessages();

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
const sections = $derived(appSidebarSections(resolved));
</script>

<div
  class={cx('tx-app-layout', 'tx-app-layout--sidebar', className)}
  data-tx-app-layout="sidebar"
>
  <LayoutChrome part="skip" {mainId} {nav} {skipLabel} />
  <AppNav
    {sections}
    label="Main"
    {menuLabel}
    closeLabel={closeLabel ?? msg('texuli.sidebar-layout.close-navigation', 'Close navigation')}
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
    <div bind:this={target} id={mainId} class="tx-app-layout__screen" tabindex="-1"></div>
  </AppNav>
</div>
