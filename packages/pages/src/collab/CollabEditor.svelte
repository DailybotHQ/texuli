<script lang="ts">
/**
 * CollabEditor: `CollabEditorCore` with the default player loader, so live
 * embeds paint with `@texuli/player` (loaded on first use) and
 * `loadPlayer={null}` turns them off. The loader's dynamic import stays in
 * the build; a host that never wants the player imports `CollabEditorCore`
 * from `@texuli/pages/collab-core` (G123). Inline decks are checked with
 * `checkDeckPayload` by default (G136). Every prop is the core's.
 */
import { checkDeckPayload, type DeckPayloadValidator } from '@texuli/document/schema';
import type { ComponentProps } from 'svelte';
import { loadDefaultPlayer } from '../shared/player.ts';
import type { PagesPlayerLoader } from '../shared/player-loader.ts';
import CollabEditorCore from './CollabEditorCore.svelte';

type Props = Omit<ComponentProps<typeof CollabEditorCore>, 'loadPlayer' | 'validateDeck'> & {
  /** Loads `@texuli/player` for live embeds; default: the package loader; `null` turns them off. */
  loadPlayer?: PagesPlayerLoader | null;
  /** Checks inline decks; default `checkDeckPayload`; `null` refuses them. */
  validateDeck?: DeckPayloadValidator | null;
};

let {
  editor = $bindable(),
  history = $bindable(false),
  loadPlayer,
  validateDeck,
  ...rest
}: Props = $props();
</script>

<CollabEditorCore
  {...rest}
  bind:editor
  bind:history
  loadPlayer={loadPlayer === undefined ? loadDefaultPlayer : loadPlayer}
  validateDeck={validateDeck === undefined ? checkDeckPayload : validateDeck}
/>
