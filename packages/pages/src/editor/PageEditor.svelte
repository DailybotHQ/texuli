<script lang="ts">
/**
 * PageEditor: `PageEditorCore` with the default player loader, so live
 * embeds paint with `@texuli/player` (loaded on first use) and
 * `loadPlayer={null}` turns them off. The loader's dynamic import stays in
 * the build; a host that never wants the player imports `PageEditorCore`
 * from `@texuli/pages/editor-core` (G123). Inline decks are checked with
 * `checkDeckPayload` by default (`validateDeck={null}` refuses them, G136).
 * Every prop is the core's.
 */
import type { DeckPayloadValidator } from '@texuli/document/schema';
import { checkDeckPayload } from '@texuli/document/schema';
import type { ComponentProps } from 'svelte';
import { loadDefaultPlayer } from '../shared/player.ts';
import type { PagesPlayerLoader } from '../shared/player-loader.ts';
import PageEditorCore from './PageEditorCore.svelte';

type Props = Omit<ComponentProps<typeof PageEditorCore>, 'loadPlayer' | 'validateDeck'> & {
  /** Loads `@texuli/player` for live embeds; default: the package loader; `null` turns them off. */
  loadPlayer?: PagesPlayerLoader | null;
  /** Checks inline decks; default `checkDeckPayload`; `null` refuses them. */
  validateDeck?: DeckPayloadValidator | null;
};

let { editor = $bindable(), loadPlayer, validateDeck, ...rest }: Props = $props();
</script>

<PageEditorCore
  {...rest}
  bind:editor
  loadPlayer={loadPlayer === undefined ? loadDefaultPlayer : loadPlayer}
  validateDeck={validateDeck === undefined ? checkDeckPayload : validateDeck}
/>
