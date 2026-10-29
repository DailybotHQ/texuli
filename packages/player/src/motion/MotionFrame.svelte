<script lang="ts">
/**
 * Wraps one painted node that declares motion (spec 0.6.0). The wrapper is
 * `display: contents`, so layouts see the node's own element, and the
 * animations play on its element children through `@texuli/core/motion`.
 * Nothing runs on the server; a node present at the first paint does not
 * enter; a leaving node is inert while its exit plays.
 */
import type { BlueprintNodeMotion } from '@texuli/spec/motion';
import { type Snippet, untrack } from 'svelte';
import { getPlayerMotion } from './context.ts';
import type { MotionHandle } from './runtime.ts';

let {
  motion,
  path,
  delay = 0,
  leaving = false,
  children,
}: {
  motion: Readonly<BlueprintNodeMotion>;
  path: string;
  delay?: number;
  leaving?: boolean;
  children: Snippet;
} = $props();

const player = getPlayerMotion();
// Created after the first paint: this node is new content and may enter.
const entering = player?.painted() === true && !untrack(() => leaving);
let wrapper = $state<HTMLElement | null>(null);

// Enter once, after mount.
$effect(() => {
  const element = wrapper;
  const declared = untrack(() => motion);
  if (!player || !element || !entering || !declared.enter) return;
  let handle: MotionHandle | null = null;
  let stopped = false;
  const wait = untrack(() => delay);
  void player.load().then((runtime) => {
    if (stopped || !runtime || !element.isConnected) return;
    handle = runtime.playEnter(element, declared, player.settings(), wait);
  });
  return () => {
    stopped = true;
    handle?.cancel();
  };
});

// Layout (FLIP): take part while `layout` is on.
$effect(() => {
  const element = wrapper;
  if (!player || !element || motion.layout !== true) return;
  return player.registerLayout(path, element);
});

// Exit: while leaving, play the exit preset, then let the player drop the node.
$effect(() => {
  const element = wrapper;
  if (!player || !element || !leaving) return;
  const declared = untrack(() => motion);
  const handle = player.playExit(element, declared);
  if (!handle) {
    player.exited(path);
    return;
  }
  let stopped = false;
  void handle.finished.then(() => {
    if (stopped) return;
    // The end state lives in an attribute (no lasting inline style) until the node goes.
    element.setAttribute('data-tx-player-motion-done', '');
    player.exited(path);
  });
  return () => {
    // Back in the plan (or gone): stop the exit; `fill: none` restores the node.
    stopped = true;
    handle.cancel();
    element.removeAttribute('data-tx-player-motion-done');
  };
});
</script>

<div
  class="tx-player__motion"
  data-tx-player-motion={path}
  data-tx-player-motion-leaving={leaving ? '' : undefined}
  inert={leaving || undefined}
  bind:this={wrapper}
>
  {@render children()}
</div>
