<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Breadcrumb, Pagination, NavigationMenu, Sidebar and AppNav with fictional
 * example.com links. Pagination and the menu are fully operable.
 */
import { Breadcrumb, NavigationMenu, Pagination } from 'texuli/navigation';
import { AppNav, Sidebar, type SidebarSection } from 'texuli/sidebar';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, num, bool, pick } = readers(() => values);

const SECTIONS: SidebarSection[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'inbox', label: 'Inbox', href: 'https://example.com/inbox', active: true, badge: 3 },
      { id: 'notes', label: 'Notes', href: 'https://example.com/notes' },
      { id: 'archive', label: 'Archive', href: 'https://example.com/archive' },
    ],
  },
  {
    label: 'Team',
    items: [{ id: 'people', label: 'People', href: 'https://example.com/people', badge: 12 }],
  },
];

const TRAIL = [
  { label: 'Workspace', href: 'https://example.com/' },
  { label: 'Projects', href: 'https://example.com/projects' },
  { label: 'Harbor', href: 'https://example.com/projects/harbor' },
  { label: 'Notes', href: 'https://example.com/projects/harbor/notes' },
  { label: 'Launch plan' },
];

let page = $state(1);
let host = $state<HTMLDivElement | undefined>();
/** AppNav adds no second main when the stage already sits in a page <main>. */
let insideMain = $state(true);
$effect(() => {
  insideMain = Boolean(host?.parentElement?.closest('main'));
});
let collapsed = $state(false);
let menu = $state('');

$effect(() => {
  page = Math.max(1, Math.round(num('page', 1)));
});
$effect(() => {
  collapsed = bool('collapsed');
});
</script>

<div bind:this={host} class="stage" data-tx-nav-stage={componentId}>
  {#if componentId === 'breadcrumb'}
    <Breadcrumb
      items={TRAIL}
      label={str('label', 'Breadcrumb')}
      size={pick('size', ['sm', 'md', 'lg'] as const, 'md')}
      maxItems={num('maxItems', 0)}
      separatorLabel={str('separatorLabel', 'Separator')}
    />
    <Breadcrumb items={TRAIL} label="Collapsed breadcrumb" maxItems={3} size="sm" />
  {:else if componentId === 'pagination'}
    <Pagination.Root
      bind:page
      pageCount={Math.max(1, Math.round(num('pageCount', 12)))}
      size={pick('size', ['sm', 'md', 'lg'] as const, 'md')}
      variant={pick('variant', ['outline', 'soft'] as const, 'outline')}
      label={str('label', 'Results pages')}
    />
    <p class="state" role="status">Page {page}</p>
  {:else if componentId === 'navigation-menu'}
    <NavigationMenu.Root
      aria-label="Product"
      bind:value={menu}
      orientation={pick('orientation', ['horizontal', 'vertical'] as const, 'horizontal')}
    >
      <NavigationMenu.List>
        <NavigationMenu.Item value="products">
          <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="https://example.com/analytics">Analytics</NavigationMenu.Link>
            <NavigationMenu.Link href="https://example.com/automation">Automation</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="docs">
          <NavigationMenu.Trigger>Docs</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="https://example.com/guides">Guides</NavigationMenu.Link>
            <NavigationMenu.Link href="https://example.com/api">API</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="pricing">
          <NavigationMenu.Link href="https://example.com/pricing" active>Pricing</NavigationMenu.Link>
        </NavigationMenu.Item>
        <NavigationMenu.Indicator />
      </NavigationMenu.List>
    </NavigationMenu.Root>
  {:else if componentId === 'sidebar'}
    <div class="frame">
      <Sidebar
        sections={SECTIONS}
        bind:collapsed
        collapsible={bool('collapsible', true)}
        variant={pick('variant', ['default', 'inset'] as const, 'default')}
        label={str('label', 'Workspace navigation')}
      >
        {#snippet header({ collapsed: c })}
          <strong>{c ? 'HN' : 'Harbor Notes'}</strong>
        {/snippet}
      </Sidebar>
    </div>
  {:else}
    <div class="frame frame--app">
      <AppNav
        sections={SECTIONS}
        bind:collapsed
        collapsible={bool('collapsible', true)}
        variant={pick('variant', ['default', 'inset'] as const, 'default')}
        label={str('label', 'Harbor workspace')}
        menuLabel={str('menuLabel', 'Open navigation')}
        drawerTitle={str('drawerTitle', 'Navigation')}
        mainLandmark={!insideMain}
      >
        {#snippet header()}
          <strong>Harbor</strong>
        {/snippet}
        <h1 class="screen-title">Inbox</h1>
        <p>Three threads need a reply today.</p>
      </AppNav>
    </div>
  {/if}
</div>

<style>
  .stage {
    display: grid;
    gap: 0.75rem;
  }
  .frame {
    display: flex;
    min-block-size: 18rem;
  }
  .frame--app {
    min-block-size: 24rem;
  }
  .screen-title {
    margin: 0;
    font-size: 1.25rem;
  }
  .state {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
