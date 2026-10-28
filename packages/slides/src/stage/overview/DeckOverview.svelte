<script lang="ts">
/**
 * PHASE-1 PLACEHOLDER (PLAN_008 T-stage): the slide overview as a list of
 * titles. Phase 2 replaces it with the windowed thumbnail grid. Choosing a
 * slide closes the overview and hands focus back to the slide.
 */
import { onMount } from 'svelte';
import { getDeckStageContext } from '../context.ts';

interface Props {
  /** Move focus to the current slide's item on open (keyboard opens). */
  focusCurrent?: boolean;
}

let { focusCurrent = false }: Props = $props();
const stage = getDeckStageContext();
let list: HTMLElement | undefined = $state();

function choose(slideId: string) {
  if (!stage) return;
  if (slideId !== stage.state.slideId) stage.goTo(slideId);
  stage.controller.setOverview(false);
  stage.focusSlide();
}

onMount(() => {
  if (focusCurrent) list?.querySelector<HTMLElement>('[aria-current="step"]')?.focus();
});
</script>

{#if stage}
  <nav bind:this={list} class="tx-deck-stage__overview" aria-label={stage.t('stage.slides')}>
    {#each stage.slides as entry (entry.slide.id)}
      <button
        type="button"
        class="tx-deck-stage__overview-item"
        aria-current={entry.index === stage.state.slideIndex ? 'step' : undefined}
        aria-label={stage.t('overview.selectSlide', {
          current: entry.position + 1,
          title: entry.title,
        })}
        onclick={() => choose(entry.slide.id)}
      >
        <span class="tx-deck-stage__overview-number" aria-hidden="true">{entry.position + 1}</span>
        <span aria-hidden="true">{entry.title}</span>
      </button>
    {/each}
  </nav>
{/if}
