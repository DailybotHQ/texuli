/**
 * One catalog component on a slide → the one-node blueprint the player
 * paints. The adapter adds what a single node needs around it, never what
 * the content asks for:
 *
 * - state declarations: `$state` lists the props read (empty lists), control
 *   variables (by control type), and the author's own `$declare` object
 *   (the only reserved props key; removed before the node sees its props);
 * - an `action-form` around a lone `form-field` or `form-submit`;
 * - capability gates: without `reorder` a sortable list or board paints
 *   read-only, without `workflow-edit` a workflow graph paints in view mode.
 *
 * The envelope's status is always `draft`: the stage never activates
 * anything, and the player validates it again at the host's tier.
 */
import type { SlideCapability } from './catalog-ids.ts';

type Bag = Record<string, unknown>;

/** The props key an author may use to declare state for a component (removed before paint). */
export const DECLARE_KEY = '$declare';

/** Capabilities a host grants; everything off by default except local `reorder`. */
export interface SlideCapabilities {
  /** Reorder sortable lists and move board cards (local state only). Default true. */
  reorder?: boolean;
  /** Edit a `workflow-graph` (mode `edit`). Default false. */
  workflowEdit?: boolean;
  /** Mount `embed-app` blocks. Default false: embeds paint their safe start card. */
  embeds?: boolean;
}

function isBag(value: unknown): value is Bag {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** True when a host capability is granted. */
export function hasCapability(
  capabilities: SlideCapabilities,
  capability: SlideCapability
): boolean {
  switch (capability) {
    case 'reorder':
      return capabilities.reorder !== false;
    case 'workflow-edit':
      return capabilities.workflowEdit === true;
    case 'embeds':
      return capabilities.embeds === true;
    case 'actions':
      return false;
  }
}

/** Every `{"$state": name}` read in a value (bounded walk). */
export function stateReads(value: unknown, out = new Set<string>(), depth = 0): Set<string> {
  if (depth > 16 || out.size > 32) return out;
  if (Array.isArray(value)) {
    for (const item of value) stateReads(item, out, depth + 1);
  } else if (isBag(value)) {
    if (typeof value.$state === 'string') out.add(value.$state);
    for (const [key, item] of Object.entries(value)) {
      if (key !== '$state') stateReads(item, out, depth + 1);
    }
  }
  return out;
}

/** The enum values of a `control-choice` `options` list: unique, non-empty strings. */
export function choiceValues(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  const values: string[] = [];
  for (const option of options.slice(0, 64)) {
    const value = typeof option === 'string' ? option : isBag(option) ? option.value : undefined;
    if (typeof value === 'string' && value.trim() !== '' && !values.includes(value)) {
      values.push(value);
    }
  }
  return values;
}

const CONTROL_STATE: Readonly<Record<string, (props: Bag) => Bag | undefined>> = Object.freeze({
  'control-toggle': () => ({ type: 'boolean' }),
  'control-slider': () => ({ type: 'number', min: 0, max: 100 }),
  'control-filter': () => ({ type: 'string' }),
  // A choice takes its values from `options` (strings, or objects with a
  // `value`); without them the author declares the enum with `$declare`.
  'control-choice': (props) => {
    const values = choiceValues(props.options);
    return values.length > 0 ? { type: 'enum', values, initial: values[0] } : undefined;
  },
  'form-field': (props) =>
    props.kind === 'number' ? { type: 'number', min: 0, max: 1_000_000 } : { type: 'string' },
});

export interface ComponentNode {
  id: string;
  props: Bag;
}

/** The node props as the player sees them, with the capability gates applied. */
export function gatedProps(id: string, props: Bag, capabilities: SlideCapabilities): Bag {
  const out: Bag = { ...props };
  delete out[DECLARE_KEY];
  // `options` feed the declared enum; the choice control reads its values from there.
  if (id === 'control-choice') delete out.options;
  if (id === 'sortable-list' && !hasCapability(capabilities, 'reorder') && isBag(out.reorder)) {
    out.reorder = { ...out.reorder, disabled: true };
  }
  if (id === 'data-board' && !hasCapability(capabilities, 'reorder')) delete out.bind;
  if (
    id === 'workflow-graph' &&
    out.mode === 'edit' &&
    !hasCapability(capabilities, 'workflow-edit')
  ) {
    out.mode = 'view';
    delete out.bind;
  }
  return out;
}

/** State declarations for one node: inferred ones, then the author's `$declare` on top. */
export function componentState(id: string, props: Bag): Bag {
  const state: Bag = {};
  for (const name of stateReads(props)) state[name] = { type: 'list', initial: [] };
  const control = CONTROL_STATE[id];
  if (control && typeof props.state === 'string') {
    const declaration = control(props);
    if (declaration) state[props.state] = declaration;
  }
  const declared = props[DECLARE_KEY];
  if (isBag(declared)) Object.assign(state, declared);
  return state;
}

/** The one-node blueprint envelope for a slide component. */
export function componentBlueprint(node: ComponentNode, capabilities: SlideCapabilities = {}): Bag {
  const props = gatedProps(node.id, node.props, capabilities);
  const state = componentState(node.id, node.props);
  let tree: Bag = { id: node.id, props };
  if (node.id === 'form-field' || node.id === 'form-submit') {
    const label = typeof props.label === 'string' && props.label.trim() ? props.label : 'Form';
    tree = { id: 'action-form', props: { action: 'slide-form', label }, children: [tree] };
  }
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: `slide-${node.id}`,
    catalog: '0'.repeat(64),
    status: 'draft',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    generator: { kind: 'tool', name: 'texuli-slides' },
    ...(Object.keys(state).length > 0 ? { state } : {}),
    // The player paints frames: an untitled document frame holds the one
    // node. With no title it adds no heading, so the component contributes
    // only its own content to the slide's outline.
    tree: { id: 'layout-doc', props: {}, children: [tree] },
  };
}
