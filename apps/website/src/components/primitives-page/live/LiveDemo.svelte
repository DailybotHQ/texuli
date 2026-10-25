<script lang="ts">
/**
 * The live demo frame of a primitive page (T-site-live-primitives). Hydrated
 * with `client:visible` (an IntersectionObserver), it then fetches the
 * primitive's demo chunk, so a page pays for a demo only once it is seen.
 *
 * The frame holds: a light/dark and RTL toolbar scoped to the preview, the
 * uncontrolled and controlled panels side by side, the props panel, the code
 * sample for the current props, keyboard hints that light up when their key
 * is pressed in the preview, and the anatomy bridge (hover or focus a part to
 * highlight it and its box in the anatomy diagram, and the reverse).
 *
 * The demo's own key and control checks are mirrored as data attributes, so
 * the browser spec runs exactly what each demo declares.
 */
import { onMount } from 'svelte';
import { Button } from 'texuli/button';
import { Switch } from 'texuli/choice';
import { Code, Kbd } from 'texuli/kbd-code';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import PropsPanel from './PropsPanel.svelte';
import { type DemoModule, loadDemo } from './registry.ts';
import { type DemoMode, defaultValues, keyLabel, keyName, type PropValue } from './types.ts';

type Props = {
  /** The `@texuli/primitives/<id>` subpath. */
  id: string;
  name: string;
  /** The site theme id, scoped onto the preview with the chosen mode. */
  theme: string;
};

let { id, name, theme }: Props = $props();

const PANELS: readonly { mode: DemoMode; title: string }[] = [
  { mode: 'uncontrolled', title: 'Uncontrolled' },
  { mode: 'controlled', title: 'Controlled' },
];

let demo = $state<DemoModule>();
let failed = $state(false);
let values = $state<Record<string, PropValue>>({});
let mode = $state<'light' | 'dark'>('light');
/*
 * Until hydration the stage carries no theme or mode of its own, so the
 * server-rendered preview follows the page (a dark visitor never sees a light
 * stage). On mount it scopes the same theme and the page's mode, so taking
 * over changes no token and nothing repaints or transitions.
 */
let scoped = $state(false);
let rtl = $state(false);
let pressed = $state<number>(-1);
let lastKey = $state('');
let activePart = $state('');
let portals = $state<Record<DemoMode, HTMLElement | undefined>>({
  uncontrolled: undefined,
  controlled: undefined,
});
let root = $state<HTMLElement>();
let stage = $state<HTMLElement>();

const dir = $derived<'ltr' | 'rtl'>(rtl ? 'rtl' : 'ltr');
const code = $derived(demo ? demo.spec.code(values) : '');
const DemoComponent = $derived(demo?.default);

let releaseTimer: ReturnType<typeof setTimeout> | undefined;

function anatomyFigure(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`figure[data-anatomy="${CSS.escape(id)}"]`);
}

/** Highlight one part: the given demo elements and the matching diagram box. */
function highlight(part: string, elements: readonly Element[]): void {
  for (const element of root?.querySelectorAll('[data-demo-hot]') ?? []) {
    element.removeAttribute('data-demo-hot');
  }
  const figure = anatomyFigure();
  for (const box of figure?.querySelectorAll('[data-hot]') ?? []) box.removeAttribute('data-hot');
  activePart = part;
  if (!part) return;
  for (const element of elements) element.setAttribute('data-demo-hot', '');
  figure?.querySelector(`li[data-part="${CSS.escape(part)}"]`)?.setAttribute('data-hot', '');
}

function partAt(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest('[data-demo-part]') : null;
}

function onStageOver(event: Event): void {
  const element = partAt(event.target);
  highlight(element?.getAttribute('data-demo-part') ?? '', element ? [element] : []);
}

function onStageLeave(): void {
  const focused = partAt(document.activeElement);
  const inside = focused && stage?.contains(focused);
  highlight(inside ? (focused.getAttribute('data-demo-part') ?? '') : '', inside ? [focused] : []);
}

function onKeydown(event: KeyboardEvent): void {
  const hints = demo?.spec.keys ?? [];
  const index = hints.findIndex((hint) => hint.keys.includes(event.key));
  if (index < 0) return;
  const hint = hints[index];
  pressed = index;
  lastKey = hint ? `${keyName(event.key)}: ${hint.action}` : '';
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    pressed = -1;
  }, 1200);
}

function setValue(propName: string, value: PropValue): void {
  values = { ...values, [propName]: value };
}

function reset(): void {
  if (demo) values = defaultValues(demo.spec);
}

/** Set once the visitor picks a preview mode: stop following the site mode. */
let modeTouched = false;
function previewModeFromRoot(): 'light' | 'dark' {
  return document.documentElement.dataset.txMode === 'dark' ? 'dark' : 'light';
}

onMount(() => {
  mode = previewModeFromRoot();
  scoped = true;
  // Follow site-header mode changes until the visitor picks a preview mode.
  const rootEl = document.documentElement;
  const syncMode = () => {
    if (!modeTouched) mode = previewModeFromRoot();
  };
  const modeObserver = new MutationObserver(syncMode);
  modeObserver.observe(rootEl, { attributes: true, attributeFilter: ['data-tx-mode'] });
  loadDemo(id).then(
    (module) => {
      values = defaultValues(module.spec);
      demo = module;
    },
    () => {
      failed = true;
    }
  );

  // Diagram → demo: hovering a box highlights every instance of that part.
  const figure = anatomyFigure();
  const onFigureOver = (event: Event) => {
    const box = event.target instanceof Element ? event.target.closest('li[data-part]') : null;
    const part = box?.getAttribute('data-part') ?? '';
    const matches = part
      ? [...(root?.querySelectorAll(`[data-demo-part="${CSS.escape(part)}"]`) ?? [])]
      : [];
    highlight(part, matches);
  };
  const onFigureLeave = () => highlight('', []);
  figure?.addEventListener('pointerover', onFigureOver);
  figure?.addEventListener('pointerleave', onFigureLeave);
  return () => {
    modeObserver.disconnect();
    clearTimeout(releaseTimer);
    figure?.removeEventListener('pointerover', onFigureOver);
    figure?.removeEventListener('pointerleave', onFigureLeave);
  };
});
</script>

<section
  class="live"
  bind:this={root}
  aria-labelledby="live-{id}-title"
  data-live-demo={id}
  data-ready={demo ? '' : undefined}
  data-key-check={demo?.spec.keyCheck ? JSON.stringify(demo.spec.keyCheck) : undefined}
  data-control-check={demo ? JSON.stringify(demo.spec.controlCheck) : undefined}
>
  <div class="live__bar">
    <h2 class="live__title" id="live-{id}-title">Live demo</h2>
    <div class="live__tools">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        aria-label="Preview color mode"
        bind:value={
          () => mode,
          (next) => {
            if (next === 'light' || next === 'dark') {
              modeTouched = true;
              mode = next;
            }
          }
        }
      >
        <ToggleGroupItem value="light">Light</ToggleGroupItem>
        <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
      </ToggleGroup>
      <Switch size="sm" label="Right to left" bind:checked={rtl} />
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="live__stage"
    bind:this={stage}
    data-tx-theme={scoped ? theme : undefined}
    data-tx-mode={scoped ? mode : undefined}
    {dir}
    data-live-stage
    onpointerover={onStageOver}
    onpointerleave={onStageLeave}
    onfocusin={onStageOver}
    onfocusout={onStageLeave}
    onkeydown={onKeydown}
  >
    {#if DemoComponent && demo}
      {#each PANELS as panel (panel.mode)}
        <section
          class="live__panel"
          data-demo-mode={panel.mode}
          aria-labelledby="live-{id}-{panel.mode}"
        >
          <h3 class="live__panel-title" id="live-{id}-{panel.mode}">{panel.title}</h3>
          <p class="live__panel-note">{demo.spec[panel.mode]}</p>
          <div class="live__canvas">
            <DemoComponent {values} mode={panel.mode} portal={portals[panel.mode]} {dir} />
          </div>
          <div class="live__portal" bind:this={portals[panel.mode]} data-demo-portal></div>
        </section>
      {/each}
    {:else if failed}
      <p class="live__status" role="alert">The {name} demo could not load. Reload the page to try again.</p>
    {:else}
      <p class="live__status">Loading the {name} demo…</p>
    {/if}
  </div>

  {#if demo}
    <div class="live__aside">
      <div class="live__part" data-active-part={activePart || undefined}>
        <span class="live__part-label">Part</span>
        <code>{activePart || 'Hover or focus a part'}</code>
      </div>
      <PropsPanel specs={demo.spec.props} {values} idPrefix="live-{id}" onChange={setValue} />
      {#if demo.spec.props.length > 0}
        <Button class="live__reset" variant="outline" size="sm" type="button" onclick={reset}>Reset props</Button>
      {/if}
    </div>

    <div class="live__keys" data-key-hints>
      <h3 class="live__keys-title">Keyboard</h3>
      {#if demo.spec.keys.length === 0}
        <p class="live__panel-note">No keyboard interaction of its own: focus moves past it as usual.</p>
      {:else}
        <ul class="live__key-list">
          {#each demo.spec.keys as hint, index (hint.action)}
            <li class="live__key" data-key-hint={hint.keys.join(' ')} data-pressed={pressed === index ? '' : undefined}>
              <span class="live__key-caps">
                {#each hint.keys as key (key)}
                  <Kbd aria-label={keyName(key)}>{keyLabel(key)}</Kbd>
                {/each}
              </span>
              <span>{hint.action}</span>
            </li>
          {/each}
        </ul>
        <p class="live__key-status" role="status">{lastKey ? `Pressed ${lastKey}` : 'Focus the preview and press a key.'}</p>
      {/if}
    </div>

    <div class="live__code">
      <h3 class="live__keys-title" id="live-{id}-code">Code</h3>
      <!-- A focusable scroll region, so keyboard users can scroll a long sample. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="live__code-scroll" role="region" aria-labelledby="live-{id}-code" tabindex="0">
        <Code variant="block" language="svelte" value={code} data-live-code />
      </div>
    </div>
  {/if}
</section>

<style>
  .live {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--tx-border);
    border-radius: 0.75rem;
    background: var(--tx-surface, Canvas);
  }
  .live__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .live__title {
    margin: 0;
    font-size: 1.35rem;
  }
  .live__tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }
  .live__stage {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    gap: 1rem;
    min-block-size: 14rem;
    padding: 1rem;
    border: 1px solid var(--tx-border);
    border-radius: 0.625rem;
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .live__panel {
    display: grid;
    align-content: start;
    gap: 0.5rem;
    min-inline-size: 0;
    padding: 0.875rem;
    border: 1px dashed var(--tx-border);
    border-radius: 0.5rem;
  }
  .live__panel-title {
    margin: 0;
    font-size: 0.9375rem;
  }
  .live__panel-note {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground);
  }
  .live__canvas {
    display: grid;
    gap: 0.75rem;
    padding-block: 0.5rem;
    min-inline-size: 0;
  }
  .live__status {
    margin: 0;
    align-self: center;
    justify-self: center;
    color: var(--tx-muted-foreground);
  }
  .live__aside {
    display: grid;
    align-content: start;
    gap: 0.75rem;
  }
  .live__part {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  .live__part-label {
    color: var(--tx-muted-foreground);
  }
  .live__aside :global(.live__reset) {
    justify-self: start;
  }
  .live__keys,
  .live__code {
    display: grid;
    gap: 0.5rem;
    min-inline-size: 0;
  }
  .live__keys-title {
    margin: 0;
    font-size: 0.9375rem;
  }
  .live__key-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
    gap: 0.375rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .live__key {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--tx-border);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: background-color 150ms ease;
  }
  .live__key[data-pressed] {
    border-color: var(--tx-ring, Highlight);
    background: var(--tx-accent, Canvas);
    color: var(--tx-accent-foreground, CanvasText);
  }
  .live__key-caps {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .live__key-status {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground);
  }
  .live__code-scroll {
    max-block-size: 22rem;
    overflow: auto;
    border-radius: 0.5rem;
  }
  .live__code-scroll:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  /* The wrapper scrolls; the sample inside grows to its content. */
  .live__code-scroll :global(pre),
  .live__code-scroll :global(code) {
    margin: 0;
    overflow: visible;
    inline-size: max-content;
    min-inline-size: 100%;
  }
  /* Shared layout for each demo's outside controls (controlled panels). */
  .live :global(.demo-controls) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .live :global([data-demo-readout]) {
    flex-basis: 100%;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
  }
  /* The anatomy bridge: a dashed outline (the focus ring wins when focused). */
  .live :global([data-demo-hot]:not(:focus-visible)) {
    outline: 2px dashed var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  @media (min-width: 64rem) {
    .live {
      grid-template-columns: minmax(0, 1fr) 18rem;
    }
    .live__bar,
    .live__keys,
    .live__code {
      grid-column: 1 / -1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .live__key {
      transition: none;
    }
  }
  @media (forced-colors: active) {
    .live__key[data-pressed] {
      border-color: Highlight;
      outline: 2px solid Highlight;
    }
    .live :global([data-demo-hot]:not(:focus-visible)) {
      outline-color: Highlight;
    }
  }
</style>
