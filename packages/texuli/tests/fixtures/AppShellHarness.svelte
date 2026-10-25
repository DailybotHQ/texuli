<script lang="ts">
import { AppShell, type AppShellContext } from '../../src/layouts/shells/index.ts';
import ShellHeaderProbe from './ShellHeaderProbe.svelte';
import ShellSidebarProbe from './ShellSidebarProbe.svelte';

type Props = {
  sidebarOpen?: boolean;
  withSidebar?: boolean;
  withSlots?: boolean;
  mainElement?: 'main' | 'div';
  sidebarLabel?: string;
  closeLabel?: string;
  skipLabel?: string;
  notificationsLabel?: string;
  onShell?: (shell: AppShellContext | undefined) => void;
};

let {
  sidebarOpen = $bindable(false),
  withSidebar = true,
  withSlots = true,
  mainElement = 'main',
  sidebarLabel,
  closeLabel,
  skipLabel,
  notificationsLabel,
  onShell,
}: Props = $props();
</script>

{#snippet sidebar()}<ShellSidebarProbe />{/snippet}
{#snippet header()}<ShellHeaderProbe {onShell} />{/snippet}
{#snippet commandBar()}<input type="search" aria-label="Search everything" />{/snippet}
{#snippet bottomNav()}<nav aria-label="Tabs"><a href="#/home">Home</a></nav>{/snippet}
{#snippet notifications()}<p>2 fictional alerts</p>{/snippet}

<AppShell
  bind:sidebarOpen
  sidebar={withSidebar ? sidebar : undefined}
  header={withSlots ? header : undefined}
  commandBar={withSlots ? commandBar : undefined}
  bottomNav={withSlots ? bottomNav : undefined}
  notifications={withSlots ? notifications : undefined}
  {mainElement}
  {sidebarLabel}
  {closeLabel}
  {skipLabel}
  {notificationsLabel}
  class="consumer-shell"
  mainClass="consumer-main"
>
  <h1>Dashboard</h1>
  <p>Fictional harbor metrics.</p>
</AppShell>
