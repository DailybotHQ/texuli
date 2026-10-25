<script lang="ts">
import { AppNav, Sidebar, type SidebarSection } from 'texuli/sidebar';

const sections: SidebarSection[] = [
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
    items: [
      { id: 'people', label: 'People', href: 'https://example.com/people', badge: 12 },
      { id: 'settings', label: 'Settings', href: 'https://example.com/settings' },
    ],
  },
];

let collapsed = $state(true);
let collapsedRtl = $state(false);
</script>

<section data-example="texuli-sidebar" aria-labelledby="tx-sidebar-title">
  <h2 id="tx-sidebar-title">Sidebar and AppNav</h2>
  <p>Fictional Harbor Notes shell — sections, badges, collapse and a mobile drawer layout.</p>

  <h3>Default (expanded)</h3>
  <div data-axis="default" class="frame">
    <Sidebar {sections} collapsed={false} label="Workspace navigation">
      {#snippet header()}
        <strong>Harbor Notes</strong>
      {/snippet}
    </Sidebar>
  </div>

  <h3>Collapsed</h3>
  <div data-axis="collapsed" class="frame frame--narrow">
    <Sidebar {sections} bind:collapsed label="Collapsed navigation">
      {#snippet header({ collapsed: c })}
        <strong>{c ? 'HN' : 'Harbor Notes'}</strong>
      {/snippet}
    </Sidebar>
  </div>

  <h3>Inset variant</h3>
  <div data-axis="inset" class="frame frame--pad">
    <Sidebar {sections} variant="inset" collapsible={false} label="Inset navigation">
      {#snippet header()}
        <strong>Inset rail</strong>
      {/snippet}
    </Sidebar>
  </div>

  <h3>AppNav shell</h3>
  <div data-axis="app-nav" class="frame frame--app">
    <AppNav {sections} collapsed={false} label="Harbor workspace" mainLandmark={false}>
      {#snippet header()}
        <strong>Harbor</strong>
      {/snippet}
      {#snippet topBar()}
        <span class="top-title">Inbox</span>
      {/snippet}
      <p>Main canvas for Harbor Notes (fictional).</p>
    </AppNav>
  </div>

  <h3>RTL</h3>
  <div data-axis="rtl" dir="rtl" lang="ar" class="frame">
    <Sidebar
      bind:collapsed={collapsedRtl}
      sections={[
        {
          label: 'مساحة العمل',
          items: [
            { label: 'الوارد', href: 'https://example.com/ar/inbox', active: true, badge: 2 },
            { label: 'ملاحظات', href: 'https://example.com/ar/notes' },
          ],
        },
      ]}
      label="التنقل"
      collapseLabel="طي الشريط"
      expandLabel="توسيع الشريط"
    >
      {#snippet header()}
        <strong>ملاحظات</strong>
      {/snippet}
    </Sidebar>
  </div>

  <h3>Dark</h3>
  <div data-axis="dark" data-tx-mode="dark" class="frame dark-panel">
    <Sidebar {sections} collapsed={false} label="Dark navigation">
      {#snippet header()}
        <strong>Harbor Notes</strong>
      {/snippet}
    </Sidebar>
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1.25rem;
    padding: 1rem;
    max-inline-size: 52rem;
  }

  .frame {
    block-size: 22rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    overflow: hidden;
    background: var(--tx-background, Canvas);
  }

  .frame--narrow {
    max-inline-size: 5rem;
  }

  .frame--pad {
    padding: 0.5rem;
    background: var(--tx-muted, color-mix(in srgb, CanvasText 6%, Canvas));
  }

  .frame--app {
    block-size: 20rem;
  }

  .frame--app :global(.tx-app-nav) {
    block-size: 100%;
  }

  /* Force desktop sidebar visible in the capture regardless of viewport. */
  .frame--app :global(.tx-app-nav__sidebar) {
    display: block;
  }

  .frame--app :global(.tx-app-nav__menu-btn) {
    display: inline-flex;
  }

  .top-title {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .dark-panel {
    --tx-foreground: #f4f4f5;
    --tx-muted-foreground: #c8cdd4;
    --tx-border: #8394a5;
    --tx-surface: #0f1115;
    --tx-background: #0a0a0a;
    --tx-foreground: #fafafa;
    --tx-sidebar: #17191f;
    --tx-sidebar-foreground: #f4f4f5;
    background: var(--tx-background);
    color: var(--tx-foreground);
  }

  @media (forced-colors: active) {
    .dark-panel, [data-tx-mode="dark"] {
      background: Canvas !important;
      color: CanvasText !important;
      border-color: CanvasText !important;
      --tx-background: Canvas;
      --tx-foreground: CanvasText;
      --tx-muted-foreground: CanvasText;
      --tx-border: CanvasText;
      --tx-surface: Canvas;
      --tx-primary: Highlight;
      --tx-primary-foreground: HighlightText;
    }
  }
</style>
