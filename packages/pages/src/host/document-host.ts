import { checkDeckPayload } from '@texuli/document/schema';
import type { DocumentPlayerHost } from '@texuli/player';
import { loadPagesLibraryBase } from '../shared/library-base.ts';
import { loadDefaultPlayer } from '../shared/player.ts';
import {
  createDocumentPlayerHostCore,
  type DocumentPlayerHostOptions,
} from './document-host-core.ts';

/**
 * A `documentHost` for `Player`: `createDocumentPlayerHostCore` with the
 * default player loader, so embeds inside the document paint with
 * `@texuli/player` (`loadPlayer: null` turns them off), and the theme
 * library as the default `loadLibraryBase` (G127), and `checkDeckPayload`
 * as the default `validateDeck` (G136). A host that never
 * wants the player's dynamic import in its build uses
 * `createDocumentPlayerHostCore` from `@texuli/pages/host-core` (G123).
 */
export function createDocumentPlayerHost(
  options: DocumentPlayerHostOptions = {}
): DocumentPlayerHost {
  return createDocumentPlayerHostCore({
    ...options,
    loadPlayer: options.loadPlayer === undefined ? loadDefaultPlayer : options.loadPlayer,
    loadLibraryBase:
      options.loadLibraryBase === undefined ? loadPagesLibraryBase : options.loadLibraryBase,
    validateDeck: options.validateDeck === undefined ? checkDeckPayload : options.validateDeck,
  });
}
