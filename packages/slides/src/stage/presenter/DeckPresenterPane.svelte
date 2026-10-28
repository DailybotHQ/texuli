<script module lang="ts">
type Extras = typeof import('./extras.ts');
// Loaded once per page; a reopened split view renders its extras at once.
let loaded: Extras | null = null;
let loading: Promise<Extras> | null = null;

function loadExtras(): Promise<Extras> {
  loading ??= import('./extras.ts').then((module) => {
    loaded = module;
    return module;
  });
  return loading;
}
</script>

<script lang="ts">
/**
 * The in-page presenter split view (S or P), beside the stage canvas:
 * speaker notes with the step label and what comes next are in the stage
 * entry; the live preview, the timers (when the stage enables them),
 * previous and next, and "Open presenter window" are a lazy chunk
 * (`PresenterPaneExtras`), so the entry stays small.
 *
 * When the window opens, the split view closes and the stage follows the
 * window over the presenter protocol. When it cannot open (a blocked popup,
 * no BroadcastChannel), the split view stays and says why.
 */
import { onMount } from 'svelte';
import { getDeckStageContext } from '../context.ts';
import type { DeckPresenterHost } from './host.ts';
import { type DeckPreviewPaint, presenterPosition } from './paint.ts';
import PresenterNotes from './PresenterNotes.svelte';
import PresenterUpNext from './PresenterUpNext.svelte';

interface Props {
  /** Show and run the timers (elapsed, on this slide, wall clock). */
  timer?: boolean;
  /** Paints the preview of what comes next. */
  paint?: DeckPreviewPaint;
  /** The stage seam for the presenter window; without it there is no window button. */
  host?: DeckPresenterHost;
  /** Focus the notes on mount (the view was opened from the keyboard). */
  focusNotes?: boolean;
  notesElement?: HTMLElement;
}

let {
  timer = false,
  paint,
  host,
  focusNotes = false,
  notesElement = $bindable(),
}: Props = $props();
const stage = getDeckStageContext();
let pane: HTMLElement | undefined = $state();
let extras = $state.raw<Extras | null>(loaded);

let at = $derived(
  stage
    ? presenterPosition(
        stage.slides,
        stage.state.slideIndex,
        stage.state.step,
        stage.state.stepCount
      )
    : null
);
const stageRoot = () => pane?.closest<HTMLElement>('.tx-deck-stage') ?? null;

onMount(() => {
  if (focusNotes) notesElement?.focus({ preventScroll: true });
  if (!extras) {
    void loadExtras().then(
      (module) => {
        extras = module;
      },
      () => undefined
    );
  }
});
</script>

{#if stage && at}
  {@const t = stage.t}
  <div
    bind:this={pane}
    class="tx-deck-stage__presenter-side"
    role="group"
    aria-label={t('presenter.viewLabel')}
    data-tx-deck-chrome
    data-tx-deck-presenter-split
  >
    {#if extras}
      <extras.PresenterPaneExtras part="top" {stage} {at} {timer} {paint} {host} />
    {/if}
    <PresenterNotes
      {t}
      slide={at.current?.slide}
      step={stage.state.step}
      stepCount={stage.state.stepCount}
      bind:element={notesElement}
    />
    <PresenterUpNext
      {t}
      step={stage.state.step}
      stepCount={stage.state.stepCount}
      following={at.following?.title}
    />
    {#if extras}
      <extras.PresenterPaneExtras part="bottom" {stage} {at} {timer} {paint} {host} {stageRoot} />
    {/if}
  </div>
{/if}

<style>
  @media print {
    .tx-deck-stage__presenter-side {
      display: none;
    }
  }
</style>
