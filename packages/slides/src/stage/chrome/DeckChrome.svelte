<script lang="ts">
/**
 * The chrome layers over the stage: blackout, the laser, the keyboard help
 * dialog, the first-visit hint, the full screen overlay and the toast (a
 * polite live region with its visible twin). `DeckStage` mounts it inside
 * its root, whether or not a host replaces the toolbar, so every key keeps
 * working. The heavy layers (help, laser, hint, overlay) load on their own
 * chunks the first time they open.
 *
 * Keys reach it through the engine: it follows the controller's `action`
 * event for help, laser, copy link and the slide list.
 */
import { onMount } from 'svelte';
import { getDeckStageContext } from '../context.ts';
import DeckBlackout from './DeckBlackout.svelte';
import { claimFirstRunHint, deckHintStorage, firstRunHintAllowed } from './first-run.ts';
import { deckChromeEnvironment } from './links.ts';
import { getDeckChromeContext, isDeckChromeAction, runDeckChromeAction } from './state.svelte.ts';

/** How long a toast stays on screen, unless the pointer is on it. */
const TOAST_MS = 2500;

const stage = getDeckStageContext();
const chrome = getDeckChromeContext();
const uid = $props.id();

let anchor: HTMLElement | undefined = $state();
let root = $state<HTMLElement | null>(null);
let mounted = $state(false);
let hint = $state(false);
// The last pointer position over the stage (where the laser starts); not reactive on purpose.
const pointer: { last: { x: number; y: number } | null } = { last: null };

let live = $state('');
let toast = $state.raw<{ text: string; tone: 'info' | 'error' } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastHeld = false;

function scheduleToast() {
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (!toastHeld) toast = null;
  }, TOAST_MS);
}

// One notice at a time: clear first, so a repeated text is announced again.
$effect(() => {
  const notice = chrome?.notice;
  if (!notice) return;
  live = '';
  queueMicrotask(() => {
    live = notice.text;
    toast = notice.visual ? { text: notice.text, tone: notice.tone } : null;
    if (notice.visual) scheduleToast();
  });
});

// Keys: the engine decides, the chrome acts on its own actions.
$effect(() => {
  const current = stage?.controller;
  if (!current || !chrome || !stage) return;
  chrome.reset();
  return current.subscribe('action', ({ action, source }) => {
    if (isDeckChromeAction(action)) runDeckChromeAction(stage, chrome, action, { source });
  });
});

// Leaving blackout hands focus back to the slide when it was on the black screen.
let wasBlackout = false;
$effect(() => {
  const active = stage?.state.blackout ?? false;
  if (wasBlackout && !active) {
    const focused = typeof document === 'undefined' ? null : document.activeElement;
    if (!focused || focused === document.body || !focused.isConnected) stage?.focusSlide();
  }
  wasBlackout = active;
});

let environment = $derived(deckChromeEnvironment(mounted ? window : null));
let counter = $derived(
  stage ? stage.t('stage.counter', { current: stage.position + 1, total: stage.slides.length }) : ''
);

onMount(() => {
  root = anchor?.closest<HTMLElement>('.tx-deck-stage') ?? null;
  mounted = true;
  const host = root;
  if (stage && firstRunHintAllowed(window) && claimFirstRunHint(stage.namespace, deckHintStorage)) {
    hint = true;
  }
  const track = (event: PointerEvent) => {
    pointer.last = { x: event.clientX, y: event.clientY };
  };
  host?.addEventListener('pointermove', track, { passive: true });
  return () => {
    host?.removeEventListener('pointermove', track);
    clearTimeout(toastTimer);
  };
});
</script>

{#if stage && chrome}
  <span bind:this={anchor} class="tx-deck-chrome-sr" role="status" aria-live="polite" aria-atomic="true"
    >{live}</span
  >
  {#if toast}
    <div
      class="tx-deck-chrome-toast"
      aria-hidden="true"
      data-tx-deck-chrome
      data-tone={toast.tone}
      onpointerenter={() => {
        toastHeld = true;
        clearTimeout(toastTimer);
      }}
      onpointerleave={() => {
        toastHeld = false;
        scheduleToast();
      }}
    >
      {toast.text}
    </div>
  {/if}
  {#if root && chrome.laser}
    {#await import('./LaserPointer.svelte') then laser}
      <laser.default {root} label={stage.t('chrome.laserOn')} start={pointer.last} />
    {/await}
  {/if}
  {#if root && stage.fullscreen !== 'off'}
    {#await import('./FullscreenOverlay.svelte') then overlay}
      <overlay.default
        {root}
        t={stage.t}
        {counter}
        suppressed={stage.state.blackout || chrome.laser}
        onaction={(action) => runDeckChromeAction(stage, chrome, action, { root })}
      />
    {/await}
  {/if}
  {#if root && hint && !stage.presenter}
    {#await import('./FirstRunHint.svelte') then module}
      <module.default {root} t={stage.t} />
    {/await}
  {/if}
  {#if chrome.help}
    {#await import('./KeyboardHelp.svelte') then help}
      <help.default
        id={`${uid}-help`}
        t={stage.t}
        {environment}
        onclose={() => (chrome.help = false)}
        onrestore={() => stage.focusSlide()}
      />
    {/await}
  {/if}
  {#if stage.state.blackout}
    <DeckBlackout
      label={stage.t('chrome.blackoutHint')}
      onclose={() => {
        stage.controller.setBlackout(false);
        stage.focusSlide();
      }}
    />
  {/if}
{/if}

<style>
  .tx-deck-chrome-sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  .tx-deck-chrome-toast {
    position: absolute;
    z-index: 25;
    inset-block-end: 4.5rem;
    inset-inline: 1rem;
    box-sizing: border-box;
    inline-size: fit-content;
    max-inline-size: min(24rem, calc(100% - 2rem));
    margin-inline: auto;
    padding-block: 0.5rem;
    padding-inline: 0.875rem;
    color: var(--tx-foreground);
    background: var(--tx-elevated, var(--tx-surface, var(--tx-background)));
    border: 1px solid var(--tx-border-strong, var(--tx-border));
    border-radius: var(--tx-shape-radius-lg);
    box-shadow: var(--tx-elevation-3);
    font-size: var(--tx-type-label-size);
    font-weight: 500;
  }

  .tx-deck-chrome-toast[data-tone="error"] {
    border-color: var(--tx-destructive, currentColor);
  }

  @media print {
    .tx-deck-chrome-toast {
      display: none;
    }
  }

  @media (forced-colors: active) {
    .tx-deck-chrome-toast {
      border-color: CanvasText;
    }
  }
</style>
