<script lang="ts">
/**
 * PageReader: `PageReaderCore` with the default player loader, so live
 * embeds paint with `@texuli/player` (loaded on first use) and
 * `loadPlayer={null}` turns them off. The loader's dynamic import stays in
 * the build; a host that never wants the player imports `PageReaderCore`
 * from `@texuli/pages/reader-core` (G123). A design system's
 * `texuli:<theme>` bases load from the token theme library by default
 * (`loadPagesLibraryBase`; `loadLibraryBase={null}` refuses them; the core
 * has no default, G127). Every prop is the core's.
 */
import type { ComponentProps } from 'svelte';
import type { PagesLibraryBaseLoader } from '../shared/design-system-types.ts';
import { loadPagesLibraryBase } from '../shared/library-base.ts';
import { loadDefaultPlayer } from '../shared/player.ts';
import type { PagesPlayerLoader } from '../shared/player-loader.ts';
import PageReaderCore from './PageReaderCore.svelte';

type Props = Omit<ComponentProps<typeof PageReaderCore>, 'loadPlayer' | 'loadLibraryBase'> & {
  /** Loads `@texuli/player` for live embeds; default: the package loader; `null` turns them off. */
  loadPlayer?: PagesPlayerLoader | null;
  /** Loads `texuli:<theme>` design-system bases; default: the theme library; `null` refuses them. */
  loadLibraryBase?: PagesLibraryBaseLoader | null;
};

let { loadPlayer, loadLibraryBase, ...rest }: Props = $props();
</script>

<PageReaderCore
  {...rest}
  loadPlayer={loadPlayer === undefined ? loadDefaultPlayer : loadPlayer}
  loadLibraryBase={loadLibraryBase === undefined ? loadPagesLibraryBase : loadLibraryBase}
/>
