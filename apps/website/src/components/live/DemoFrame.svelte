<!-- Shared by the component pages and the gallery: carry the styles with the
     component, so the build emits them once instead of once per chunk. -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Framed preview with light/dark and RTL toggles. The stage carries the
 * page's theme id with its own mode, so Texuli's theme selectors
 * (`[data-tx-theme][data-tx-mode]`) re-scope every token inside it while the
 * rest of the page keeps its theme. It starts in the page's mode.
 */
import type { Snippet } from 'svelte';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
// Scoping the site theme with the mode lets tokens follow the frame, not the page.
import { SITE_THEME } from '../foundation/site.ts';

type Props = {
  children: Snippet;
  title?: string;
};

let { children, title = 'Preview' }: Props = $props();

let mode = $state<'light' | 'dark'>('light');
let dir = $state<'ltr' | 'rtl'>('ltr');
/** Set once the visitor picks a preview mode: stop following the page mode. */
let modeTouched = false;

$effect(() => {
  const root = document.documentElement;
  mode = root.dataset.txMode === 'dark' ? 'dark' : 'light';
  // Follow page mode changes (site header, preview postMessage) until picked.
  const sync = () => {
    if (!modeTouched) mode = root.dataset.txMode === 'dark' ? 'dark' : 'light';
  };
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ['data-tx-mode'] });
  return () => observer.disconnect();
});

function onMode(next: string | string[]): void {
  if (next === 'light' || next === 'dark') {
    modeTouched = true;
    mode = next;
  }
}

function onDir(next: string | string[]): void {
  if (next === 'ltr' || next === 'rtl') dir = next;
}
</script>

<section class="frame" data-tx-demo-frame data-mode={mode} data-dir={dir}>
  <header class="frame__bar">
    <h3 class="frame__title">{title}</h3>
    <div class="frame__tools">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={onMode}
        variant="outline"
        size="md"
        aria-label="Preview color mode"
      >
        <ToggleGroupItem value="light">Light</ToggleGroupItem>
        <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        type="single"
        value={dir}
        onValueChange={onDir}
        variant="outline"
        size="md"
        aria-label="Preview text direction"
      >
        <ToggleGroupItem value="ltr">LTR</ToggleGroupItem>
        <ToggleGroupItem value="rtl">RTL</ToggleGroupItem>
      </ToggleGroup>
    </div>
  </header>
  <div
    class="frame__stage"
    data-tx-theme={SITE_THEME}
    data-tx-mode={mode}
    data-tx-demo-stage
    dir={dir}
    style:color-scheme={mode}
    role="region"
    aria-label={`${title} demo preview`}
    tabindex={0}
  >
    {@render children()}
  </div>
</section>

<style>
  .frame {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
    margin-block: 0.75rem;
  }
  .frame__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .frame__title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--tx-foreground, CanvasText);
  }
  .frame__tools {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  /* Each toggle keeps a ≥24×24 target even with close neighbors (target-size). */
  .frame__tools :global([data-roving-item]) {
    min-inline-size: 2.75rem;
    min-block-size: 2.25rem;
  }
  .frame__stage {
    padding: 1.25rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
    min-block-size: 6rem;
    min-inline-size: 0;
    overflow-x: auto;
  }
  /* The stage scrolls wide demos; keep it reachable and visibly focused. */
  .frame__stage:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
