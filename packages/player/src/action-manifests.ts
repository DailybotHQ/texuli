import type { CatalogManifest } from '@texuli/catalog/manifest';
import type { GrammarComponentMeta } from '@texuli/catalog/render/grammar';
import { AUTOCOMPLETE_ALLOWLIST, FIELD_KINDS, FIELD_PATTERNS } from './actions.ts';

/**
 * The G17 action surface: forms whose submit is an action intent the host
 * confirms. Agent-emittable; an action reaches the host only through
 * `onAction`, never as a native submission. The manifests live in the
 * player until the catalog's forms group adopts them.
 */

const shared = { package: '@texuli/player', tier: 'content' as const, agentEmittable: true };

export const actionFormManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'action-form',
  label: 'Action form',
  summary: 'Groups fields whose submit proposes one named action intent to the host.',
  useWhen: Object.freeze([
    'Ask the host to do something with a few named values, such as a request',
  ]),
  dontUseWhen: Object.freeze(['Payment or sign-in: those are host regions']),
  a11y: Object.freeze([
    'A labelled form; invalid fields are marked and focused; the receipt is announced',
  ]),
  props: Object.freeze([
    {
      name: 'action',
      kind: 'string' as const,
      required: true,
      description: 'The action name the host receives.',
    },
    { name: 'label', kind: 'string' as const, required: true, trust: 'untrusted' as const },
    { name: 'children', kind: 'slot' as const },
  ]),
  examples: Object.freeze([
    {
      id: 'request',
      title: 'Request access',
      props: { action: 'request-access', label: 'Request access' },
    },
  ]),
  related: Object.freeze(['form-field', 'form-submit']),
}) as CatalogManifest;

export const formFieldManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'form-field',
  label: 'Form field',
  summary: 'A named, validated field bound to a declared local-state variable.',
  useWhen: Object.freeze(['Collect one value for an action']),
  dontUseWhen: Object.freeze(['Passwords, card numbers or one-time codes: never in a blueprint']),
  a11y: Object.freeze([
    'A visible label; required and invalid states are exposed; errors are linked',
  ]),
  props: Object.freeze([
    {
      name: 'name',
      kind: 'string' as const,
      required: true,
      description: 'The key in the action values.',
    },
    {
      name: 'state',
      kind: 'string' as const,
      required: true,
      description: 'The declared variable it binds.',
    },
    { name: 'label', kind: 'string' as const, required: true, trust: 'untrusted' as const },
    { name: 'kind', kind: 'enum' as const, enumValues: FIELD_KINDS, default: 'text' },
    { name: 'required', kind: 'boolean' as const },
    { name: 'autocomplete', kind: 'enum' as const, enumValues: AUTOCOMPLETE_ALLOWLIST },
    { name: 'pattern', kind: 'enum' as const, enumValues: Object.keys(FIELD_PATTERNS) },
    { name: 'minLength', kind: 'number' as const },
    { name: 'maxLength', kind: 'number' as const },
    { name: 'min', kind: 'number' as const },
    { name: 'max', kind: 'number' as const },
    { name: 'placeholder', kind: 'string' as const, trust: 'untrusted' as const },
  ]),
  examples: Object.freeze([
    {
      id: 'email',
      title: 'Email',
      props: { name: 'email', state: 'email', label: 'Email', kind: 'email', required: true },
    },
  ]),
  related: Object.freeze(['action-form']),
}) as CatalogManifest;

export const formSubmitManifest: CatalogManifest = Object.freeze({
  ...shared,
  id: 'form-submit',
  label: 'Form submit',
  summary:
    "Proposes the form's action with its fields' values; disabled while a receipt is pending.",
  useWhen: Object.freeze(['The one primary action of an action-form']),
  dontUseWhen: Object.freeze(['Navigation or local view changes: use flow-action']),
  a11y: Object.freeze(['A submit button inside the form; Enter in a field submits too']),
  props: Object.freeze([
    { name: 'label', kind: 'string' as const, required: true, trust: 'untrusted' as const },
  ]),
  examples: Object.freeze([{ id: 'send', title: 'Send', props: { label: 'Send request' } }]),
  related: Object.freeze(['action-form']),
}) as CatalogManifest;

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
