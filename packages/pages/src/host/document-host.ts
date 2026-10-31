import type { DocumentPlayerHost } from '@texuli/player';
import { loadDefaultPlayer } from '../shared/player.ts';
import {
  createDocumentPlayerHostCore,
  type DocumentPlayerHostOptions,
} from './document-host-core.ts';

/**
 * A `documentHost` for `Player`: `createDocumentPlayerHostCore` with the
 * default player loader, so embeds inside the document paint with
 * `@texuli/player` (`loadPlayer: null` turns them off). A host that never
 * wants the player's dynamic import in its build uses
 * `createDocumentPlayerHostCore` from `@texuli/pages/host-core` (G123).
 */
export function createDocumentPlayerHost(
  options: DocumentPlayerHostOptions = {}
): DocumentPlayerHost {
  return createDocumentPlayerHostCore({
    ...options,
    loadPlayer: options.loadPlayer === undefined ? loadDefaultPlayer : options.loadPlayer,
  });
}
