import type { CatalogManifest } from '@texuli/catalog/manifest';
import type { GrammarComponentMeta } from '@texuli/catalog/render/grammar';
import type { StateDeclaration } from './state/schema.ts';

/**
 * State-only controls (audit G06, decision D14: "local-state-only allowed,
 * no submits"). Each control names one declared local-state variable in its
 * `state` prop and can do exactly one thing: set that variable. It cannot
 * submit, navigate or call the host; the host hears `onStateChange`.
 * Agent-emittable under the tier rules, like the rest of the content set.
 * The manifests live in the player until the catalog adopts them.
 */

/** The state type each control writes. */
export const CONTROL_STATE_TYPES: Readonly<Record<string, StateDeclaration['type']>> =
  Object.freeze({
    'control-toggle': 'boolean',
    'control-choice': 'enum',
    'control-slider': 'number',
    'control-filter': 'string',
  });

export function isControlId(id: string): boolean {
  return Object.hasOwn(CONTROL_STATE_TYPES, id);
}

const shared = {
  package: '@texuli/player',
  tier: 'content' as const,
  agentEmittable: true,
  dontUseWhen: Object.freeze([
    'Submitting, saving or sending anything: controls only set local state',
    'Navigating: use a link',
  ]),
};

const stateProp = {
  name: 'state',
  kind: 'string' as const,
  required: true,
  description: 'The declared local-state variable this control sets.',
};
const labelProp = {
  name: 'label',
  kind: 'string' as const,
  required: true,
  trust: 'untrusted' as const,
  description: 'Visible label and accessible name.',
};

export const toggleControlManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'control-toggle',
  label: 'Toggle control',
  summary: 'A switch that sets a boolean state variable.',
  useWhen: Object.freeze(['Show or hide details, include or exclude a series']),
  a11y: Object.freeze(['A button with role="switch" and aria-checked; Space or Enter flips it']),
  props: Object.freeze([stateProp, labelProp]),
  examples: Object.freeze([
    { id: 'details', title: 'Show details', props: { state: 'details', label: 'Show details' } },
  ]),
  related: Object.freeze(['control-choice']),
}) as CatalogManifest;

export const choiceControlManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'control-choice',
  label: 'Choice control',
  summary: 'A segmented choice that sets an enum state variable to one of its values.',
  useWhen: Object.freeze(['Switch between a few views or ranges, such as this week or last week']),
  a11y: Object.freeze([
    'A radiogroup of radio buttons; arrows, Home and End move and select (roving tabindex)',
  ]),
  props: Object.freeze([stateProp, labelProp]),
  examples: Object.freeze([
    { id: 'range', title: 'Week', props: { state: 'week', label: 'Week' } },
  ]),
  related: Object.freeze(['control-toggle', 'control-slider']),
}) as CatalogManifest;

export const sliderControlManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'control-slider',
  label: 'Slider control',
  summary: 'A range input that sets a number state variable within its declared min and max.',
  useWhen: Object.freeze(['Adjust a threshold or a count within a bounded range']),
  a11y: Object.freeze(['A native range input with a visible label and value']),
  props: Object.freeze([
    stateProp,
    labelProp,
    { name: 'step', kind: 'number' as const, description: 'Increment; default 1.' },
  ]),
  examples: Object.freeze([
    { id: 'limit', title: 'Limit', props: { state: 'limit', label: 'Items shown', step: 1 } },
  ]),
  related: Object.freeze(['control-choice']),
}) as CatalogManifest;

export const filterControlManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'control-filter',
  label: 'Filter control',
  summary: 'A text field that sets a string state variable, capped at its declared length.',
  useWhen: Object.freeze(['Type a filter that other nodes read through a binding']),
  a11y: Object.freeze(['A native search input with a visible label; Enter never submits']),
  props: Object.freeze([
    stateProp,
    labelProp,
    { name: 'placeholder', kind: 'string' as const, trust: 'untrusted' as const },
  ]),
  examples: Object.freeze([
    { id: 'query', title: 'Filter', props: { state: 'query', label: 'Filter tickets' } },
  ]),
  related: Object.freeze(['control-toggle']),
}) as CatalogManifest;

export const CONTROL_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  toggleControlManifest,
  choiceControlManifest,
  sliderControlManifest,
  filterControlManifest,
]);

/** Controls are interactive in the grammar: no control nests inside another interactive node. */
export const CONTROL_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = Object.freeze(
  Object.keys(CONTROL_STATE_TYPES).map((id): GrammarComponentMeta => ({ id, role: 'interactive' }))
);
