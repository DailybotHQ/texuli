<script lang="ts">
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarGroupItem,
  ToolbarLink,
  ToolbarSeparator,
} from 'texuli/toolbar';

let align = $state('left');
let style = $state<string[]>(['bold']);
let view = $state('day');
</script>

<div class="demo" data-example="texuli-toolbar">
  <section>
    <h2>Default</h2>
    <Toolbar aria-label="Document actions">
      <ToolbarButton aria-label="Undo">Undo</ToolbarButton>
      <ToolbarButton aria-label="Redo">Redo</ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton aria-label="Print">Print</ToolbarButton>
      <ToolbarLink href="https://example.com/docs" aria-label="Docs">Docs</ToolbarLink>
    </Toolbar>
  </section>

  <section>
    <h2>Variants</h2>
    <div class="stack">
      <Toolbar variant="default" aria-label="Default bar">
        <ToolbarButton aria-label="Cut">Cut</ToolbarButton>
        <ToolbarButton aria-label="Copy">Copy</ToolbarButton>
        <ToolbarButton aria-label="Paste">Paste</ToolbarButton>
      </Toolbar>
      <Toolbar variant="outline" aria-label="Outline bar">
        <ToolbarButton aria-label="Cut">Cut</ToolbarButton>
        <ToolbarButton aria-label="Copy">Copy</ToolbarButton>
        <ToolbarButton aria-label="Paste" disabled>Paste</ToolbarButton>
      </Toolbar>
      <Toolbar variant="ghost" size="sm" aria-label="Ghost bar">
        <ToolbarButton aria-label="Zoom in">+</ToolbarButton>
        <ToolbarButton aria-label="Zoom out">−</ToolbarButton>
      </Toolbar>
    </div>
  </section>

  <section>
    <h2>Groups</h2>
    <Toolbar variant="outline" aria-label="Text formatting">
      <ToolbarGroup type="single" bind:value={align} aria-label="Alignment">
        <ToolbarGroupItem value="left" aria-label="Align left">Left</ToolbarGroupItem>
        <ToolbarGroupItem value="center" aria-label="Align center">Center</ToolbarGroupItem>
        <ToolbarGroupItem value="right" aria-label="Align right">Right</ToolbarGroupItem>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup type="multiple" bind:value={style} aria-label="Emphasis">
        <ToolbarGroupItem value="bold" aria-label="Bold">B</ToolbarGroupItem>
        <ToolbarGroupItem value="italic" aria-label="Italic">I</ToolbarGroupItem>
        <ToolbarGroupItem value="underline" aria-label="Underline">U</ToolbarGroupItem>
      </ToolbarGroup>
    </Toolbar>
  </section>

  <section>
    <h2>Vertical</h2>
    <Toolbar orientation="vertical" variant="outline" aria-label="Drawing tools">
      <ToolbarButton aria-label="Select">Select</ToolbarButton>
      <ToolbarButton aria-label="Pen">Pen</ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton aria-label="Eraser">Eraser</ToolbarButton>
    </Toolbar>
  </section>

  <section dir="rtl" lang="ar">
    <h2>RTL</h2>
    <Toolbar variant="outline" aria-label="شريط الأدوات">
      <ToolbarButton aria-label="تراجع">تراجع</ToolbarButton>
      <ToolbarButton aria-label="إعادة">إعادة</ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton aria-label="حفظ">حفظ</ToolbarButton>
    </Toolbar>
  </section>

  <section data-tx-mode="dark" class="dark">
    <h2>Dark</h2>
    <Toolbar variant="outline" aria-label="Dark actions">
      <ToolbarButton aria-label="Share">Share</ToolbarButton>
      <ToolbarSeparator />
      <ToolbarGroup type="single" bind:value={view} aria-label="View">
        <ToolbarGroupItem value="day" aria-label="Day">Day</ToolbarGroupItem>
        <ToolbarGroupItem value="week" aria-label="Week">Week</ToolbarGroupItem>
      </ToolbarGroup>
      <ToolbarLink href="https://example.com/settings" aria-label="Settings">Settings</ToolbarLink>
    </Toolbar>
  </section>
</div>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    padding: 1rem;
    max-inline-size: 40rem;
    font-family: var(--tx-font-sans, system-ui, sans-serif);
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  section {
    display: grid;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .stack {
    display: grid;
    gap: 0.75rem;
  }
  .dark {
    --tx-foreground: #f4f4f5;
    --tx-muted-foreground: #c8cdd4;
    --tx-border: #8394a5;
    --tx-surface: #0f1115;
    padding: 0.75rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: #0f1115;
    color: #f4f4f5;
  }

  @media (forced-colors: active) {
    .dark, [data-tx-mode="dark"] {
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
