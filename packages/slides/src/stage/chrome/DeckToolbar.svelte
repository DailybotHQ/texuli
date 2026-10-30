<script lang="ts">
/**
 * The deck toolbar: every control of the engine registry (`DECK_CONTROLS`)
 * this page can offer (`deckChromeEnvironment`), in its display groups. The
 * slide counter opens the slide list; toggles report `aria-pressed`. Buttons
 * are icons with their label as text for assistive tech, and one tooltip
 * explains each (label, description, shortcut). When the full toolbar does
 * not fit (measured, never a breakpoint), the secondary groups fold into
 * "More". It reads `getDeckStageContext()` and `getDeckChromeContext()`, and
 * hides in full screen, where the full screen overlay takes over. Below the
 * slide (`toolbarPosition`, default) it aligns to the inline end and its
 * popups open upward.
 *
 * `tools` (G82) adds host controls as the toolbar's last group (labelled by
 * `stage.groupTools`), after the stage's own: they follow its focus order,
 * stay visible when the secondary groups fold into "More", and keep the
 * progress bar (a host `chrome` snippet replaces both).
 */
import {
  availableDeckControls,
  type DeckAction,
  type DeckControl,
  type DeckControlGroup,
  type DeckControlKey,
} from '@texuli/deck/engine';
import { onMount, type Snippet, untrack } from 'svelte';
import { getDeckStageContext } from '../context.ts';
import type { DeckStageMessageKey } from '../messages.ts';
import ChromeIcon from './ChromeIcon.svelte';
import { deckChromeEnvironment, deckShortcutText } from './links.ts';
import { getDeckChromeContext, runDeckChromeAction } from './state.svelte.ts';
import type { DeckTooltip, DeckTooltipContent } from './tooltip.ts';

let { tools }: { tools?: Snippet } = $props();

const stage = getDeckStageContext();
const chrome = getDeckChromeContext();
const uid = $props.id();
const listId = `${uid}-slides`;

const GROUP_LABELS: Readonly<Record<DeckControlGroup, DeckStageMessageKey>> = {
  navigate: 'chrome.navigate',
  view: 'stage.groupView',
  present: 'stage.groupPresent',
  share: 'stage.groupShare',
  help: 'stage.groupHelp',
  debug: 'stage.groupDebug',
};

let mounted = $state(false);
let compact = $state(false);
let toolbar: HTMLElement | undefined = $state();

let environment = $derived(deckChromeEnvironment(mounted ? window : null));
let controls = $derived(
  availableDeckControls(environment).filter(
    (control) => control.action !== 'fullscreen-exit' && control.action !== 'debug'
  )
);
let navigate = $derived(controls.filter((control) => control.group === 'navigate'));
let secondary = $derived(controls.filter((control) => control.group !== 'navigate'));
let groups = $derived(
  (['view', 'present', 'share', 'help'] as const)
    .map((group) => ({ group, items: secondary.filter((control) => control.group === group) }))
    .filter((entry) => entry.items.length > 0)
);

// The tooltip (its state machine and view) loads on the first hover, focus or
// touch on a tool, then replays that interaction; until then each tool only
// listens for it.
let tooltip = $state.raw<DeckTooltip | null>(null);
const anchors = new Map<HTMLElement, () => DeckTooltipContent>();
const attached = new Map<HTMLElement, () => void>();
let loading = false;
let destroyed = false;

function loadTooltip() {
  if (loading) return;
  loading = true;
  void import('./tooltip.ts').then(({ createDeckTooltip }) => {
    if (destroyed) return;
    const tip = createDeckTooltip({
      suppressed: () => Boolean(stage?.state.blackout || chrome?.laser),
    });
    for (const [node, read] of anchors) attached.set(node, tip.anchor(read)(node));
    tooltip = tip;
    for (const node of anchors.keys()) {
      if (node === document.activeElement) node.dispatchEvent(new FocusEvent('focus'));
      else if (hovered(node)) node.dispatchEvent(pointerEnter());
    }
  });
}

function hovered(node: HTMLElement): boolean {
  try {
    return node.matches(':hover');
  } catch {
    return false;
  }
}

function pointerEnter(): Event {
  return typeof PointerEvent === 'function'
    ? new PointerEvent('pointerenter', { pointerType: 'mouse' })
    : Object.assign(new Event('pointerenter'), { pointerType: 'mouse' });
}

/** A Svelte attachment: the tool's tooltip content, wired once the tooltip loads. */
function describe(read: () => DeckTooltipContent) {
  return (node: HTMLElement) => {
    anchors.set(node, read);
    // Untracked: the tooltip loading must not re-run (and detach) every attachment.
    const loaded = untrack(() => tooltip);
    if (loaded) attached.set(node, loaded.anchor(read)(node));
    const wake = () => {
      if (!tooltip) loadTooltip();
    };
    const types = ['pointerenter', 'pointerdown', 'focus'] as const;
    for (const type of types) node.addEventListener(type, wake);
    return () => {
      for (const type of types) node.removeEventListener(type, wake);
      attached.get(node)?.();
      attached.delete(node);
      anchors.delete(node);
    };
  };
}

function t(key: string, values?: Record<string, string | number>): string {
  return stage ? stage.t(key as DeckStageMessageKey, values) : '';
}

function pressed(action: DeckAction): boolean | undefined {
  if (!stage) return undefined;
  switch (action) {
    case 'overview':
      return stage.state.overview;
    case 'presenter':
      return stage.presenter;
    case 'fullscreen':
      return stage.fullscreen !== 'off';
    case 'blackout':
      return stage.state.blackout;
    case 'laser':
      return chrome?.laser ?? false;
    default:
      return undefined;
  }
}

function labelFor(control: DeckControl): string {
  if (control.action === 'fullscreen' && stage?.fullscreen !== 'off') {
    return t('controls.leaveFullscreen');
  }
  return t(control.labelKey);
}

function counter(): string {
  return t('stage.counter', {
    current: (stage?.position ?? 0) + 1,
    total: stage?.slides.length ?? 0,
  });
}

/** `aria-keyshortcuts` syntax: `ArrowRight Space Control+P`. */
function shortcutsFor(keys: readonly DeckControlKey[]): string | undefined {
  const out = keys
    .filter((key) => !key.closes)
    .map((key) => {
      const name =
        key.key === ' ' ? 'Space' : key.key.length === 1 ? key.key.toUpperCase() : key.key;
      if (key.modifier) return `${key.modifier === 'ctrl' ? 'Control' : 'Meta'}+${name}`;
      return key.shift === 'required' || key.key === '?' ? `Shift+${name}` : name;
    });
  return out.length > 0 ? out.join(' ') : undefined;
}

function tooltipFor(control: DeckControl): DeckTooltipContent {
  const fillsWindow =
    control.action === 'fullscreen' && !(mounted && document.fullscreenEnabled === true);
  return {
    title: control.action === 'jump' ? `${labelFor(control)} (${counter()})` : labelFor(control),
    description: fillsWindow ? t('stage.fullscreenWindow') : t(control.descriptionKey),
    shortcut: stage ? deckShortcutText(control.keys, stage.t, stage.locale) : null,
  };
}

function atEdge(action: DeckAction): boolean {
  if (!stage || stage.deck.navigation?.loop) return false;
  if (action === 'prev') return stage.position === 0 && stage.state.step === 0;
  if (action === 'next') {
    return stage.position === stage.slides.length - 1 && stage.state.step >= stage.state.stepCount;
  }
  return false;
}

function activate(control: DeckControl) {
  if (!stage || !chrome) return;
  runDeckChromeAction(stage, chrome, control.action, { source: 'pointer', root: toolbar });
}

function closeList(focusCounter: boolean) {
  if (chrome) chrome.jump = false;
  if (!focusCounter) return;
  queueMicrotask(() =>
    toolbar
      ?.querySelector<HTMLElement>('[data-tx-deck-tool="jump"]')
      ?.focus({ preventScroll: true })
  );
}

function choose(slideId: string) {
  if (!stage) return;
  closeList(false);
  if (slideId !== stage.state.slideId) stage.goTo(slideId);
  stage.focusSlide();
}

// Measure, never guess: fold the secondary groups when the full toolbar overflows.
let fullWidth = 0;
function measure() {
  const node = toolbar;
  if (!node) return;
  if (!compact) fullWidth = node.scrollWidth;
  compact = fullWidth > node.clientWidth + 1;
}

$effect(() => {
  const node = toolbar;
  if (!node || typeof ResizeObserver !== 'function') return;
  const observer = new ResizeObserver(() => measure());
  observer.observe(node);
  return () => observer.disconnect();
});

// The available controls change once after mount (the page's capabilities): measure again.
$effect(() => {
  void controls.length;
  if (!mounted || compact) return;
  queueMicrotask(measure);
});

$effect(() => {
  if (stage?.state.blackout || chrome?.laser) tooltip?.hide();
});

onMount(() => {
  mounted = true;
  return () => {
    destroyed = true;
    tooltip?.destroy();
  };
});
</script>

{#snippet tool(control: DeckControl, withLabel: boolean)}
  {@const isJump = control.action === 'jump'}
  {@const isHelp = control.action === 'help'}
  {@const state = pressed(control.action)}
  <button
    type="button"
    class="tx-deck-stage__control tx-deck-chrome-tool"
    data-tx-deck-tool={control.action}
    data-labelled={withLabel ? 'true' : undefined}
    aria-pressed={control.toggle && !isHelp ? state : undefined}
    aria-expanded={isHelp ? (chrome?.help ?? false) : isJump ? (chrome?.jump ?? false) : undefined}
    aria-haspopup={isHelp ? 'dialog' : isJump ? 'listbox' : undefined}
    aria-controls={isJump && chrome?.jump ? listId : undefined}
    aria-disabled={atEdge(control.action) ? 'true' : undefined}
    aria-label={isJump ? t('stage.jumpLabel', { label: labelFor(control), counter: counter() }) : undefined}
    aria-keyshortcuts={shortcutsFor(control.keys)}
    {@attach describe(() => tooltipFor(control))}
    onclick={() => activate(control)}
  >
    <ChromeIcon name={control.action === 'fullscreen' && state ? 'fullscreen-on' : control.action} />
    {#if isJump}
      <!-- Digits read left to right in every direction: "1 / 22", never "22 / 1". -->
      <bdi class="tx-deck-chrome-tool__count" dir="ltr" aria-hidden="true">{counter()}</bdi>
    {:else}
      <span class={withLabel ? 'tx-deck-chrome-tool__label' : 'tx-deck-chrome-sr'}>{labelFor(control)}</span>
    {/if}
  </button>
{/snippet}

{#if stage}
  <div
    bind:this={toolbar}
    class="tx-deck-stage__toolbar tx-deck-chrome-toolbar"
    role="group"
    aria-label={t('stage.controls')}
    data-tx-deck-chrome
    data-tx-deck-compact={compact ? 'true' : undefined}
  >
    <div class="tx-deck-chrome-group" role="group" aria-label={t('chrome.navigate')}>
      {#each navigate as control (control.action)}
        {#if !compact || (control.action !== 'first' && control.action !== 'last')}
          {@render tool(control, false)}
        {/if}
      {/each}
      {#if chrome?.jump}
        {#await import('./SlideJumpList.svelte') then list}
          <list.default
            id={listId}
            label={t('chrome.chooseSlide')}
            slides={stage.slides}
            current={stage.position}
            onselect={choose}
            onclose={closeList}
          />
        {/await}
      {/if}
    </div>
    {#if compact}
      {#await import('./MoreMenu.svelte') then menu}
        <menu.default label={t('chrome.more')} text={t('stage.more')}>
          {#each groups as { group, items } (group)}
            <div class="tx-deck-chrome-menu-group" role="group" aria-label={t(GROUP_LABELS[group])}>
              {#each items as control (control.action)}
                {@render tool(control, true)}
              {/each}
            </div>
          {/each}
        </menu.default>
      {/await}
    {:else}
      {#each groups as { group, items } (group)}
        <div class="tx-deck-chrome-group" role="group" aria-label={t(GROUP_LABELS[group])}>
          {#each items as control (control.action)}
            {@render tool(control, false)}
          {/each}
        </div>
      {/each}
    {/if}
    {#if tools}
      <div class="tx-deck-chrome-group" role="group" aria-label={t('stage.groupTools')} data-tx-deck-host-tools>
        {@render tools()}
      </div>
    {/if}
    {#if tooltip}
      {#await import('./ChromeTooltip.svelte') then view}
        <view.default {tooltip} />
      {/await}
    {/if}
  </div>
{/if}

<style>
  .tx-deck-chrome-toolbar {
    position: relative;
    z-index: 3;
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-start;
    gap: 0.25rem;
    min-inline-size: 0;
  }

  /* Below the slide (default): the tools gather at the inline end. An auto margin, not
     `justify-content`, so an overflow stays measurable on the end side. */
  :global(.tx-deck-stage[data-tx-deck-toolbar="bottom"]) .tx-deck-chrome-toolbar > .tx-deck-chrome-group:first-child {
    margin-inline-start: auto;
  }

  .tx-deck-chrome-group {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    gap: 0.25rem;
  }

  .tx-deck-chrome-group + .tx-deck-chrome-group {
    padding-inline-start: 0.25rem;
    border-inline-start: 1px solid var(--tx-border);
  }

  .tx-deck-chrome-tool {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    box-sizing: border-box;
    min-inline-size: 2rem;
    min-block-size: 2rem;
    padding-block: 0.25rem;
    padding-inline: 0.375rem;
    line-height: 1.2;
    font-size: var(--tx-type-label-size);
  }

  .tx-deck-chrome-tool[data-labelled] {
    justify-content: flex-start;
    inline-size: 100%;
    padding-inline: 0.625rem;
    text-align: start;
  }

  .tx-deck-chrome-tool:hover {
    background: var(--tx-muted, var(--tx-surface));
  }

  .tx-deck-chrome-tool[aria-pressed="true"],
  .tx-deck-chrome-tool[aria-expanded="true"] {
    color: var(--tx-primary-foreground, var(--tx-background));
    background: var(--tx-primary, var(--tx-foreground));
    border-color: var(--tx-primary, var(--tx-foreground));
  }

  .tx-deck-chrome-tool[aria-disabled="true"] {
    opacity: 0.55;
    cursor: default;
  }

  .tx-deck-chrome-tool__count {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .tx-deck-chrome-menu-group {
    display: grid;
    gap: 0.25rem;
  }

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

  /* Touch: 44 px targets. */
  @media (pointer: coarse) {
    .tx-deck-chrome-tool {
      min-inline-size: 2.75rem;
      min-block-size: 2.75rem;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .tx-deck-chrome-tool {
      transition:
        background-color var(--tx-motion-fast, 120ms) ease-out,
        color var(--tx-motion-fast, 120ms) ease-out;
    }
  }

  /* Full screen: the overlay (leave, previous, counter, next) replaces the toolbar. */
  :global(.tx-deck-stage[data-fullscreen]) .tx-deck-chrome-toolbar {
    display: none;
  }

  @media (forced-colors: active) {
    .tx-deck-chrome-tool {
      border-color: ButtonText;
    }

    .tx-deck-chrome-tool[aria-pressed="true"],
    .tx-deck-chrome-tool[aria-expanded="true"] {
      color: HighlightText;
      background: Highlight;
      border-color: Highlight;
      forced-color-adjust: none;
    }

    .tx-deck-chrome-tool[aria-disabled="true"] {
      color: GrayText;
      border-color: GrayText;
    }
  }
</style>
