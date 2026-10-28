import type { CatalogManifest } from '@texuli/catalog/manifest';
import { CHAT_GRAMMAR_ROLES } from '@texuli/catalog/manifests/chat';
import {
  COMPOSITION_GRAMMAR_ROLES,
  COMPOSITION_MANIFESTS,
  LAYOUT_ALIGNS,
  LAYOUT_GAPS,
  rowLayoutManifest,
  SPLIT_RATIOS,
  splitLayoutManifest,
  stackLayoutManifest,
  tileLayoutManifest,
} from '@texuli/catalog/manifests/composition';
import { DATA_GRAMMAR_ROLES } from '@texuli/catalog/manifests/data';
import { WORKFLOWS_GRAMMAR_ROLES } from '@texuli/catalog/manifests/workflows';
import { type GrammarComponentMeta, grammarRolesFromList } from '@texuli/catalog/render/grammar';
import { ACTION_GRAMMAR_ROLES } from './action-manifests.ts';
import { CONTROL_GRAMMAR_ROLES } from './control-manifests.ts';
import { FLOW_GRAMMAR_ROLES } from './flow-manifests.ts';
import { REGION_GRAMMAR_ROLES } from './region-manifests.ts';

/**
 * The G20 layout vocabulary (audit G20, player design R16): stack, row,
 * split and tile span, for untrusted trees. Every value is a closed enum or
 * a bounded number, so nothing a blueprint sends reaches CSS as free text.
 * The manifests live in the catalog's `composition` group (ADR-008).
 */

export {
  LAYOUT_ALIGNS,
  LAYOUT_GAPS,
  rowLayoutManifest,
  SPLIT_RATIOS,
  splitLayoutManifest,
  stackLayoutManifest,
  tileLayoutManifest,
};

export const G20_LAYOUT_MANIFESTS: readonly CatalogManifest[] = COMPOSITION_MANIFESTS;

/** Grammar roles for the G20 ids: containers; a tile title ranks like a card's. */
export const G20_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = COMPOSITION_GRAMMAR_ROLES;

/** The default grammar roles plus the G20 layouts, the state-only controls and the host region: what the player validates and paints with. */
export const PLAYER_GRAMMAR_ROLES = grammarRolesFromList([
  ...G20_GRAMMAR_ROLES,
  ...CONTROL_GRAMMAR_ROLES,
  ...REGION_GRAMMAR_ROLES,

  ...FLOW_GRAMMAR_ROLES,
  ...ACTION_GRAMMAR_ROLES,
  { id: 'sortable-list', role: 'interactive' },
  ...CHAT_GRAMMAR_ROLES,
  ...DATA_GRAMMAR_ROLES,
  ...WORKFLOWS_GRAMMAR_ROLES,
]);
