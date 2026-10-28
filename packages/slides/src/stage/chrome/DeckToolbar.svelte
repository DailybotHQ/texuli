<script lang="ts">
/**
 * PHASE-1 PLACEHOLDER (PLAN_008 T-stage): the minimal toolbar the stage core
 * ships so a deck stays operable with pointer and keyboard. Phase 2 replaces
 * it with the full chrome (jump list, blackout, laser, copy link, help,
 * tooltips, more-menu, zoom). It reads everything from `getDeckStageContext()`
 * and every label from the stage messages.
 */
import { getDeckStageContext } from '../context.ts';

const stage = getDeckStageContext();
</script>

{#if stage}
  {@const t = stage.t}
  {@const atStart = stage.position === 0 && stage.state.step === 0}
  {@const atEnd =
    stage.position === stage.slides.length - 1 && stage.state.step >= stage.state.stepCount}
  <div
    class="tx-deck-stage__toolbar"
    role="group"
    aria-label={t('stage.controls')}
    data-tx-deck-chrome
  >
    <button
      type="button"
      class="tx-deck-stage__control"
      aria-disabled={atStart && !stage.deck.navigation?.loop ? 'true' : undefined}
      onclick={() => stage.prev()}
    >
      {t('controls.previous')}
    </button>
    <span class="tx-deck-stage__progress">
      {t('stage.slideOf', { current: stage.position + 1, total: stage.slides.length })}
    </span>
    <button
      type="button"
      class="tx-deck-stage__control"
      aria-disabled={atEnd && !stage.deck.navigation?.loop ? 'true' : undefined}
      onclick={() => stage.next()}
    >
      {t('controls.next')}
    </button>
    <button
      type="button"
      class="tx-deck-stage__control"
      aria-pressed={stage.state.overview}
      onclick={() => stage.controller.setOverview(!stage.state.overview)}
    >
      {stage.state.overview ? t('stage.closeOverview') : t('controls.overview')}
    </button>
    <button
      type="button"
      class="tx-deck-stage__control"
      aria-pressed={stage.presenter}
      onclick={() => stage.setPresenter(!stage.presenter)}
    >
      {t('controls.presenter')}
    </button>
    <button
      type="button"
      class="tx-deck-stage__control"
      aria-pressed={stage.fullscreen !== 'off'}
      onclick={() => stage.toggleFullscreen()}
    >
      {stage.fullscreen === 'off' ? t('controls.fullscreen') : t('controls.leaveFullscreen')}
    </button>
  </div>
{/if}
