<script lang="ts">
/**
 * "Controls and shortcuts": a modal dialog listing every control this page
 * can offer, grouped as in the toolbar, with its label, description and
 * keys, all read from `DECK_CONTROLS` through the messages, so the guide
 * never drifts from the buttons or the key map. It opens with `showModal()`
 * (the rest of the page goes inert), focus moves to Close and stays inside
 * (Tab wraps between Close and the scrollable list), and returns to the
 * opener on close. Escape and ? close it
 * through the engine's key decisions. Loaded on its own chunk.
 */
import {
  availableDeckControls,
  DECK_CONTROL_GROUPS,
  type DeckControlEnvironment,
  type DeckControlGroup,
} from '@texuli/deck/engine';
import { onMount, tick } from 'svelte';
import type { DeckStageMessageKey, DeckTranslate } from '../messages.ts';
import ChromeIcon from './ChromeIcon.svelte';

interface Props {
  id: string;
  t: DeckTranslate;
  environment: DeckControlEnvironment;
  onclose: () => void;
  /** Where focus goes when the opener is gone (the active slide). */
  onrestore: () => void;
}

let { id, t, environment, onclose, onrestore }: Props = $props();

const GROUP_TITLES: Readonly<Record<DeckControlGroup, DeckStageMessageKey>> = {
  navigate: 'stage.groupNavigate',
  view: 'stage.groupView',
  present: 'stage.groupPresent',
  share: 'stage.groupShare',
  help: 'stage.groupHelp',
  debug: 'stage.groupDebug',
};

let groups = $derived(
  DECK_CONTROL_GROUPS.map((group) => ({
    group,
    controls: availableDeckControls(environment).filter((control) => control.group === group),
  })).filter((entry) => entry.controls.length > 0)
);

let dialog: HTMLDialogElement | undefined = $state();
let close: HTMLButtonElement | undefined = $state();

const TABBABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function onkeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog) return;
  const items = [...dialog.querySelectorAll<HTMLElement>(TABBABLE)];
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMount(() => {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const node = dialog;
  try {
    if (typeof node?.showModal === 'function') node.showModal();
    else node?.setAttribute('open', '');
  } catch {
    node?.setAttribute('open', '');
  }
  void tick().then(() => close?.focus({ preventScroll: true }));
  return () => {
    try {
      if (node?.open) node.close();
    } catch {
      // Already closed.
    }
    if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    else onrestore();
  };
});
</script>

<!-- Escape reaches the engine (it closes help first); the native cancel would race it. -->
<dialog
  bind:this={dialog}
  {id}
  class="tx-deck-chrome-help"
  aria-labelledby={`${id}-title`}
  data-tx-deck-chrome
  data-tx-deck-help
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
  {onkeydown}
>
  <div class="tx-deck-chrome-help__head">
    <h2 class="tx-deck-chrome-help__title" id={`${id}-title`}>{t('controls.help')}</h2>
    <button bind:this={close} type="button" class="tx-deck-stage__control" onclick={onclose}>
      {t('chrome.close')}
    </button>
  </div>
  <!-- The list scrolls on short screens: a named, focusable region so keyboard users can scroll it. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="tx-deck-chrome-help__body" role="region" aria-labelledby={`${id}-title`} tabindex="0">
    {#each groups as { group, controls } (group)}
      <section class="tx-deck-chrome-help__group" aria-labelledby={`${id}-${group}`}>
        <h3 class="tx-deck-chrome-help__group-title" id={`${id}-${group}`}>{t(GROUP_TITLES[group])}</h3>
        <ul class="tx-deck-chrome-help__list">
          {#each controls as control (control.action)}
            <li class="tx-deck-chrome-help__item" data-tx-deck-help-control={control.action}>
              <ChromeIcon name={control.action} />
              <div class="tx-deck-chrome-help__text">
                <span class="tx-deck-chrome-help__label">{t(control.labelKey as DeckStageMessageKey)}</span>
                {#if control.keys.length > 0}
                  <span class="tx-deck-chrome-help__keys">
                    {#each control.keys as key (key.label)}<kbd>{key.label}</kbd>{/each}
                  </span>
                {:else}
                  <span class="tx-deck-chrome-help__none">{t('chrome.buttonOnly')}</span>
                {/if}
                <span class="tx-deck-chrome-help__description">
                  {t(control.descriptionKey as DeckStageMessageKey)}
                </span>
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</dialog>

<style>
  .tx-deck-chrome-help {
    box-sizing: border-box;
    inline-size: min(36rem, calc(100vw - 2rem));
    max-block-size: min(85vh, 44rem);
    padding: 0;
    overflow: hidden;
    color: var(--tx-foreground);
    background: var(--tx-elevated, var(--tx-surface, var(--tx-background)));
    border: 1px solid var(--tx-border-strong, var(--tx-border));
    border-radius: var(--tx-radius-lg, 0.75rem);
    box-shadow: var(--tx-shadow-float, 0 8px 32px rgb(0 0 0 / 0.2));
  }

  .tx-deck-chrome-help[open] {
    display: flex;
    flex-direction: column;
  }

  .tx-deck-chrome-help::backdrop {
    background: rgb(0 0 0 / 0.5);
  }

  .tx-deck-chrome-help__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-block: 0.75rem;
    padding-inline: 1.25rem;
    border-block-end: 1px solid var(--tx-border);
  }

  .tx-deck-chrome-help__title {
    margin: 0;
    font-size: 1.125rem;
  }

  .tx-deck-chrome-help__body:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: -2px;
  }

  .tx-deck-chrome-help__body {
    min-block-size: 0;
    padding-block: 0.5rem 1rem;
    padding-inline: 1.25rem;
    overflow-y: auto;
  }

  .tx-deck-chrome-help__group-title {
    margin-block: 0.75rem 0.5rem;
    color: var(--tx-muted-foreground, inherit);
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .tx-deck-chrome-help__list {
    display: grid;
    gap: 0.625rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tx-deck-chrome-help__item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.75rem;
    align-items: start;
  }

  .tx-deck-chrome-help__text {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    font-size: var(--tx-font-size-sm, 0.875rem);
  }

  .tx-deck-chrome-help__label {
    font-weight: 600;
  }

  .tx-deck-chrome-help__keys {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .tx-deck-chrome-help__keys kbd {
    padding-block: 0.0625rem;
    padding-inline: 0.375rem;
    background: var(--tx-muted, var(--tx-surface));
    border: 1px solid var(--tx-border);
    border-radius: 0.25rem;
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
  }

  .tx-deck-chrome-help__none,
  .tx-deck-chrome-help__description {
    color: var(--tx-muted-foreground, inherit);
  }

  .tx-deck-chrome-help__description {
    flex-basis: 100%;
  }

  @media (forced-colors: active) {
    .tx-deck-chrome-help,
    .tx-deck-chrome-help__keys kbd {
      border-color: CanvasText;
    }
  }
</style>
