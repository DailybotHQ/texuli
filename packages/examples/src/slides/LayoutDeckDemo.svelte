<script lang="ts">
import '@texuli/slides/styles.css';
import {
  createDeckThemeCache,
  DeckStage,
  loadDeckBlockFamily,
  loadDeckLibraryTheme,
} from '@texuli/slides/stage';
import { onMount, type Snippet } from 'svelte';

/**
 * One v2 deck on the stage for the layout examples. The stage's default
 * renderers paint the catalog layouts (the layouts table is wired into the
 * stage defaults by the integration step), so this demo imports no layout
 * code. Captures wait until the layout has painted, its block families are
 * loaded and no loading status remains.
 */
interface Props {
  deck: unknown;
  label: string;
  /** Hide the toolbar and progress bar (the backgrounds gallery tiles). */
  bare?: boolean;
  initialStep?: number;
  /** What must be painted before the capture (a catalog layout by default). */
  paintedSelector?: string;
  onReady?: () => void;
}

let {
  deck,
  label,
  bare = false,
  initialStep,
  paintedSelector = '[data-tx-deck-active="true"] [data-tx-deck-design]',
  onReady,
}: Props = $props();

// App-authored demo decks: the developer tier lets the embedded swatches paint.
const tier = 'developer';
const themes = createDeckThemeCache(loadDeckLibraryTheme);
const loadTheme = (id: string) =>
  themes.load(id).then((theme) => theme ?? Promise.reject(new Error(`Unknown theme ${id}`)));

let preloaded = $state(false);
let settled = $state(false);
let section: HTMLElement | undefined = $state();

const UNSETTLED =
  '.tx-deck-stage__loading, [data-tx-block="code"][data-grammar]:not([data-grammar="none"]):not([data-tokenized])';

$effect(() => {
  const root = section;
  if (!root) return;
  const check = () => {
    if (root.querySelector(paintedSelector) === null || root.querySelector(UNSETTLED) !== null)
      return;
    settled = true;
    observer.disconnect();
    onReady?.();
  };
  const observer = new MutationObserver(check);
  observer.observe(root, { subtree: true, childList: true, attributes: true });
  check();
  return () => observer.disconnect();
});

// Load the block families the layouts paint through (code, chart, CTA) and
// the theme first, so captures never show a loading state.
onMount(() => {
  void Promise.all([
    loadDeckBlockFamily('blocks-code'),
    loadDeckBlockFamily('blocks-data'),
    loadDeckBlockFamily('blocks-structure'),
    themes.load('graphite'),
  ]).then(() => {
    preloaded = true;
  });
});
</script>

{#snippet noChrome()}{/snippet}

{#if !settled && !bare}
  <p role="status">Loading example…</p>
{/if}
{#if preloaded}
  <section bind:this={section} class="layout-demo" data-bare={bare ? 'true' : undefined} aria-label={label}>
    <DeckStage
      {deck}
      {tier}
      {loadTheme}
      {initialStep}
      syncHash={false}
      chrome={bare ? (noChrome as Snippet) : undefined}
    />
  </section>
{/if}

<style>
  .layout-demo {
    padding: 1rem;
    max-inline-size: 64rem;
  }

  .layout-demo[data-bare="true"] {
    padding: 0;
    max-inline-size: none;
  }
</style>
