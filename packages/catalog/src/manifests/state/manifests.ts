import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import type { GrammarComponentMeta } from '../../render/grammar/types.ts';

/**
 * State and action surfaces painted by `@texuli/player`: the state-only
 * controls, the flow views and actions, the action form and its fields, the
 * host region and the sortable list (spec 0.3.0 `reorder`). Adopted from the
 * player-held manifests (ADR-008), so the catalog, the spec and the player
 * share one closed vocabulary.
 */

const PKG = '@texuli/player';

/** Field kinds a `form-field` takes. */
export const FIELD_KINDS = ['text', 'email', 'tel', 'number', 'multiline'] as const;

/**
 * `autocomplete` tokens a field may use. Payment (`cc-*`), credential and
 * one-time-code tokens are deliberately absent: a blueprint can never ask the
 * browser to fill them.
 */
export const AUTOCOMPLETE_ALLOWLIST = /* @__PURE__ */ Object.freeze([
  'off',
  'name',
  'given-name',
  'family-name',
  'nickname',
  'email',
  'tel',
  'organization',
  'organization-title',
  'street-address',
  'address-level1',
  'address-level2',
  'postal-code',
  'country-name',
  'language',
  'url',
] as const);

/** Names of the closed validation patterns (the player holds the expressions). */
export const FIELD_PATTERN_NAMES = /* @__PURE__ */ Object.freeze([
  'email',
  'phone',
  'postal-code',
  'digits',
  'slug',
] as const);

/** The state type each control sets. */
export const CONTROL_STATE_TYPES = /* @__PURE__ */ Object.freeze({
  'control-toggle': 'boolean',
  'control-choice': 'enum',
  'control-slider': 'number',
  'control-filter': 'string',
} as const);

/** A host region name: lowercase letters, digits and hyphens. */
export const HOST_REGION_NAME = /^[a-z][a-z0-9-]{0,31}$/;

const controlShared = {
  package: PKG,
  tier: 'content' as const,
  agentEmittable: true,
  dontUseWhen: [
    'Submitting, saving or sending anything: controls only set local state',
    'Navigating: use a link',
  ],
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

export const toggleControlManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  ...controlShared,
  id: 'control-toggle',
  label: 'Toggle control',
  summary: 'A switch that sets a boolean state variable.',
  useWhen: ['Show or hide details, include or exclude a series'],
  a11y: ['A button with role="switch" and aria-checked; Space or Enter flips it'],
  props: [stateProp, labelProp],
  events: ['change'],
  examples: [
    { id: 'details', title: 'Show details', props: { state: 'details', label: 'Show details' } },
  ],
  related: ['control-choice'],
});

export const choiceControlManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  ...controlShared,
  id: 'control-choice',
  label: 'Choice control',
  summary: 'A segmented choice that sets an enum state variable to one of its values.',
  useWhen: ['Switch between a few views or ranges, such as this week or last week'],
  a11y: ['A radiogroup of radio buttons; arrows, Home and End move and select (roving tabindex)'],
  props: [stateProp, labelProp],
  events: ['change'],
  examples: [{ id: 'range', title: 'Week', props: { state: 'week', label: 'Week' } }],
  related: ['control-toggle', 'control-slider'],
});

export const sliderControlManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  ...controlShared,
  id: 'control-slider',
  label: 'Slider control',
  summary: 'A range input that sets a number state variable within its declared min and max.',
  useWhen: ['Adjust a threshold or a count within a bounded range'],
  a11y: ['A native range input with a visible label and value'],
  props: [
    stateProp,
    labelProp,
    { name: 'step', kind: 'number', description: 'Increment; default 1.' },
  ],
  events: ['change'],
  examples: [
    { id: 'limit', title: 'Limit', props: { state: 'limit', label: 'Items shown', step: 1 } },
  ],
  related: ['control-choice'],
});

export const filterControlManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  ...controlShared,
  id: 'control-filter',
  label: 'Filter control',
  summary: 'A text field that sets a string state variable, capped at its declared length.',
  useWhen: ['Type a filter that other nodes read through a binding'],
  a11y: ['A native search input with a visible label; Enter never submits'],
  props: [stateProp, labelProp, { name: 'placeholder', kind: 'string', trust: 'untrusted' }],
  events: ['change'],
  examples: [{ id: 'query', title: 'Filter', props: { state: 'query', label: 'Filter tickets' } }],
  related: ['control-toggle'],
});

export const flowViewManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'flow-view',
  package: PKG,
  tier: 'content',
  agentEmittable: true,
  label: 'Flow view',
  summary: 'One named view of a multi-step flow; only the current view paints.',
  useWhen: ['Split a wizard or a multi-step report into named steps'],
  dontUseWhen: ['Content that should always show'],
  a11y: ['A labelled region; focus moves to it when an action brings it into view'],
  props: [
    { name: 'name', kind: 'string', required: true, description: 'A declared view.' },
    { name: 'label', kind: 'string', trust: 'untrusted' },
    { name: 'children', kind: 'slot' },
  ],
  examples: [{ id: 'step', title: 'Review step', props: { name: 'review', label: 'Review' } }],
  related: ['flow-action'],
});

export const flowActionManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'flow-action',
  package: PKG,
  tier: 'content',
  agentEmittable: true,
  label: 'Flow action',
  summary: 'A button that fires one declared flow event, such as next or back.',
  useWhen: ['Move between the views of a declared flow'],
  dontUseWhen: ['Submitting or navigating away: actions only change the local view'],
  a11y: ['A type="button"; aria-disabled when no transition applies from the current view'],
  props: [
    { name: 'event', kind: 'string', required: true, description: 'A declared event.' },
    { name: 'label', kind: 'string', required: true, trust: 'untrusted' },
  ],
  events: ['press'],
  examples: [{ id: 'next', title: 'Next', props: { event: 'next', label: 'Next' } }],
  related: ['flow-view'],
});

export const actionFormManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'action-form',
  package: PKG,
  tier: 'content',
  agentEmittable: true,
  label: 'Action form',
  summary: 'Groups fields whose submit proposes one named action intent to the host.',
  useWhen: ['Ask the host to do something with a few named values, such as a request'],
  dontUseWhen: ['Payment or sign-in: those are host regions'],
  a11y: ['A labelled form; invalid fields are marked and focused; the receipt is announced'],
  props: [
    {
      name: 'action',
      kind: 'string',
      required: true,
      description: 'The action name the host receives.',
    },
    { name: 'label', kind: 'string', required: true, trust: 'untrusted' },
    { name: 'children', kind: 'slot' },
  ],
  events: ['submit'],
  examples: [
    {
      id: 'request',
      title: 'Request access',
      props: { action: 'request-access', label: 'Request access' },
    },
  ],
  related: ['form-field', 'form-submit'],
});

export const formFieldManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'form-field',
  package: PKG,
  tier: 'content',
  agentEmittable: true,
  label: 'Form field',
  summary: 'A named, validated field bound to a declared local-state variable.',
  useWhen: ['Collect one value for an action'],
  dontUseWhen: ['Passwords, card numbers or one-time codes: never in a blueprint'],
  a11y: ['A visible label; required and invalid states are exposed; errors are linked'],
  props: [
    { name: 'name', kind: 'string', required: true, description: 'The key in the action values.' },
    {
      name: 'state',
      kind: 'string',
      required: true,
      description: 'The declared variable it binds.',
    },
    { name: 'label', kind: 'string', required: true, trust: 'untrusted' },
    { name: 'kind', kind: 'enum', enumValues: FIELD_KINDS, default: 'text' },
    { name: 'required', kind: 'boolean' },
    { name: 'autocomplete', kind: 'enum', enumValues: AUTOCOMPLETE_ALLOWLIST },
    { name: 'pattern', kind: 'enum', enumValues: FIELD_PATTERN_NAMES },
    { name: 'minLength', kind: 'number' },
    { name: 'maxLength', kind: 'number' },
    { name: 'min', kind: 'number' },
    { name: 'max', kind: 'number' },
    { name: 'placeholder', kind: 'string', trust: 'untrusted' },
  ],
  events: ['change'],
  examples: [
    {
      id: 'email',
      title: 'Email',
      props: { name: 'email', state: 'email', label: 'Email', kind: 'email', required: true },
    },
  ],
  related: ['action-form'],
});

export const formSubmitManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'form-submit',
  package: PKG,
  tier: 'content',
  agentEmittable: true,
  label: 'Form submit',
  summary:
    "Proposes the form's action with its fields' values; disabled while a receipt is pending.",
  useWhen: ['The one primary action of an action-form'],
  dontUseWhen: ['Navigation or local view changes: use flow-action'],
  a11y: ['A submit button inside the form; Enter in a field submits too'],
  props: [{ name: 'label', kind: 'string', required: true, trust: 'untrusted' }],
  examples: [{ id: 'send', title: 'Send', props: { label: 'Send request' } }],
  related: ['action-form'],
});

export const hostRegionManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'host-region',
  package: PKG,
  label: 'Host region',
  summary: 'Reserves a named place where the host app mounts its own component.',
  tier: 'content',
  agentEmittable: true,
  useWhen: [
    'A step that needs sensitive input the agent must never emit (payment, sign-in)',
    'A place for host chrome that lives inside the document flow',
  ],
  dontUseWhen: [
    'Content the agent can describe itself: use a content block',
    'Card numbers, passwords or one-time codes as props: those never appear in a blueprint',
  ],
  a11y: [
    'The host component sits in a labelled group named by the label',
    'A region the host does not provide shows the label as visible text, not an empty box',
  ],
  props: [
    {
      name: 'name',
      kind: 'string',
      required: true,
      description: 'The region the host provides, such as "payment" (lowercase, digits, hyphens).',
    },
    {
      name: 'label',
      kind: 'string',
      required: true,
      trust: 'untrusted',
      description: 'What the region is for; its accessible name and its placeholder text.',
    },
  ],
  examples: [
    { id: 'payment', title: 'Payment step', props: { name: 'payment', label: 'Payment details' } },
  ],
  related: ['layout-stack'],
});

export const sortableListManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'sortable-list',
  package: PKG,
  label: 'Sortable list',
  summary:
    'A list whose items are a bound list variable; people reorder it by drag or keyboard, and lists sharing a group exchange items.',
  tier: 'content',
  agentEmittable: true,
  useWhen: [
    'Let people rank, reorder or move items between lists (priorities, backlog columns)',
    'Drag as data: the order is the list variable, so other nodes read it',
  ],
  dontUseWhen: [
    'A read-only list: use blocks-structure',
    'Cards between board columns with work-in-progress limits: use data-board',
  ],
  a11y: [
    'A labelled list of items, each with a drag handle button; Space or Enter picks up, arrows move, Space or Enter drops, Escape cancels',
    'Every move has a non-drag path (keyboard) and is announced politely; reduced motion disables the move animation',
  ],
  props: [
    {
      name: 'label',
      kind: 'string',
      required: true,
      trust: 'untrusted',
      description: 'Accessible name.',
    },
    {
      name: 'reorder',
      kind: 'object',
      required: true,
      description:
        'Drag as data: bind (a $state list), axis, group, accepts, locked, pull and disabled.',
      schema: { $ref: '#/$defs/reorder' },
    },
    {
      name: 'itemLabel',
      kind: 'string',
      default: 'label',
      description: 'The item field shown as each item’s text.',
    },
    { name: 'itemDetail', kind: 'string', description: 'An item field shown as secondary text.' },
  ],
  events: ['move'],
  examples: [
    {
      id: 'priorities',
      title: 'Priorities',
      props: { label: 'This week', reorder: { bind: { $state: 'priorities' }, axis: 'vertical' } },
    },
  ],
  related: ['data-board', 'blocks-structure'],
});

export const STATE_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  toggleControlManifest,
  choiceControlManifest,
  sliderControlManifest,
  filterControlManifest,
  flowViewManifest,
  flowActionManifest,
  actionFormManifest,
  formFieldManifest,
  formSubmitManifest,
  hostRegionManifest,
  sortableListManifest,
]);

/** Grammar roles for the state and action surfaces. */
export const STATE_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = /* @__PURE__ */ Object.freeze([
  { id: 'control-toggle', role: 'interactive' },
  { id: 'control-choice', role: 'interactive' },
  { id: 'control-slider', role: 'interactive' },
  { id: 'control-filter', role: 'interactive' },
  { id: 'flow-view', role: 'container' },
  { id: 'flow-action', role: 'interactive' },
  { id: 'action-form', role: 'container', landmark: 'form' },
  { id: 'form-field', role: 'interactive' },
  { id: 'form-submit', role: 'primary-action' },
  { id: 'host-region', role: 'interactive' },
  { id: 'sortable-list', role: 'interactive' },
]);
