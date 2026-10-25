<script lang="ts">
import {
  AppNav,
  Sidebar,
  type SidebarItem,
  type SidebarSection,
  type SidebarVariant,
} from '../../src/components/sidebar/index.ts';

const defaultSections: SidebarSection[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'inbox', label: 'Inbox', href: 'https://example.com/inbox', active: true, badge: 3 },
      { id: 'notes', label: 'Notes', href: 'https://example.com/notes' },
      { id: 'blocked', label: 'Blocked', href: 'javascript:alert(1)', disabled: true },
    ],
  },
];

let {
  mode = 'sidebar' as 'sidebar' | 'appnav',
  sections = defaultSections,
  items = undefined as readonly SidebarItem[] | undefined,
  collapsed = $bindable(false),
  collapsible = true,
  drawer = false,
  variant = 'default' as SidebarVariant,
  mobileOpen = $bindable(false),
  mainLandmark = true,
}: {
  mode?: 'sidebar' | 'appnav';
  sections?: readonly SidebarSection[];
  items?: readonly SidebarItem[];
  collapsed?: boolean;
  collapsible?: boolean;
  drawer?: boolean;
  variant?: SidebarVariant;
  mobileOpen?: boolean;
  mainLandmark?: boolean;
} = $props();
</script>

{#if mode === 'appnav'}
  <AppNav {sections} bind:collapsed bind:mobileOpen {collapsible} {variant} {mainLandmark}>
    {#snippet header()}
      <span>Brand</span>
    {/snippet}
    <p>Main content</p>
  </AppNav>
{:else}
  <div style:block-size="20rem">
    <Sidebar
      {sections}
      {items}
      bind:collapsed
      {collapsible}
      {drawer}
      {variant}
      label="Main"
    >
      {#snippet header()}
        <span>Brand</span>
      {/snippet}
    </Sidebar>
  </div>
{/if}
