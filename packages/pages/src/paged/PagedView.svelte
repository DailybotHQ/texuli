<script lang="ts">
/**
 * PagedView: `PagedViewCore` with the default player loader, so live
 * embeds paint with `@texuli/player` (loaded on first use) and
 * `loadPlayer={null}` turns them off. The loader's dynamic import stays in
 * the build; a host that never wants the player imports `PagedViewCore`
 * from `@texuli/pages/paged-core` (G123). Every prop is the core's.
 */
import type { ComponentProps } from 'svelte';
import { loadDefaultPlayer } from '../shared/player.ts';
import PagedViewCore from './PagedViewCore.svelte';

type Props = ComponentProps<typeof PagedViewCore>;

let { loadPlayer, ...rest }: Props = $props();
</script>

<PagedViewCore {...rest} loadPlayer={loadPlayer === undefined ? loadDefaultPlayer : loadPlayer} />
