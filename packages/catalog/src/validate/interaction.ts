/**
 * Spec 0.3.0 interaction fields in `validateDraft`: `$state` / `$data`
 * bindings, node `bind` and `on`. The checks here are the catalog-local,
 * closed-set part (declared variables, the component's `events` and
 * `bindable`, the closed action ops and their fields); the full semantic
 * rules (types, writability, flows, emit values) are `@texuli/spec`'s
 * `validateBlueprint`, which a host passes as `checkSpec`. Bindings are
 * replaced by their first-paint values so the renderer checks the props a
 * person will actually see. Never evaluates anything.
 */
import {
  checkStateSurface,
  LIST_TEXT_PATTERN,
  SURFACE_INTENT_NAME,
  surfaceInputs,
} from '@texuli/spec/surface';
import type { CatalogTreeInput, RenderCatalog } from '../render/renderer/types.ts';

/** The closed action ops and the fields each takes (mirrors spec `ACTION_FIELDS`). */
export const INTERACTION_ACTION_FIELDS: Readonly<
  Record<string, { readonly allowed: readonly string[]; readonly required: readonly string[] }>
> = Object.freeze({
  setState: { allowed: ['state', 'value', 'fromEvent'], required: ['state'] },
  toggleState: { allowed: ['state'], required: ['state'] },
  moveItem: { allowed: ['from', 'item', 'to', 'index'], required: ['from', 'item'] },
  flowGo: { allowed: ['event'], required: ['event'] },
  emit: { allowed: ['intent', 'values'], required: ['intent'] },
  submit: { allowed: [], required: [] },
});

/** Most actions one event runs (spec `SPEC_LIMITS.actionsPerEvent`). */
export const MAX_ACTIONS_PER_EVENT = 8;

export interface InteractionIssue {
  code: 'unknown-state' | 'binding' | 'unknown-event' | 'action' | 'state';
  path: string;
  message: string;
  id?: string;
}

type Bag = Record<string, unknown>;
const isBag = (value: unknown): value is Bag =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A variable's first-paint value, as the spec and the player define it. */
export function initialStateValue(declaration: unknown): unknown {
  if (!isBag(declaration)) return undefined;
  if (Object.hasOwn(declaration, 'initial')) return declaration.initial;
  switch (declaration.type) {
    case 'boolean':
      return false;
    case 'number':
      return declaration.min;
    case 'enum':
      return Array.isArray(declaration.values) ? declaration.values[0] : undefined;
    case 'string':
      return '';
    case 'list':
      return [];
    default:
      return undefined;
  }
}

function bindingOf(value: unknown): { key: '$state' | '$data'; name: unknown } | 'bad' | undefined {
  if (!isBag(value)) return undefined;
  const hasState = Object.hasOwn(value, '$state');
  const hasData = Object.hasOwn(value, '$data');
  if (!hasState && !hasData) return undefined;
  if (Object.keys(value).length !== 1) return 'bad';
  return hasState ? { key: '$state', name: value.$state } : { key: '$data', name: value.$data };
}

/** A value of the prop's kind for a `$data` prop, which only the host knows at paint time. */
function hostPlaceholder(
  kind: string | undefined,
  enumValues: readonly string[] | undefined
): unknown {
  switch (kind) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'enum':
      return enumValues?.[0];
    default:
      return undefined;
  }
}

/**
 * Check the interaction fields of a normalized tree and return a copy whose
 * props hold first-paint values (the renderer's input). `state` is the
 * envelope's declarations (none for a bare tree).
 */
export function resolveInteraction(
  draft: CatalogTreeInput | readonly CatalogTreeInput[],
  state: unknown,
  catalog: RenderCatalog,
  envelope?: unknown
): { tree: CatalogTreeInput | CatalogTreeInput[]; issues: InteractionIssue[] } {
  const issues: InteractionIssue[] = [];
  const declared: Bag = isBag(state) ? state : {};
  const report = (code: InteractionIssue['code'], path: string, message: string, id?: string) =>
    issues.push({ code, path, message, ...(id ? { id } : {}) });

  const stateValue = (name: unknown, path: string, id: string): unknown => {
    if (typeof name !== 'string' || !Object.hasOwn(declared, name)) {
      report(
        'unknown-state',
        path,
        `"${String(name).slice(0, 64)}" is not a declared state variable.`,
        id
      );
      return undefined;
    }
    return initialStateValue(declared[name]);
  };

  // Replace `$state` bindings at any depth; `$data` only as a whole top-level prop.
  const resolveValue = (value: unknown, path: string, id: string, depth: number): unknown => {
    const binding = bindingOf(value);
    if (binding === 'bad') {
      report('binding', path, 'A binding has exactly one key, "$state" or "$data".', id);
      return undefined;
    }
    if (binding?.key === '$state') return stateValue(binding.name, path, id);
    if (binding?.key === '$data') {
      report('binding', path, '"$data" binds only a whole top-level prop.', id);
      return undefined;
    }
    if (depth > 32) return value;
    if (Array.isArray(value))
      return value.map((item, i) => resolveValue(item, `${path}[${i}]`, id, depth + 1));
    if (isBag(value)) {
      const out: Bag = {};
      for (const [key, entry] of Object.entries(value)) {
        Object.defineProperty(out, key, {
          value: resolveValue(entry, `${path}.${key}`, id, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return out;
    }
    return value;
  };

  const checkActions = (actions: unknown, path: string, id: string): void => {
    if (!Array.isArray(actions) || actions.length === 0 || actions.length > MAX_ACTIONS_PER_EVENT) {
      report('action', path, `An event runs 1–${MAX_ACTIONS_PER_EVENT} actions.`, id);
      return;
    }
    actions.forEach((action, i) => {
      const here = `${path}[${i}]`;
      const op = isBag(action) ? action.op : undefined;
      const fields =
        typeof op === 'string' && Object.hasOwn(INTERACTION_ACTION_FIELDS, op)
          ? INTERACTION_ACTION_FIELDS[op]
          : undefined;
      if (!isBag(action) || !fields) {
        report(
          'action',
          `${here}.op`,
          `Actions are one of ${Object.keys(INTERACTION_ACTION_FIELDS).join(', ')}.`,
          id
        );
        return;
      }
      for (const key of Object.keys(action)) {
        if (key !== 'op' && !fields.allowed.includes(key)) {
          report('action', `${here}.${key}`, `"${op}" takes no "${key}".`, id);
        }
      }
      for (const key of fields.required) {
        if (!Object.hasOwn(action, key))
          report('action', `${here}.${key}`, `"${op}" needs "${key}".`, id);
      }
      for (const key of ['state', 'from', 'to'] as const) {
        if (Object.hasOwn(action, key)) stateValue(action[key], `${here}.${key}`, id);
      }
      if (op === 'emit' && isBag(action.values)) {
        for (const name of Object.keys(action.values)) {
          if (!SURFACE_INTENT_NAME.test(name))
            report('action', `${here}.values.${name}`, `"${name}" is not a value name.`, id);
        }
      }
    });
  };

  const visit = (node: CatalogTreeInput, path: string): CatalogTreeInput => {
    if (!isBag(node) || typeof node.id !== 'string') return node;
    const spec = catalog.get(node.id);
    const props: Bag = {};
    for (const [name, value] of Object.entries(node.props ?? {})) {
      const binding = bindingOf(value);
      const schema = spec?.props.find((prop) => prop.name === name);
      let resolved: unknown;
      if (schema?.schema?.$ref === '#/$defs/reorder' && isBag(value)) {
        // Drag as data: `reorder.bind` names the list itself, so it stays a
        // binding for the painter; only its name is checked here.
        const bound = bindingOf(value.bind);
        if (bound === undefined || bound === 'bad' || bound.key !== '$state') {
          report(
            'binding',
            `${path}.props.${name}.bind`,
            '"reorder.bind" takes a "$state" binding.',
            node.id
          );
        } else {
          stateValue(bound.name, `${path}.props.${name}.bind`, node.id);
        }
        resolved = value;
      } else if (binding !== 'bad' && binding?.key === '$data') {
        if (typeof binding.name !== 'string' || binding.name === '') {
          report('binding', `${path}.props.${name}`, '"$data" names a host data value.', node.id);
        } else if (!schema || !['string', 'number', 'boolean', 'enum'].includes(schema.kind)) {
          report(
            'binding',
            `${path}.props.${name}`,
            '"$data" binds only a string, number, boolean or enum prop.',
            node.id
          );
        }
        resolved = hostPlaceholder(schema?.kind, schema?.enumValues);
      } else {
        resolved = resolveValue(value, `${path}.props.${name}`, node.id, 0);
      }
      if (resolved !== undefined) {
        Object.defineProperty(props, name, {
          value: resolved,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
    if (node.bind !== undefined) {
      if (!isBag(node.bind)) {
        report('binding', `${path}.bind`, '"bind" maps props to "$state" bindings.', node.id);
      } else {
        for (const [name, value] of Object.entries(node.bind)) {
          const binding = bindingOf(value);
          const here = `${path}.bind.${name}`;
          if (!spec?.bindable?.includes(name)) {
            report('binding', here, `"${node.id}" cannot bind "${name}".`, node.id);
          } else if (Object.hasOwn(node.props ?? {}, name)) {
            report('binding', here, `"${name}" is bound, so it is not also set in props.`, node.id);
          } else if (binding === undefined || binding === 'bad' || binding.key !== '$state') {
            report('binding', here, '"bind" takes a "$state" binding.', node.id);
          } else {
            const initial = stateValue(binding.name, here, node.id);
            if (initial !== undefined) {
              Object.defineProperty(props, name, {
                value: initial,
                enumerable: true,
                writable: true,
                configurable: true,
              });
            }
          }
        }
      }
    }
    if (node.on !== undefined) {
      if (!isBag(node.on)) {
        report('unknown-event', `${path}.on`, '"on" maps events to actions.', node.id);
      } else {
        for (const [event, actions] of Object.entries(node.on)) {
          if (!spec?.events?.includes(event as never)) {
            report(
              'unknown-event',
              `${path}.on.${event}`,
              `"${node.id}" fires no "${event.slice(0, 32)}" event.`,
              node.id
            );
            continue;
          }
          checkActions(actions, `${path}.on.${event}`, node.id);
        }
      }
    }
    const { bind: _bind, on: _on, ...rest } = node;
    const out: CatalogTreeInput = { ...rest, props };
    if (Array.isArray(node.children)) {
      out.children = node.children.map((child, i) => visit(child, `${path}.children.${i}`));
    }
    if (node.props === undefined && Object.keys(props).length === 0)
      delete (out as { props?: unknown }).props;
    return out;
  };

  const tree = Array.isArray(draft)
    ? draft.map((root, i) => visit(root, String(i)))
    : visit(draft as CatalogTreeInput, '0');

  // List item text (spec `listText`): a draggable item never hides or reorders its text.
  for (const [name, declaration] of Object.entries(declared)) {
    if (!isBag(declaration) || declaration.type !== 'list') continue;
    const items = Array.isArray(declaration.initial) ? declaration.initial : [];
    items.forEach((item, i) => {
      if (!isBag(item)) return;
      for (const [key, field] of Object.entries(item)) {
        if (typeof field === 'string' && !LIST_TEXT.test(field)) {
          report(
            'state',
            `state.${name}.initial[${i}].${key}`,
            'Item text cannot hold control, bidirectional or invisible formatting characters.'
          );
        }
      }
    });
  }

  // The state surface's node rules (spec `checkStateSurface`, as the player
  // refuses them). An envelope carries its own state and flow; a bare tree's
  // context is its host's, which checks it at paint time.
  if (isBag(envelope)) {
    const inputs = surfaceInputs(envelope);
    const roots = Array.isArray(draft) ? draft : [draft];
    roots.forEach((root, r) => {
      for (const issue of checkStateSurface(root, inputs)) {
        const path = `${r}${issue.at.map((index) => `.children.${index}`).join('')}`;
        report(issue.code, path, issue.message);
      }
    });
  }
  return { tree, issues };
}

/** The spec's list item text rule, compiled once. */
const LIST_TEXT = new RegExp(LIST_TEXT_PATTERN, 'u');
