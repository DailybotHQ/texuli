import type { CatalogManifest } from '@texuli/catalog/manifest';
import {
  actionFormManifest,
  formFieldManifest,
  formSubmitManifest,
} from '@texuli/catalog/manifests/state';
import type { GrammarComponentMeta } from '@texuli/catalog/render/grammar';

/**
 * The G17 action surface: forms whose submit is an action intent the host
 * confirms. The manifests live in the catalog's `state` group (ADR-008); the
 * player re-exports them under their established names.
 */
export { actionFormManifest, formFieldManifest, formSubmitManifest };

export const ACTION_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  actionFormManifest,
  formFieldManifest,
  formSubmitManifest,
]);

export const ACTION_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = Object.freeze([
  { id: 'action-form', role: 'container', landmark: 'form' },
  { id: 'form-field', role: 'interactive' },
  { id: 'form-submit', role: 'primary-action' },
]);
