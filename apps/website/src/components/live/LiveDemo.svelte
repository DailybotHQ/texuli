<script lang="ts">
/**
 * Interactive live demo. The island hydrates when it nears the viewport
 * (`client:visible` on component pages); the stage mounts at once for the
 * first example, the others and the props panel + code sample mount when
 * scrolled into view. The heavy part, each stage family, loads lazily.
 * The frame, panel and code sample are small static imports: lazy-importing
 * them made the bundler pull an unrelated shared chunk into every page.
 */
import type { Component } from 'svelte';
import { oncePerInstance } from '../../lib/track.ts';
import CodeSample from './CodeSample.svelte';
import DemoFrame from './DemoFrame.svelte';
import LazyMount from './LazyMount.svelte';
import PropsPanel from './PropsPanel.svelte';
import {
  type CodeTarget,
  exportNameHint,
  formatLiveCode,
  formatStageCode,
  importPathFor,
  initialProps,
  type LiveExampleSeed,
  type LivePropSchema,
} from './props-state.ts';
import type { StageFamily } from './stage-map.ts';

type Props = {
  componentId: string;
  packageName: string;
  schema: readonly LivePropSchema[];
  example?: LiveExampleSeed;
  /** Eager stage mount (first example only). */
  eager?: boolean;
  /**
   * Resolved at build time from the stage map, so the page ships no per-id
   * tables: the stage family, the props the panel offers and the code target.
   */
  family?: StageFamily;
  /** A full-page layout: shown in its isolated preview document. */
  fullPage?: boolean;
  /** Preview height class for a full-page layout. */
  height?: 'sm' | 'md' | 'lg' | 'xl';
  controls?: readonly LivePropSchema[];
  codeTarget?: CodeTarget;
  /** Operated in its preview document (see `StageEntry.framed`). */
  framed?: boolean;
};

let {
  componentId,
  packageName,
  schema,
  example,
  eager = false,
  family,
  fullPage = false,
  height = 'xl',
  controls,
  codeTarget,
  framed = false,
}: Props = $props();

let values = $state<Record<string, unknown>>(initialProps(schema, example));

/** The catalog's once-per-visit demo open event (see track.ts). */
const trackDemoOpen = oncePerInstance('component_demo_open');
let stageVisible = $state(false);
/** The stage router, behind a dynamic boundary (see LazyLiveStage). */
let Stage = $state<Component<{
  componentId: string;
  values: Record<string, unknown>;
  family: StageFamily | undefined;
}> | null>(null);
$effect(() => {
  if (fullPage || framed || !stageVisible || Stage) return;
  import('./LazyLiveStage.svelte').then((mod) => {
    Stage = mod.default;
  });
});
/** Loaded only for full-page layouts and framed ids, so other pages never ship the preview frame. */
let Isolated = $state<Component<{
  componentId: string;
  values: Record<string, unknown>;
  height: 'sm' | 'md' | 'lg' | 'xl';
  fullPage: boolean;
}> | null>(null);
$effect(() => {
  if (!(fullPage || framed) || !stageVisible || Isolated) return;
  import('./IsolatedDemo.svelte').then((mod) => {
    Isolated = mod.default;
  });
});
let panelVisible = $state(false);
$effect(() => {
  values = initialProps(schema, example);
});

const panelSchema = $derived(controls ?? schema);
const code = $derived(
  codeTarget
    ? formatStageCode(codeTarget, values, schema)
    : formatLiveCode(importPathFor(packageName, componentId), exportNameHint(componentId), values)
);

function onChange(name: string, value: unknown): void {
  // First control interaction = the demo was opened and used; once only.
  trackDemoOpen({ component: componentId });
  values = { ...values, [name]: value };
}

$effect(() => {
  if (eager) stageVisible = true;
});
</script>

<div
  class="demo"
  data-tx-live-demo={componentId}
  data-example={example?.id ?? 'default'}
  data-eager={eager ? 'true' : 'false'}
>
  {#if example}
    <h3 class="demo__title">{example.title}</h3>
  {/if}

  <!-- The frame (with its mode and direction controls) renders at once; the stage inside it mounts near the viewport. -->
  <DemoFrame title={example?.title ?? componentId}>
    <LazyMount
      {eager}
      onVisible={() => {
        stageVisible = true;
      }}
    >
      {#if !stageVisible}
        <p class="pending" role="status">Loading demo…</p>
      {:else if fullPage || framed}
        {#if Isolated}
          <Isolated {componentId} {values} {height} {fullPage} />
        {:else}
          <p class="pending" role="status">Loading layout…</p>
        {/if}
      {:else if Stage}
        <Stage {componentId} {family} {values} />
      {:else}
        <p class="pending" role="status">Loading demo…</p>
      {/if}
    </LazyMount>
  </DemoFrame>

  <LazyMount
    eager={false}
    onVisible={() => {
      panelVisible = true;
    }}
  >
    {#if panelVisible}
      <PropsPanel schema={panelSchema} values={values} {onChange} />
      <CodeSample {code} />
    {/if}
  </LazyMount>
</div>

<style>
  .demo {
    display: grid;
    /* Never wider than the page column: wide demos scroll inside their frame. */
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    margin-block: 1rem 1.5rem;
  }
  .demo__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--tx-foreground, CanvasText);
  }
  .pending {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
