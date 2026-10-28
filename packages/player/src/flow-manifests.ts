import type { CatalogManifest } from '@texuli/catalog/manifest';
import { flowActionManifest, flowViewManifest } from '@texuli/catalog/manifests/state';
import type { GrammarComponentMeta } from '@texuli/catalog/render/grammar';

/** Views and flows (G09). The manifests live in the catalog's `state` group (ADR-008). */
export { flowActionManifest, flowViewManifest };

export const FLOW_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  flowViewManifest,
  flowActionManifest,
]);

export const FLOW_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = Object.freeze([
  { id: 'flow-view', role: 'container' },
  { id: 'flow-action', role: 'interactive' },
]);
