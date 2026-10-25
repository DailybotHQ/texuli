<script lang="ts">
import { DetailPanel, Drawer, ResponsiveModal, Sheet } from 'texuli/sheet';

const sizes = ['sm', 'md', 'lg', 'xl'] as const;
let sheetSide = $state<'start' | 'end' | 'top' | 'bottom'>('start');
let snap = $state<number>();
</script>

<div class="demo" data-example="texuli-sheet" aria-label="Sheet family examples">
  <section>
    <h2>Sheet sides and sizes</h2>
    <div class="control">
      <label for="sheet-side">Side</label>
      <select id="sheet-side" bind:value={sheetSide}>
        <option value="start">Start (default)</option>
        <option value="end">End</option>
        <option value="top">Top</option>
        <option value="bottom">Bottom</option>
      </select>
    </div>
    <div class="actions">
      {#each sizes as size (size)}
        <Sheet.Root>
          <Sheet.Trigger class="trigger">Open {size} sheet</Sheet.Trigger>
          <Sheet.Portal>
            <Sheet.Overlay />
            <Sheet.Content {size} side={sheetSide}>
              <Sheet.Title>{size} sheet</Sheet.Title>
              <Sheet.Description>Logical start and end respect text direction.</Sheet.Description>
              <Sheet.Close class="action">Done</Sheet.Close>
            </Sheet.Content>
          </Sheet.Portal>
        </Sheet.Root>
      {/each}
    </div>
  </section>

  <section class="actions">
    <div class="control">
      <h2>Drawer with snap points</h2>
      <Drawer.Root>
        <Drawer.Trigger class="trigger">Open drawer</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay />
          <Drawer.Content snapPoints={[0.4, 0.7, 1]} bind:activeSnapPoint={snap}>
            <Drawer.Handle label="Resize drawer" />
            <Drawer.Title>Cart</Drawer.Title>
            <Drawer.Description>Three items in the fictional cart.</Drawer.Description>
            <Drawer.Close class="action">Close cart</Drawer.Close>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
    <div class="control">
      <h2>Non-modal detail panel</h2>
      <DetailPanel.Root>
        <DetailPanel.Trigger class="trigger">Show order details</DetailPanel.Trigger>
        <DetailPanel.Portal>
          <DetailPanel.Content size="lg">
            <DetailPanel.Title>Order orbit-001</DetailPanel.Title>
            <DetailPanel.Description>The page remains available behind this panel.</DetailPanel.Description>
            <DetailPanel.Close class="action">Close details</DetailPanel.Close>
          </DetailPanel.Content>
        </DetailPanel.Portal>
      </DetailPanel.Root>
    </div>
  </section>

  <section class="control" dir="rtl" lang="ar">
    <h2>اتجاه من اليمين إلى اليسار</h2>
    <Sheet.Root>
      <Sheet.Trigger class="trigger">فتح المرشحات</Sheet.Trigger>
      <Sheet.Portal>
        <Sheet.Overlay />
        <Sheet.Content>
          <Sheet.Title>المرشحات</Sheet.Title>
          <Sheet.Description>تبدأ هذه اللوحة من اليمين في اتجاه RTL.</Sheet.Description>
          <Sheet.Close class="action">تم</Sheet.Close>
        </Sheet.Content>
      </Sheet.Portal>
    </Sheet.Root>
  </section>

  <section class="dark control">
    <h2>Responsive modal, dark surface</h2>
    <ResponsiveModal.Root>
      <ResponsiveModal.Trigger class="trigger">Share order</ResponsiveModal.Trigger>
      <ResponsiveModal.Portal>
        <ResponsiveModal.Overlay />
        <ResponsiveModal.Content class="sheet-demo-dark">
          <ResponsiveModal.Handle label="Resize share panel" />
          <ResponsiveModal.Title>Share order</ResponsiveModal.Title>
          <ResponsiveModal.Description>Centered on wide screens, bottom drawer on phones.</ResponsiveModal.Description>
          <ResponsiveModal.Close class="action">Done</ResponsiveModal.Close>
        </ResponsiveModal.Content>
      </ResponsiveModal.Portal>
    </ResponsiveModal.Root>
  </section>
</div>

<style>
  .demo {
    display: grid;
    gap: 1.25rem;
    max-inline-size: 52rem;
    padding: 1.5rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
    font-family: var(--tx-font-sans, system-ui, sans-serif);
  }
  section, .control { display: grid; gap: 0.65rem; }
  h2 { margin: 0; font-size: 0.9rem; font-weight: 600; }
  label { font-size: 0.875rem; font-weight: 500; }
  .actions { display: flex; flex-wrap: wrap; align-items: start; gap: 0.75rem; }
  :global(.trigger), :global(.action), select {
    min-block-size: 2.5rem;
    padding-block: 0.5rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius-md, 0.5rem);
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-surface, Canvas);
    font: inherit;
  }
  :global(.trigger), :global(.action) { cursor: pointer; }
  :global(.trigger:focus-visible), :global(.action:focus-visible), select:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .dark {
    --tx-foreground: #f4f4f5;
    --tx-muted-foreground: #c8cdd4;
    --tx-border: #8394a5;
    --tx-surface: #0f1115;
    padding: 1rem;
    border-radius: var(--tx-radius-lg, 0.75rem);
    --tx-background: #17191f;
    --tx-foreground: #f4f4f5;
    --tx-surface: #27272a;
    --tx-border: #52525b;
    color: var(--tx-foreground);
    background: var(--tx-background);
  }
  :global(.sheet-demo-dark) {
    --tx-foreground: #f4f4f5;
    --tx-muted-foreground: #c8cdd4;
    --tx-border: #8394a5;
    --tx-surface: #0f1115;
    --tx-background: #17191f;
    --tx-foreground: #f4f4f5;
    --tx-surface: #27272a;
    --tx-border: #52525b;
    color: var(--tx-foreground);
    background: var(--tx-background);
  }

  @media (forced-colors: active) {
    .dark {
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
