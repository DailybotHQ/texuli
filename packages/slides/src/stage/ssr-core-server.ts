/**
 * The `#deck-ssr-core` import of a server build (the default condition): the
 * core stage's lazy code is preloaded before any server render, without the
 * default renderer tables. A failed part keeps its loading status; it never
 * stops the server.
 */
import { preloadDeckStageCore } from './ssr-preload-core.ts';

await preloadDeckStageCore();
