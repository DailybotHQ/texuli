<script lang="ts">
/**
 * `?layout-slot=<id>`: one layout (or shell) with a routed screen that holds a
 * 600 px wide element in its own horizontal scroller, the way an app shows a
 * wide table. The layout component is rendered directly, not through
 * LayoutHost, so a phone width does not swap it for its mobile fallback.
 * tests/e2e/layouts-app.spec.ts checks the layout never grows past
 * the viewport: the screen slot shrinks and the wide element scrolls inside.
 */
import type { Component } from 'svelte';
import { registerAppLayouts } from 'texuli/layouts/app';
import { SettingsLayout } from 'texuli/layouts/auth-settings';
import { registerAuthSettingsLayouts } from 'texuli/layouts/auth-settings/register';
import 'texuli/layouts/content/blog';
import 'texuli/layouts/content/docs';
import 'texuli/layouts/content/editorial';
import { registerDashboardLayouts } from 'texuli/layouts/dashboard/register';
import { type LayoutId, type LayoutProps, loadLayout, type NavModel } from 'texuli/layouts/host';
import { registerMarketingLayouts } from 'texuli/layouts/marketing/register';
import { registerMobileLayouts } from 'texuli/layouts/mobile/register';
import { AppShell } from 'texuli/layouts/shells';

type Props = { id: string };

let { id }: Props = $props();

registerAppLayouts();
registerAuthSettingsLayouts();
registerDashboardLayouts();
registerMarketingLayouts();
registerMobileLayouts();

const NAV: NavModel = {
  brand: { label: 'Harbor', href: '#/' },
  sections: [
    {
      id: 'main',
      items: [
        { id: 'overview', label: 'Overview', href: '#/overview', icon: 'home' },
        { id: 'reports', label: 'Reports', href: '#/reports', icon: 'chart-line' },
        { id: 'inbox', label: 'Inbox', href: '#/inbox', icon: 'inbox' },
      ],
    },
  ],
  user: { name: 'Ada Park', detail: 'ada@harbor.example' },
};

let Layout = $state.raw<Component<LayoutProps> | null>(null);
let screen = $state<HTMLDivElement | undefined>();
let target = $state<HTMLElement | undefined>();
let failed = $state(false);

$effect(() => {
  if (id === 'settings' || id === 'app-shell') return;
  const pending = loadLayout(id as LayoutId);
  if (!pending) {
    failed = true;
    return;
  }
  void pending.then(
    (mod) => {
      Layout = mod.default;
    },
    () => {
      failed = true;
    }
  );
});

$effect(() => {
  if (screen && target && !target.contains(screen)) target.append(screen);
});

function mountScreen(node: HTMLElement): void {
  target = node;
}

const ready = $derived(
  id === 'settings' || id === 'app-shell' ? screen !== undefined : target !== undefined
);
</script>

{#snippet wide()}
  <div class="screen" data-slot-screen>
    <h2>Quarterly table</h2>
    <div class="scroller" data-slot-scroller>
      <div class="wide" data-slot-wide>A fixed 600 px wide element.</div>
    </div>
  </div>
{/snippet}

<div class="root" data-slot-root={id} data-ready={ready ? 'true' : 'false'}>
  {#if failed}
    <p role="alert">Unknown layout: {id}</p>
  {:else if id === 'settings'}
    <SettingsLayout
      title="Settings"
      sections={[{ id: 'profile', label: 'Profile' }]}
      startWithList={false}
    >
      {#snippet children()}
        <div bind:this={screen}>{@render wide()}</div>
      {/snippet}
    </SettingsLayout>
  {:else if id === 'app-shell'}
    <AppShell mainElement="div">
      <div bind:this={screen}>{@render wide()}</div>
    </AppShell>
  {:else if Layout}
    <!-- Phone layouts that start on a list (master-detail) open the detail, so the screen shows. -->
    <Layout {mountScreen} nav={NAV} path="/overview" options={{ title: 'Overview', detailActive: true }} />
    <div hidden>
      <div bind:this={screen}>{@render wide()}</div>
    </div>
  {/if}
</div>

<style>
  /* LayoutHost makes its element an inline-size container; layouts query it. */
  .root {
    inline-size: 100%;
    container-type: inline-size;
  }
  .scroller {
    overflow-x: auto;
  }
  .wide {
    inline-size: 600px;
    block-size: 3rem;
  }
</style>
