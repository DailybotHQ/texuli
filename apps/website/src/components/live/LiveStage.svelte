<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Mounts the real component for a catalog id, inline. Every id maps to a
 * stage family (`stage-map.ts`) that loads lazily, one chunk per family, so
 * a page pays only for the families it shows. The gallery runs this inside
 * its isolated preview document (see `IsolatedStage.svelte`).
 */
import { lazyChunk } from '@texuli/core/lazy';
import { FRAMED_FAMILIES, STAGE_LOADERS } from './stage-loaders.ts';
import type { StageFamily, StageModule } from './stage-map.ts';

type Props = {
  componentId: string;
  values: Readonly<Record<string, unknown>>;
  /** The id's stage family (from `stageFor` at build time). */
  family: StageFamily | undefined;
  /** The stage loader for a family outside the shared table (`FRAMED_FAMILIES`). */
  load?: () => Promise<StageModule>;
};

let { componentId, values, family, load }: Props = $props();

const loader = $derived(
  load ??
    (family && !FRAMED_FAMILIES.has(family)
      ? STAGE_LOADERS[family as keyof typeof STAGE_LOADERS]
      : undefined)
);

let Stage = $state<StageModule['default'] | null>(null);
let failed = $state(false);

$effect(() => {
  const importer = loader;
  if (!family || !importer) return;
  let alive = true;
  failed = false;
  lazyChunk(`site:live-stage:${family}`, importer).then(
    (mod) => {
      if (alive) Stage = mod.default;
    },
    () => {
      if (alive) failed = true;
    }
  );
  return () => {
    alive = false;
  };
});
</script>

<div
  class="stage"
  data-tx-live-stage={componentId}
  data-family={family}
  data-tx-live-ready={Stage || failed || !loader ? 'true' : 'false'}
>
  {#if !loader}
    <p role="alert">No live stage for “{componentId}”.</p>
  {:else if failed}
    <p role="alert">The demo failed to load.</p>
  {:else if Stage}
    <div class="component" data-tx-live-component={componentId}>
      <Stage {componentId} {values} />
    </div>
  {:else}
    <p class="loading" role="status">Loading demo…</p>
  {/if}
</div>

<style>
  .stage {
    display: grid;
    align-content: start;
    gap: 0.75rem;
    min-inline-size: 0;
  }
  .component {
    display: grid;
    min-inline-size: 0;
  }
  .loading {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
