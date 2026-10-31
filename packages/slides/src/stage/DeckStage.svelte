<script lang="ts">
/**
 * DeckStage: `DeckStageCore` with the default renderer tables (the catalog
 * layouts and the component registry) as its last answer. They are imported
 * on first use; `defaultRenderers={false}` keeps them from loading, and a
 * host that never wants them imports `DeckStageCore` from
 * `@texuli/slides/stage-core` so its build does not even emit them (G72).
 * It also loads catalog themes from the token theme library when the host
 * passes no `loadTheme` (`loadDeckLibraryTheme`; the core has no default
 * loader, G127). Every prop is the core's; see `DeckStageCore.svelte`.
 */
import type { ComponentProps } from 'svelte';
// A server build preloads the stage's lazy code (the default tables included) here, so the
// server render keeps the slides (`./ssr-server.ts`); a browser build imports nothing.
import '#deck-ssr';
import DeckStageCore from './DeckStageCore.svelte';
import { DECK_DEFAULT_RENDERERS_SOURCE } from './defaults.ts';
import { loadDeckLibraryTheme } from './library-theme.ts';

type Props = Omit<ComponentProps<typeof DeckStageCore>, 'defaults'>;

let {
  presenter = $bindable(false),
  controller = $bindable(null),
  loadTheme = loadDeckLibraryTheme,
  ...rest
}: Props = $props();
</script>

<DeckStageCore
  {...rest}
  {loadTheme}
  bind:presenter
  bind:controller
  defaults={DECK_DEFAULT_RENDERERS_SOURCE}
/>
