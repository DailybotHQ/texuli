<script lang="ts">
/**
 * Paints one catalog component on a slide: a host override when the
 * registry has one for the id, otherwise the player, given the one-node
 * blueprint (`componentBlueprint`) at the stage's tier. The player validates
 * the node again, loads its painter family lazily, refuses invalid or
 * hostile props with a visible note, keeps local state in the registry's
 * state host, and is inert while its slide is not the active one. The
 * player's own chrome (label, trust and status badges) is hidden: the slide
 * is the frame.
 */
import { Player } from '@texuli/player';
import { componentBlueprint } from '../registry/blueprint.ts';
import { paintsComponent, registryOptions } from '../registry/index.ts';
import { getDeckStageContext } from '../stage/context.ts';
import type { DeckSlideRenderContext } from '../stage/renderers.ts';

interface Props {
  /** The catalog id. */
  id: string;
  props: Readonly<Record<string, unknown>>;
  context: DeckSlideRenderContext;
  /** `<slide id>/<path>`: where the state host keeps this component's state. */
  stateKey: string;
  /** The accessible name of the component region. */
  label: string;
  /** `fill` stretches to the slide region; the others cap the block size. */
  height?: 'sm' | 'md' | 'lg' | 'fill';
}

let { id, props, context, stateKey, label, height = 'md' }: Props = $props();

const stage = getDeckStageContext();
let options = $derived(registryOptions(context.renderers));
let override = $derived(Object.hasOwn(options.overrides, id) ? options.overrides[id] : undefined);
let paints = $derived(paintsComponent(id, options));
let blueprint = $derived(componentBlueprint({ id, props: { ...props } }, options.capabilities));
let motion = $derived<'auto' | 'reduce'>(stage?.reducedMotion ? 'reduce' : 'auto');
// The snapshot is read once per mount: later changes flow out through onStateChange.
// svelte-ignore state_referenced_locally
const initialState = options.stateHost.read(stateKey);

/** The player's own chrome: a heading with its label, badges and skip links. */
const CHROME = ':scope > .tx-player__chrome, :scope > .tx-player__skip, :scope > .tx-player__end';
let root = $state<HTMLElement | null>(null);

/**
 * The slide is the frame, so the player's chrome leaves the accessibility
 * tree (`hidden`, not only a style): a component adds no heading to the
 * slide's outline. Re-applied if the player re-renders its root's children.
 */
function hideChrome(container: HTMLElement): void {
  for (const player of container.querySelectorAll<HTMLElement>('[data-tx-player]')) {
    for (const part of player.querySelectorAll<HTMLElement>(CHROME)) {
      if (!part.hidden) part.hidden = true;
    }
  }
}

$effect(() => {
  const container = root;
  if (!container || override || !paints) return;
  void blueprint;
  hideChrome(container);
  if (typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(() => hideChrome(container));
  observer.observe(container, { childList: true });
  for (const player of container.querySelectorAll('[data-tx-player]')) {
    observer.observe(player, { childList: true });
  }
  return () => observer.disconnect();
});
</script>

<div
  bind:this={root}
  class="tx-deck-component"
  data-tx-deck-component={id}
  data-height={height}
  data-tier={context.tier}
>
  {#if override}
    {@const Painter = override}
    <Painter {id} {props} {context} {stateKey} />
  {:else if paints}
    <Player
      {blueprint}
      {label}
      tier={context.tier}
      active={context.active}
      {motion}
      landmarks={false}
      {initialState}
      onStateChange={(snapshot) => options.stateHost.write(stateKey, snapshot)}
      onAction={options.onAction}
    />
  {:else}
    <p class="tx-deck-stage__error" role="note" data-tx-deck-component-refused={id}>
      {context.t('stage.componentPending', { component: id })}
    </p>
  {/if}
</div>

<style>
  .tx-deck-component {
    display: block;
    min-inline-size: 0;
    inline-size: 100%;
  }
  .tx-deck-component[data-height='sm'] {
    max-block-size: 30%;
  }
  .tx-deck-component[data-height='md'] {
    max-block-size: 60%;
  }
  .tx-deck-component[data-height='fill'] {
    block-size: 100%;
  }
  /* The slide is the frame: the player's heading, badges and skip links stay out of view. */
  .tx-deck-component :global(.tx-player__chrome),
  .tx-deck-component :global(.tx-player__skip),
  .tx-deck-component :global(.tx-player__end) {
    display: none;
  }
  /* The wrapping document frame is invisible: no box, no padding. */
  .tx-deck-component :global(.tx-player-layout--doc) {
    padding: 0;
    border: 0;
    background: none;
  }
</style>
