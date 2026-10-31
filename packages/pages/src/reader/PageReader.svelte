<script lang="ts">
/**
 * PageReader: `PageReaderCore` with the default player loader, so live
 * embeds paint with `@texuli/player` (loaded on first use) and
 * `loadPlayer={null}` turns them off. The loader's dynamic import stays in
 * the build; a host that never wants the player imports `PageReaderCore`
 * from `@texuli/pages/reader-core` (G123). Every prop is the core's.
 */
import type { ComponentProps } from 'svelte';
import { loadDefaultPlayer } from '../shared/player.ts';
import PageReaderCore from './PageReaderCore.svelte';

type Props = ComponentProps<typeof PageReaderCore>;

let { loadPlayer, ...rest }: Props = $props();
</script>

<PageReaderCore {...rest} loadPlayer={loadPlayer === undefined ? loadDefaultPlayer : loadPlayer} />
