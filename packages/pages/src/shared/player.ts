/**
 * The default player loader: the default entries (`editor`, `reader`,
 * `paged`, `collab`, `host` and the root) hand it to the views, so a page
 * without embeds never downloads the player, but the dynamic import stays
 * in their graph. The core entries never import this module (G123).
 */
import type { PagesPlayerLoader } from './player-loader.ts';

export const loadDefaultPlayer: PagesPlayerLoader = () =>
  Promise.all([import('@texuli/player'), import('@texuli/player/styles.css')]).then(
    ([module]) => module
  );
