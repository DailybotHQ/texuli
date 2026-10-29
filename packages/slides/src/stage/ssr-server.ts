/**
 * The `#deck-ssr` import of a server build (the default condition): the
 * stage's lazy code is preloaded before any server render, so `DeckStage`
 * renders the slides instead of a loading status. A failed part keeps its
 * loading status; it never stops the server.
 */
import { preloadDeckStage } from './ssr-preload.ts';

await preloadDeckStage();
