<script lang="ts">
import { ICON_NAMES, Icon } from 'texuli/icons';
import { LucideIcon } from 'texuli/icons/lucide';
import ExampleGlyph from './ExampleGlyph.svelte';
</script>

<div class="demo" data-example="texuli-icons">
  <section>
    <h2>Built-in set</h2>
    <div class="icon-grid">
      {#each ICON_NAMES as name (name)}
        <div class="icon-item">
          <Icon icon={name} />
          <span>{name}</span>
        </div>
      {/each}
    </div>
  </section>

  <section>
    <h2>Sizes and accessible states</h2>
    <div class="icon-row">
      <Icon icon="check" size="xs" />
      <Icon icon="check" size="sm" />
      <Icon icon="check" size="md" />
      <Icon icon="check" size="lg" />
      <Icon icon="info" label="Information" />
      <Icon icon="warning" aria-label="Warning" />
    </div>
  </section>

  <section>
    <h2>Compatible custom SVG component</h2>
    <div class="icon-row">
      <LucideIcon icon={ExampleGlyph} label="Favorite" size="lg" />
      <Icon icon={ExampleGlyph} />
    </div>
  </section>

  <section dir="rtl" lang="ar">
    <h2>RTL</h2>
    <div class="icon-row">
      <Icon icon="chevron-right" label="التالي" />
      <Icon icon="menu" />
    </div>
  </section>

  <section class="dark-panel" data-tx-mode="dark">
    <h2>Dark mode</h2>
    <div class="icon-row">
      <Icon icon="search" />
      <Icon icon="info" label="Information" />
      <LucideIcon icon={ExampleGlyph} label="Favorite" />
    </div>
  </section>
</div>

<style>
  .demo {
    display: grid;
    gap: 1.25rem;
    padding: 1rem;
    max-inline-size: 40rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
    font-family: var(--tx-font-sans, system-ui, sans-serif);
  }
  section {
    display: grid;
    gap: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
    gap: 0.65rem;
  }
  .icon-item,
  .icon-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .icon-item {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .icon-row {
    flex-wrap: wrap;
  }
  .dark-panel {
    --tx-foreground: #f4f4f5;
    --tx-muted-foreground: #c8cdd4;
    --tx-border: #8394a5;
    --tx-surface: #0f1115;
    padding: 0.75rem;
    border-radius: var(--tx-radius, 0.5rem);
    color: #f4f4f5;
    background: #18181b;
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
