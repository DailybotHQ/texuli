<script lang="ts">
import { type ComponentProps, untrack } from 'svelte';
import Player from './Player.svelte';
import type { StateSnapshot } from './state/schema.ts';

/**
 * Holds `<Player>` props for `mountPlayer` so an update changes them in
 * place (R20): the player instance, its declared state, flow view,
 * selection and loaded painters stay; only the props move.
 */
type PlayerProps = ComponentProps<typeof Player>;

let { initial }: { initial: PlayerProps } = $props();

let current = $state.raw<PlayerProps>(untrack(() => initial));
let player = $state<ReturnType<typeof Player> | undefined>();

export function setProps(next: PlayerProps): void {
  current = next;
}
export function setState(name: string, value: unknown): boolean {
  return player?.setState(name, value) ?? false;
}
export function getState(): StateSnapshot | null {
  return player?.getState() ?? null;
}
export function dispatchFlow(event: string): boolean {
  return player?.dispatchFlow(event) ?? false;
}
export function getView(): string | null {
  return player?.getView() ?? null;
}
</script>

<Player bind:this={player} {...current} />
