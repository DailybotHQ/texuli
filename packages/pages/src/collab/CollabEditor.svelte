<script lang="ts">
/**
 * CollabEditor: `CollabEditorCore` with the default player loader, so live
 * embeds paint with `@texuli/player` (loaded on first use) and
 * `loadPlayer={null}` turns them off. The loader's dynamic import stays in
 * the build; a host that never wants the player imports `CollabEditorCore`
 * from `@texuli/pages/collab-core` (G123). Every prop is the core's.
 */
import type { ComponentProps } from 'svelte';
import { loadDefaultPlayer } from '../shared/player.ts';
import CollabEditorCore from './CollabEditorCore.svelte';

type Props = ComponentProps<typeof CollabEditorCore>;

let { editor = $bindable(), history = $bindable(false), loadPlayer, ...rest }: Props = $props();
</script>

<CollabEditorCore
  {...rest}
  bind:editor
  bind:history
  loadPlayer={loadPlayer === undefined ? loadDefaultPlayer : loadPlayer}
/>
