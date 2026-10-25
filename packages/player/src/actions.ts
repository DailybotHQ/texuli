import { ENVELOPE_FORMAT } from '@texuli/catalog/envelope';
import type { StateDeclarations, StateIssue, StateValue } from './state/schema.ts';

/**
 * The action surface (audit G17, player design Phase 4): an `action-form`
 * groups `form-field`s bound to local state; its `form-submit` proposes one
 * **action intent** carrying the fields' named values as plain scalars. The
 * host decides (`onAction`), and the player shows the **receipt**: pending,
 * confirmed, rejected or failed. Nothing is sent anywhere by the player
 * itself; without `onAction` an action is unavailable.
 */

/** A field, form or action name: a letter, then letters, digits, `_` or `-`, at most 64. */
export const ACTION_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
/** Most fields one action may carry. */
export const MAX_ACTION_FIELDS = 32;
/** Longest string value an action may carry (the frame payload cap). */
export const MAX_ACTION_VALUE_LENGTH = 2048;

export const FIELD_KINDS = ['text', 'email', 'tel', 'number', 'multiline'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/**
 * `autocomplete` tokens a field may use. Payment (`cc-*`), credential
 * (`current-password`, `new-password`, `username` pairs) and one-time-code
 * tokens are deliberately absent: a blueprint can never ask the browser to
 * fill them.
 */
export const AUTOCOMPLETE_ALLOWLIST = Object.freeze([
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

/** Closed validation patterns by id; a blueprint never supplies a regular expression. */
export const FIELD_PATTERNS: Readonly<Record<string, RegExp>> = Object.freeze({
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[0-9 ()-]{6,20}$/,
  'postal-code': /^[A-Za-z0-9 -]{3,10}$/,
  digits: /^[0-9]+$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
});

export type ActionStatus = 'pending' | 'confirmed' | 'rejected' | 'failed' | 'unavailable';

/** What the host receives: the form's action and its fields' named scalar values. */
export interface ActionIntent {
  id: string;
  action: string;
  values: Readonly<Record<string, string | number | boolean>>;
}

/** How a host answers an action intent. */
export type ActionResult = 'confirmed' | 'rejected';

export type ActionHandler = (intent: ActionIntent) => ActionResult | Promise<ActionResult>;

export interface FieldRules {
  label: string;
  kind: FieldKind;
  required?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface FieldMessages {
  fieldRequired: string;
  fieldPattern: string;
  fieldLength: string;
  fieldRange: string;
}

function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (slot, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : slot
  );
}

/** The error message for a field value, or `null` when it is valid. */
export function validateFieldValue(
  rules: FieldRules,
  value: StateValue | undefined,
  messages: FieldMessages
): string | null {
  const label = rules.label;
  const empty =
    value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value));
  if (empty) return rules.required ? format(messages.fieldRequired, { label }) : null;
  if (rules.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value))
      return format(messages.fieldPattern, { label });
    const min = rules.min ?? Number.NEGATIVE_INFINITY;
    const max = rules.max ?? Number.POSITIVE_INFINITY;
    if (value < min || value > max) {
      return format(messages.fieldRange, { label, min: rules.min ?? '', max: rules.max ?? '' });
    }
    return null;
  }
  const text = String(value);
  if (
    (rules.minLength !== undefined && text.length < rules.minLength) ||
    (rules.maxLength !== undefined && text.length > rules.maxLength)
  ) {
    return format(messages.fieldLength, {
      label,
      min: rules.minLength ?? 0,
      max: rules.maxLength ?? MAX_ACTION_VALUE_LENGTH,
    });
  }
  const pattern =
    rules.pattern ??
    (rules.kind === 'email' ? 'email' : rules.kind === 'tel' ? 'phone' : undefined);
  if (pattern && FIELD_PATTERNS[pattern] && !FIELD_PATTERNS[pattern].test(text)) {
    return format(messages.fieldPattern, { label });
  }
  return null;
}

/**
 * Build the intent's values: plain scalars only, strings capped at the frame
 * payload limit, at most {@link MAX_ACTION_FIELDS} names. `null` when the
 * set breaks a limit (the action is then not proposed).
 */
export function actionValues(
  entries: ReadonlyArray<readonly [string, StateValue | undefined]>
): Record<string, string | number | boolean> | null {
  if (entries.length > MAX_ACTION_FIELDS) return null;
  const values: Record<string, string | number | boolean> = {};
  for (const [name, value] of entries) {
    if (!ACTION_NAME.test(name) || Object.hasOwn(values, name)) return null;
    if (value === undefined) continue;
    if (typeof value === 'string' && value.length > MAX_ACTION_VALUE_LENGTH) return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    Object.defineProperty(values, name, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return values;
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check the action nodes against the declared state: forms carry a valid
 * `action` name and do not nest; fields and submits sit inside a form;
 * every field binds a declared variable of the right type (number fields a
 * `number`, the others a `string`) under a name unique in its form. Never throws.
 */
export function checkActionNodes(
  blueprint: unknown,
  declarations: StateDeclarations | null
): StateIssue[] {
  const issues: StateIssue[] = [];
  const fail = (path: string, message: string) =>
    issues.push({ code: 'action-binding', path, message });
  const tree =
    isBag(blueprint) && blueprint.format === ENVELOPE_FORMAT ? blueprint.tree : blueprint;

  function visit(node: unknown, path: string, depth: number, form: Set<string> | null): void {
    if (!isBag(node) || depth > 64) return;
    const props = isBag(node.props) ? node.props : {};
    let scope = form;
    if (node.id === 'action-form') {
      if (form) fail(path, '"action-form" cannot nest inside another form.');
      if (typeof props.action !== 'string' || !ACTION_NAME.test(props.action)) {
        fail(path, '"action-form" needs an action name like "request-access".');
      }
      scope = new Set();
    } else if (node.id === 'form-field' || node.id === 'form-submit') {
      if (!form) fail(path, `"${node.id}" must be inside an "action-form".`);
      else if (node.id === 'form-field') {
        const { name, state, kind } = props;
        const declaration =
          typeof state === 'string' && declarations && Object.hasOwn(declarations, state)
            ? declarations[state]
            : undefined;
        const wanted = kind === 'number' ? 'number' : 'string';
        if (typeof name !== 'string' || !ACTION_NAME.test(name))
          fail(path, '"form-field" needs a field name.');
        else if (form.has(name)) fail(path, `Field name "${name}" is used twice in one form.`);
        else form.add(name);
        if (!declarations)
          fail(path, '"form-field" needs declared local state; this blueprint declares none.');
        else if (!declaration) fail(path, '"form-field" names no declared state variable.');
        else if (declaration.type !== wanted) {
          fail(
            path,
            `A ${String(kind ?? 'text')} field writes a ${wanted}, but "${String(state)}" is a ${declaration.type}.`
          );
        }
      }
    }
    if (Array.isArray(node.children)) {
      for (const [index, child] of node.children.entries()) {
        visit(child, `${path}.children.${index}`, depth + 1, scope);
      }
    }
  }

  if (Array.isArray(tree)) {
    for (const [index, node] of tree.entries()) visit(node, String(index), 0, null);
  } else visit(tree, '0', 0, null);
  return issues;
}

/**
 * Run one action intent through the host's handler and resolve to its
 * receipt status. A handler that throws or answers anything else fails;
 * without a handler the action is unavailable.
 */
export async function runAction(
  handler: ActionHandler | undefined,
  intent: ActionIntent
): Promise<Exclude<ActionStatus, 'pending'>> {
  if (!handler) return 'unavailable';
  try {
    const result = await handler(intent);
    return result === 'confirmed' || result === 'rejected' ? result : 'failed';
  } catch {
    return 'failed';
  }
}
