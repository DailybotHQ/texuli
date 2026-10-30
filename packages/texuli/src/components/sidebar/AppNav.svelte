<script lang="ts">
import { lazyChunk } from '@texuli/core/lazy';
import type { HrefTrust } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue } from '../../internal/cx.ts';
import Sidebar from './Sidebar.svelte';
import type { SidebarItem, SidebarSection } from './types.ts';
import { appNavClass, type SidebarVariant } from './variants.ts';
import './sidebar.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  items?: readonly SidebarItem[];
  sections?: readonly SidebarSection[];
  collapsed?: boolean;
  collapsible?: boolean;
  variant?: SidebarVariant;
  /** Desktop brand slot. */
  header?: Snippet<[{ collapsed: boolean }]>;
  footer?: Snippet<[{ collapsed: boolean }]>;
  itemIcon?: Snippet<[item: SidebarItem, collapsed: boolean]>;
  /** Main content. */
  children?: Snippet;
  /** Render the content container as a main landmark (disable when nested in another main). */
  mainLandmark?: boolean;
  /** Optional top bar trailing content (search, user menu). */
  topBar?: Snippet;
  label?: string;
  menuLabel?: string;
  drawerTitle?: string;
  closeLabel?: string;
  hrefTrust?: HrefTrust;
  /** Controlled mobile drawer. */
  mobileOpen?: boolean;
  class?: ClassValue;
};

type DrawerComponent = typeof import('./AppNavDrawer.svelte')['default'];

let {
  items,
  sections,
  collapsed = $bindable(false),
  collapsible = true,
  variant = 'default',
  header,
  footer,
  itemIcon,
  children,
  mainLandmark = true,
  topBar,
  label: labelProp,
  menuLabel: menuLabelProp,
  drawerTitle: drawerTitleProp,
  closeLabel: closeLabelProp,
  hrefTrust = 'developer',
  mobileOpen = $bindable(false),
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const label = $derived(labelProp ?? msg('texuli.app-nav.label', 'Main'));
const menuLabel = $derived(menuLabelProp ?? msg('texuli.app-nav.menu-label', 'Open navigation'));
const drawerTitle = $derived(drawerTitleProp ?? msg('texuli.app-nav.drawer-title', 'Navigation'));
const closeLabel = $derived(
  closeLabelProp ?? msg('texuli.app-nav.close-label', 'Close navigation')
);

let menuButton = $state<HTMLButtonElement | undefined>();
let MobileDrawer = $state.raw<DrawerComponent | null>(null);
/** True when the mobile drawer chunk is ready (or closed and not loading). */
let drawerReady = $state(true);

function ensureDrawer(): Promise<void> {
  if (MobileDrawer) {
    drawerReady = true;
    return Promise.resolve();
  }
  drawerReady = false;
  return lazyChunk('texuli:app-nav:drawer', () => import('./AppNavDrawer.svelte')).then(
    ({ default: component }) => {
      MobileDrawer = component;
      drawerReady = true;
    },
    () => {
      drawerReady = true;
    }
  );
}

$effect(() => {
  if (mobileOpen) void ensureDrawer();
});

function toggleDrawer(): void {
  mobileOpen = !mobileOpen;
  if (mobileOpen) void ensureDrawer();
}

const rootClass = $derived(
  appNavClass({
    class: className,
  })
);
</script>

<div
  bind:this={ref}
  class={rootClass}
  data-tx-app-nav
  data-collapsed={collapsed ? '' : undefined}
  data-mobile-open={mobileOpen ? '' : undefined}
  data-drawer-ready={drawerReady ? 'true' : 'false'}
  {...rest}
>
  <div class="tx-app-nav__sidebar" data-tx-app-nav-sidebar>
    <Sidebar
      {items}
      {sections}
      bind:collapsed
      {collapsible}
      {variant}
      {header}
      {footer}
      {itemIcon}
      {label}
      {hrefTrust}
    />
  </div>

  <header class="tx-app-nav__header" data-tx-app-nav-header>
    <button
      bind:this={menuButton}
      type="button"
      class="tx-app-nav__menu-btn"
      aria-label={menuLabel}
      aria-haspopup="dialog"
      aria-expanded={mobileOpen}
      data-tx-app-nav-menu
      onclick={toggleDrawer}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        <path
          d="M2.5 4.25h11M2.5 8h11M2.5 11.75h11"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
    {@render topBar?.()}
  </header>

  {#if mainLandmark}
    <main class="tx-app-nav__main" data-tx-app-nav-main id="tx-app-nav-main">
      {@render children?.()}
    </main>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex: the named region is keyboard-focusable so overflowing main content can scroll. -->
    <div
      class="tx-app-nav__main"
      data-tx-app-nav-main
      role="region"
      aria-label={label}
      tabindex="0"
    >
      {@render children?.()}
    </div>
  {/if}
  {#if MobileDrawer}
    <MobileDrawer
      bind:open={mobileOpen}
      {items}
      {sections}
      {variant}
      {header}
      {footer}
      {itemIcon}
      {label}
      {drawerTitle}
      {closeLabel}
      {hrefTrust}
      opener={() => menuButton}
    />
  {/if}
</div>
