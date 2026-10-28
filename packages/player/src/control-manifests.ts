import type { CatalogManifest } from '@texuli/catalog/manifest';
import {
  CONTROL_STATE_TYPES as CATALOG_CONTROL_STATE_TYPES,
  choiceControlManifest,
  filterControlManifest,
  sliderControlManifest,
  toggleControlManifest,
} from '@texuli/catalog/manifests/state';
import type { GrammarComponentMeta } from '@texuli/catalog/render/grammar';
import type { StateDeclaration } from './state/schema.ts';

/**
 * The state-only controls (G06/D14). The manifests live in the catalog's
 * `state` group (ADR-008); the player re-exports them.
 */
export {
  choiceControlManifest,
  filterControlManifest,
  sliderControlManifest,
  toggleControlManifest,
};

/** The state type each control sets. */
export const CONTROL_STATE_TYPES: Readonly<Record<string, StateDeclaration['type']>> =
  CATALOG_CONTROL_STATE_TYPES;

export function isControlId(id: string): boolean {
  return Object.hasOwn(CONTROL_STATE_TYPES, id);
}

export const CONTROL_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  toggleControlManifest,
  choiceControlManifest,
  sliderControlManifest,
  filterControlManifest,
]);

export const CONTROL_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = Object.freeze(
  Object.keys(CONTROL_STATE_TYPES).map((id): GrammarComponentMeta => ({ id, role: 'interactive' }))
);
