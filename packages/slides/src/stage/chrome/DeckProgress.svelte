<script lang="ts">
/**
 * The deck progress bar, honoring `style.progress` (`top`, `bottom`, `none`;
 * the stage places it on that edge of the letterbox): a `progressbar`
 * labelled by the messages and valued by the visible slide position.
 */
import { getDeckStageContext } from '../context.ts';
import { deckCssVars } from '../css-vars.ts';

const stage = getDeckStageContext();
let total = $derived(stage?.slides.length ?? 0);
let current = $derived((stage?.position ?? 0) + 1);
let ratio = $derived(total > 0 ? Math.min(1, current / total) : 0);
</script>

{#if stage && stage.progress !== 'none'}
  <div
    class="tx-deck-stage__progress-bar"
    data-tx-deck-progress={stage.progress}
    data-tx-deck-chrome
    role="progressbar"
    aria-label={stage.t('chrome.slideProgress')}
    aria-valuemin={1}
    aria-valuemax={total}
    aria-valuenow={current}
    aria-valuetext={stage.t('stage.slideOf', { current, total })}
  >
    <div
      class="tx-deck-stage__progress-fill"
      use:deckCssVars={{ '--tx-deck-progress-ratio': String(ratio) }}
    ></div>
  </div>
{/if}
