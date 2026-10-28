/**
 * The stage's default renderer tables (the 20 catalog layouts, then the
 * component registry), in their own module so the stage and the print view
 * import them on first use (`loadDefaultDeckRenderers`) and a host that
 * turns them off (`defaultRenderers={false}`) ships none of their code.
 */
import { layoutRenderers } from '../layouts/index.ts';
import { componentRenderers } from '../registry/index.ts';
import type { DeckRenderers } from './renderers.ts';

export const DEFAULT_DECK_RENDERERS: readonly DeckRenderers[] = Object.freeze([
  layoutRenderers,
  componentRenderers,
]);
