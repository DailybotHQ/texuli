/**
 * The state surface's node rules (spec 0.3.0): where the state-only nodes
 * may sit and what they must name, exactly as `@texuli/player` refuses them
 * at paint time, so a blueprint that validates always paints.
 *
 * - Forms (code `action`): `form-field` and `form-submit` sit inside an
 *   `action-form`; forms never nest; a form names an intent-like action; a
 *   field has an intent-like name, unique in its form, and writes a declared
 *   variable of its type (`number` fields a number, the others a string).
 * - Controls (code `binding`): each control names a declared variable of
 *   the type it writes.
 * - Host-bound variables (code `binding`): a variable with a `source` is the
 *   host's; no control or field writes it.
 * - Flow nodes (code `state`): `flow-view` names a declared view and
 *   `flow-action` an event some transition handles; neither appears
 *   without a flow.
 *
 * Inputs are read from the raw envelope (`surfaceInputs`) so every
 * validator applies the same rules to the same data. Framework-free; never
 * evaluates anything.
 */

/** The spec's `intentName` pattern (pinned to `SPEC_PATTERNS` by the spec tests); no imports keep this module lean. */
export const SURFACE_INTENT_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;

/** The spec's `listText` pattern (the contract's `SPEC_PATTERNS.listText` is this string). */
export const LIST_TEXT_PATTERN =
  '^[^\\u0000-\\u001f\\u007f-\\u009f\\u061c\\u180e\\u200b\\u200e\\u200f\\u202a-\\u202e\\u2060-\\u2064\\u2066-\\u2069\\ufeff]*$';

/** The state type each control writes (mirrors the catalog's `CONTROL_STATE_TYPES`). */
export const SPEC_CONTROL_STATE_TYPES: Readonly<Record<string, string>> =
  /* @__PURE__ */ Object.freeze({
    'control-toggle': 'boolean',
    'control-choice': 'enum',
    'control-slider': 'number',
    'control-filter': 'string',
  });

/** The player's issue code each spec code stands for (`action-binding` → `action`, …). */
export const SURFACE_PLAYER_CODES = /* @__PURE__ */ Object.freeze({
  'action-binding': 'action',
  'control-binding': 'binding',
  'host-binding': 'binding',
  'flow-binding': 'state',
} as const);

export type SurfaceCode = (typeof SURFACE_PLAYER_CODES)[keyof typeof SURFACE_PLAYER_CODES];

export interface SurfaceIssue {
  code: SurfaceCode;
  /** Child indices from the root: `[]` is the root, `[0, 2]` its first child's third child. */
  at: readonly number[];
  message: string;
}

export interface SurfaceInputs {
  /** Declared variables (type, and whether a node may write it); `null` without `state` or `flow`. */
  declarations: ReadonlyMap<string, { type: string; writable: boolean }> | null;
  /** The flow's views and handled events; `null` without a flow. */
  flow: { views: readonly string[]; events: readonly string[] } | null;
}

type Bag = Record<string, unknown>;
const isBag = (value: unknown): value is Bag =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

/**
 * Read the surface inputs from a raw envelope, as the player does: an
 * envelope with `state` or `flow` has declarations (empty with only a flow).
 */
export function surfaceInputs(envelope: unknown): SurfaceInputs {
  if (!isBag(envelope)) return { declarations: null, flow: null };
  const hasState = Object.hasOwn(envelope, 'state');
  const hasFlow = Object.hasOwn(envelope, 'flow');
  let declarations: Map<string, { type: string; writable: boolean }> | null = null;
  if (hasState || hasFlow) {
    declarations = new Map();
    const state = isBag(envelope.state) ? envelope.state : {};
    for (const [name, raw] of Object.entries(state)) {
      if (isBag(raw) && typeof raw.type === 'string') {
        declarations.set(name, { type: raw.type, writable: !Object.hasOwn(raw, 'source') });
      }
    }
  }
  const raw = envelope.flow;
  const flow = isBag(raw)
    ? {
        views: strings(raw.views),
        events: Array.isArray(raw.transitions)
          ? raw.transitions.flatMap((t) => (isBag(t) && typeof t.on === 'string' ? [t.on] : []))
          : [],
      }
    : null;
  return { declarations, flow };
}

/** Check one tree root against the surface rules; one issue per refused node and rule. */
export function checkStateSurface(root: unknown, inputs: SurfaceInputs): SurfaceIssue[] {
  const issues: SurfaceIssue[] = [];
  const { declarations, flow } = inputs;
  const events = new Set(flow?.events ?? []);

  function visit(node: unknown, at: readonly number[], form: Set<string> | null): void {
    if (!isBag(node) || at.length > 64) return;
    const fail = (code: SurfaceCode, message: string) => issues.push({ code, at, message });
    const id = typeof node.id === 'string' ? node.id : '';
    const props = isBag(node.props) ? node.props : {};
    let scope = form;

    // Controls.
    const wanted = Object.hasOwn(SPEC_CONTROL_STATE_TYPES, id)
      ? SPEC_CONTROL_STATE_TYPES[id]
      : undefined;
    if (wanted !== undefined) {
      const name = props.state;
      const declaration = typeof name === 'string' ? declarations?.get(name) : undefined;
      if (!declarations) {
        fail('binding', `"${id}" needs declared local state; this blueprint declares none.`);
      } else if (typeof name !== 'string' || !declaration) {
        fail('binding', `"${id}" names no declared state variable.`);
      } else if (declaration.type !== wanted) {
        fail('binding', `"${id}" writes a ${wanted}, but "${name}" is a ${declaration.type}.`);
      }
    }

    // Flow nodes.
    if (id === 'flow-view' || id === 'flow-action') {
      if (!flow) {
        fail('state', `"${id}" needs a declared flow; this blueprint declares none.`);
      } else if (
        id === 'flow-view' &&
        (typeof props.name !== 'string' || !flow.views.includes(props.name))
      ) {
        fail('state', '"flow-view" names no declared view.');
      } else if (
        id === 'flow-action' &&
        (typeof props.event !== 'string' || !events.has(props.event))
      ) {
        fail('state', '"flow-action" fires an event no transition handles.');
      }
    }

    // Forms.
    if (id === 'action-form') {
      if (form) fail('action', '"action-form" cannot nest inside another form.');
      if (typeof props.action !== 'string' || !SURFACE_INTENT_NAME.test(props.action)) {
        fail('action', '"action-form" needs an action name like "request-access".');
      }
      scope = new Set();
    } else if (id === 'form-field' || id === 'form-submit') {
      if (!form) fail('action', `"${id}" must be inside an "action-form".`);
      else if (id === 'form-field') {
        const { name, state, kind } = props;
        const declaration = typeof state === 'string' ? declarations?.get(state) : undefined;
        const type = kind === 'number' ? 'number' : 'string';
        if (typeof name !== 'string' || !SURFACE_INTENT_NAME.test(name))
          fail('action', '"form-field" needs a field name.');
        else if (form.has(name)) fail('action', `Field name "${name}" is used twice in one form.`);
        else form.add(name);
        if (!declarations)
          fail('action', '"form-field" needs declared local state; this blueprint declares none.');
        else if (!declaration) fail('action', '"form-field" names no declared state variable.');
        else if (declaration.type !== type) {
          fail(
            'action',
            `A ${String(kind ?? 'text')} field writes a ${type}, but "${String(state)}" is a ${declaration.type}.`
          );
        }
      }
    }

    // Host-bound variables are the host's to write.
    const writes = wanted !== undefined || id === 'form-field';
    if (writes && typeof props.state === 'string') {
      const declaration = declarations?.get(props.state);
      if (declaration && !declaration.writable) {
        fail('binding', `"${id}" cannot write "${props.state}": its value comes from the host.`);
      }
    }

    if (Array.isArray(node.children)) {
      for (const [index, child] of node.children.entries()) visit(child, [...at, index], scope);
    }
  }

  visit(root, [], null);
  return issues;
}
