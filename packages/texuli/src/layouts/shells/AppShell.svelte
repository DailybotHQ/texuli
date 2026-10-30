<script lang="ts">
import { lazyChunk } from '@texuli/core/lazy';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { closeWhenWide } from '../host/layout-kit.ts';
import { setAppShellContext } from './context.ts';
import DrawerScope from './DrawerScope.svelte';
import './shells.css';

/**
 * A generic app frame: sidebar, header, command bar, main content, bottom
 * navigation and a notification-center corner. No device or browser chrome:
 * a prototyping tool draws its frames around this.
 *
 * The sidebar is a column when the shell is at least 64rem wide and a drawer
 * below that (`sidebarOpen`, bindable). The header and sidebar reach the
 * drawer through `getAppShellContext()`. The drawer (`texuli/layouts/host/drawer`)
 * loads on its first open, so a wide-only app never pays for it.
 */
type OwnProps = {
  /** Usually a sidebar: a column on wide shells, the drawer's content on narrow ones. */
  sidebar?: Snippet;
  /** Usually a header; its menu button toggles the drawer through the shell context. */
  header?: Snippet;
  /** A command bar (search, command palette trigger) above the main content. */
  commandBar?: Snippet;
  /** Bottom navigation for narrow shells; hidden on wide ones. */
  bottomNav?: Snippet;
  /** A notification center or toast viewport, pinned to the block-end, inline-end corner. */
  notifications?: Snippet;
  children: Snippet;
  /** The narrow-screen drawer (bindable). */
  sidebarOpen?: boolean;
  /** Accessible name of the sidebar landmark and the drawer. Default "Navigation". */
  sidebarLabel?: string;
  /** The drawer's close button. Default "Close navigation". */
  closeLabel?: string;
  /** The skip link. Default "Skip to content". */
  skipLabel?: string;
  /** Accessible name of the notification region. Default "Notifications". */
  notificationsLabel?: string;
  /** `id` of the main region the skip link focuses. Default `main-content`. */
  mainId?: string;
  /** `div` for a shell nested inside another page's `<main>` (previews, demos): no landmarks. */
  mainElement?: 'main' | 'div';
  class?: ClassValue;
  mainClass?: ClassValue;
  sidebarClass?: ClassValue;
  /** The shell's root element (bindable). */
  ref?: HTMLElement | null;
};
/** Other attributes (`id`, `aria-*`, `data-*`, `style`, handlers) land on the root element. */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children'>;

let {
  sidebar,
  header,
  commandBar,
  bottomNav,
  notifications,
  children,
  sidebarOpen = $bindable(false),
  sidebarLabel: sidebarLabelProp,
  closeLabel: closeLabelProp,
  skipLabel: skipLabelProp,
  notificationsLabel: notificationsLabelProp,
  mainId = 'main-content',
  mainElement = 'main',
  class: className,
  mainClass,
  sidebarClass,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const sidebarLabel = $derived(
  sidebarLabelProp ?? msg('texuli.app-shell.sidebar-label', 'Navigation')
);
const closeLabel = $derived(
  closeLabelProp ?? msg('texuli.app-shell.close-label', 'Close navigation')
);
const skipLabel = $derived(skipLabelProp ?? msg('texuli.app-shell.skip-label', 'Skip to content'));
const notificationsLabel = $derived(
  notificationsLabelProp ?? msg('texuli.app-shell.notifications-label', 'Notifications')
);

const root = $derived(ref ?? undefined);
/** Previews inside a page `<main>` drop nested landmarks (one main per page). */
let nested = $state(false);
$effect(() => {
  try {
    nested = Boolean(root?.parentElement?.closest('main'));
  } catch {
    nested = false;
  }
});
const landmarks = $derived(mainElement === 'main' && !nested);

type DrawerComponent = typeof import('../host/LayoutDrawer.svelte').default;
let Drawer = $state<DrawerComponent>();
/** True once the drawer chunk has resolved (or is unnecessary). */
let drawerReady = $state(true);

$effect(() => {
  if (!sidebar || Drawer) {
    drawerReady = true;
    return;
  }
  if (!sidebarOpen) return;
  drawerReady = false;
  let alive = true;
  lazyChunk('texuli:shell:layout-drawer', () => import('../host/LayoutDrawer.svelte')).then(
    (module) => {
      if (!alive) return;
      Drawer = module.default;
      drawerReady = true;
    },
    () => {
      if (alive) drawerReady = true;
    }
  );
  return () => {
    alive = false;
  };
});

function focusMain(event: MouseEvent): void {
  // A hash router would read "#main-content" as a route, so focus main instead.
  event.preventDefault();
  root?.ownerDocument.getElementById(mainId)?.focus();
}

// The drawer exists only on narrow shells: once the shell is wide, close it,
// so focus is never trapped in an invisible modal. 64rem at the default 16px.
$effect(() => {
  if (!sidebarOpen || !root) return;
  return closeWhenWide(root, 1024, () => {
    sidebarOpen = false;
  });
});

setAppShellContext({
  get sidebarOpen() {
    return sidebarOpen;
  },
  openSidebar: () => {
    sidebarOpen = true;
  },
  closeSidebar: () => {
    sidebarOpen = false;
  },
  toggleSidebar: () => {
    sidebarOpen = !sidebarOpen;
  },
});
</script>

<div
  {...rest}
  bind:this={ref}
  class={cx('tx-app-shell', className)}
  data-tx-app-shell=""
  data-drawer-ready={drawerReady ? 'true' : 'false'}
>
  <a href={`#${mainId}`} class="tx-app-shell__skip" onclick={focusMain}>{skipLabel}</a>

  {#if sidebar}
    <!-- A landmark, unless the shell sits inside another page's <main>. -->
    <svelte:element
      this={landmarks ? 'aside' : 'div'}
      aria-label={landmarks ? sidebarLabel : undefined}
      class={cx('tx-app-shell__sidebar', sidebarClass)}
      data-tx-app-shell-slot="sidebar"
    >
      {@render sidebar()}
    </svelte:element>

    {#if Drawer}
      <Drawer bind:open={sidebarOpen} label={sidebarLabel} {closeLabel}>
        <DrawerScope>{@render sidebar()}</DrawerScope>
      </Drawer>
    {/if}
  {/if}

  <div class="tx-app-shell__column">
    {@render header?.()}
    {#if commandBar}
      <div class="tx-app-shell__command-bar" data-tx-app-shell-slot="command-bar">
        {@render commandBar()}
      </div>
    {/if}
    <svelte:element
      this={mainElement === 'div' || nested ? 'div' : 'main'}
      id={mainId}
      tabindex="-1"
      class={cx('tx-app-shell__main', mainClass)}
      data-bottom-nav={bottomNav ? '' : undefined}
      data-tx-app-shell-slot="main"
    >
      {@render children()}
    </svelte:element>
    {#if bottomNav}
      <div class="tx-app-shell__bottom-nav" data-tx-app-shell-slot="bottom-nav">{@render bottomNav()}</div>
    {/if}
  </div>

  {#if notifications}
    <svelte:element
      this={landmarks ? 'section' : 'div'}
      aria-label={landmarks ? notificationsLabel : undefined}
      class="tx-app-shell__notifications"
      data-tx-app-shell-slot="notifications"
    >
      {@render notifications()}
    </svelte:element>
  {/if}
</div>
