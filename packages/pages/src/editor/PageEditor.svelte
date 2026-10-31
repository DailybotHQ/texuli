<script lang="ts">
/**
 * PageEditor: `PageEditorCore` with the default player loader, so live
 * embeds paint with `@texuli/player` (loaded on first use) and
 * `loadPlayer={null}` turns them off. The loader's dynamic import stays in
 * the build; a host that never wants the player imports `PageEditorCore`
 * from `@texuli/pages/editor-core` (G123). Every prop is the core's.
 */
import type { ComponentProps } from 'svelte';
import { loadDefaultPlayer } from '../shared/player.ts';
import PageEditorCore from './PageEditorCore.svelte';

type Props = ComponentProps<typeof PageEditorCore>;

let { editor = $bindable(), loadPlayer, ...rest }: Props = $props();
</script>

<PageEditorCore
  {...rest}
  bind:editor
  loadPlayer={loadPlayer === undefined ? loadDefaultPlayer : loadPlayer}
/>
