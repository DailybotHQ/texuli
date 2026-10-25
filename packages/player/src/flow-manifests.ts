import type { CatalogManifest } from '@texuli/catalog/manifest';
import type { GrammarComponentMeta } from '@texuli/catalog/render/grammar';

/**
 * Views and flows (audit G09): `flow-view` holds one declared view's content
 * and paints it only while that view is current; `flow-action` fires one
 * declared event. Both need the local-state wrapper's `flow` declaration.
 * The manifests live in the player until the catalog adopts them.
 */

const shared = {
  package: '@texuli/player',
  tier: 'content' as const,
  agentEmittable: true,
};

export const flowViewManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'flow-view',
  label: 'Flow view',
  summary: 'One named view of a multi-step flow; only the current view paints.',
  useWhen: Object.freeze(['Split a wizard or a multi-step report into named steps']),
  dontUseWhen: Object.freeze(['Content that should always show']),
  a11y: Object.freeze(['A labelled region; focus moves to it when an action brings it into view']),
  props: Object.freeze([
    { name: 'name', kind: 'string' as const, required: true, description: 'A declared view.' },
    { name: 'label', kind: 'string' as const, trust: 'untrusted' as const },
    { name: 'children', kind: 'slot' as const },
  ]),
  examples: Object.freeze([
    { id: 'step', title: 'Review step', props: { name: 'review', label: 'Review' } },
  ]),
  related: Object.freeze(['flow-action']),
}) as CatalogManifest;

export const flowActionManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'flow-action',
  label: 'Flow action',
  summary: 'A button that fires one declared flow event, such as next or back.',
  useWhen: Object.freeze(['Move between the views of a declared flow']),
  dontUseWhen: Object.freeze(['Submitting or navigating away: actions only change the local view']),
  a11y: Object.freeze([
    'A type="button"; aria-disabled when no transition applies from the current view',
  ]),
  props: Object.freeze([
    { name: 'event', kind: 'string' as const, required: true, description: 'A declared event.' },
    { name: 'label', kind: 'string' as const, required: true, trust: 'untrusted' as const },
  ]),
  examples: Object.freeze([{ id: 'next', title: 'Next', props: { event: 'next', label: 'Next' } }]),
  related: Object.freeze(['flow-view']),
}) as CatalogManifest;

export const FLOW_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  flowViewManifest,
  flowActionManifest,
]);

export const FLOW_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = Object.freeze([
  { id: 'flow-view', role: 'container' },
  { id: 'flow-action', role: 'interactive' },
]);
