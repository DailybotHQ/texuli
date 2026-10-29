import type { SpecPropSchema } from '../generated/typescript/catalog-schema.ts';
import type {
  SpecDiagnostic,
  SpecDiagnosticCode,
  SpecValidation,
  SpecWarning,
} from '../generated/typescript/diagnostics.ts';
import type { SpecCatalog, SpecComponent, SpecProp } from './catalog.ts';
import {
  ACTION_FIELDS,
  contractRoot,
  DATA_BINDING_KEY,
  SPEC_ACTION_OPS,
  SPEC_LIMITS,
  SPEC_REGEX,
  SPEC_STATE_TYPES,
  type SpecActionOp,
  type SpecStateType,
  STATE_BINDING_KEY,
  STATE_FIELDS,
  toDialectSchema,
} from './contract.ts';
import { isRecord, type Schema, type SchemaIssue, validateInstance } from './dialect.ts';
import {
  checkSourceBinding,
  isSourceBinding,
  SOURCE_BINDING_KEY,
  type SpecSourceDescriptor,
} from './source.ts';
import { checkStateSurface, surfaceInputs } from './surface.ts';

export type { SpecDiagnostic, SpecDiagnosticCode, SpecValidation, SpecWarning };

/**
 * Checks one workflow graph against the workflow schema:
 * `validateWorkflowGraph` from `@texuli/spec/workflow`. The root never
 * imports it, so blueprints without workflows do not pay for it.
 */
export type WorkflowGraphValidator = (graph: unknown, workflowSchema: Schema) => SpecValidation;

export interface SpecDocuments {
  blueprintSchema: Schema;
  catalog: SpecCatalog;
  /**
   * `schemas/workflow.schema.json`. Workflow state and `workflowGraph` props
   * need it and {@link SpecDocuments.validateWorkflowGraph}; without both
   * they fail closed (`state`, `prop-type`).
   */
  workflowSchema?: Schema;
  /** `validateWorkflowGraph` from `@texuli/spec/workflow`, for hosts that render workflows. */
  validateWorkflowGraph?: WorkflowGraphValidator;
  /**
   * The host's data sources (spec 0.8.0), as `registry.describe()` from
   * `@texuli/core/data-source` returns them. A `$source` binding is checked
   * against them; without them every binding is refused (`source`).
   */
  sources?: readonly SpecSourceDescriptor[];
}

/** The workflow schema and its validator, when the host supplied both. */
export interface WorkflowSupport {
  schema: Schema;
  validate: WorkflowGraphValidator;
}

/** One declared variable with its defaults applied; `valid: false` when its declaration was refused. */
export interface SpecStateVariable {
  type: SpecStateType;
  valid: boolean;
  /** The first-paint value (the declared `initial` or the type's default). */
  initial: unknown;
  /** No `source`: the blueprint may write it. */
  writable: boolean;
  values?: readonly string[];
  min?: number;
  max?: number;
  maxLength?: number;
  maxItems?: number;
}

/** The declared flow, as the validator reads it. */
export interface SpecFlowInfo {
  views: readonly string[];
  events: ReadonlySet<string>;
}

export interface TreeOptions {
  portable?: boolean;
  path?: string;
  /** Declared variables by name (from {@link checkStateDeclarations}). Without it, every `$state` is unknown. */
  state?: ReadonlyMap<string, SpecStateVariable>;
  /** The declared flow, or `null`/omitted when none. */
  flow?: SpecFlowInfo | null;
  /** The root property schemas resolve against ({@link contractRoot}). */
  root?: Schema;
  /** Receives advisory findings (`deprecated`). */
  warnings?: SpecWarning[];
  /** Checks `workflowGraph` positions; without it they fail closed. */
  workflow?: WorkflowSupport;
  /** The host's data sources; without them `$source` bindings fail closed. */
  sources?: readonly SpecSourceDescriptor[];
}

const MAX_TREE_DEPTH = 64;
const ACTION_KEYS = new Set(Object.values(ACTION_FIELDS).flatMap((f) => f.allowed));
const STATE_KEYS = new Set(Object.values(STATE_FIELDS).flat());
const FORM_ID = 'action-form';
const BINDING_SHAPE = 'A binding is exactly {"$state": name} or {"$data": name}.';

/**
 * Validate a blueprint envelope against the spec alone: the envelope schema,
 * the declared state and flow, then every node against the catalog
 * vocabulary (closed ids, closed prop names, prop kinds and enum values,
 * property schemas, required props, no platform-extension props from data,
 * a `slot` that names a slot prop of the parent, bindings, two-way `bind`,
 * `on` events and their closed actions) and the declared profile. A `when`
 * condition is checked for shape only; the runtime formula parser checks
 * its operands. With `catalogHash`, an envelope bound to another catalog is
 * refused. Deprecated components and props add `warnings` (never failing).
 * This is the shared, target-neutral contract; URL policy, limits, grammar
 * and rendering stay in the runtime validators (`@texuli/catalog/validate`).
 */
export function validateBlueprint(
  input: unknown,
  documents: SpecDocuments,
  options: { catalogHash?: string } = {}
): SpecValidation {
  const diagnostics: SpecDiagnostic[] = validateInstance(documents.blueprintSchema, input).map(
    (issue) => ({ code: 'schema', path: issue.path, message: `${issue.code}: ${issue.message}` })
  );
  if (!isRecord(input)) return { ok: false, diagnostics };

  if (options.catalogHash !== undefined && input.catalog !== options.catalogHash) {
    diagnostics.push({
      code: 'catalog-mismatch',
      path: '$.catalog',
      message: 'The blueprint is bound to another catalog.',
    });
  }
  const { workflowSchema: schema, validateWorkflowGraph: validate } = documents;
  const workflow = schema && validate ? { schema, validate } : undefined;
  const state = checkStateDeclarations(input.state, diagnostics, workflow);
  const flow = checkFlow(input.flow, diagnostics);
  const warnings: SpecWarning[] = [];
  const portable = input.profile === 'portable';
  if (isRecord(input.tree)) {
    // The state surface's node rules, as the player refuses them at paint time.
    for (const issue of checkStateSurface(input.tree, surfaceInputs(input))) {
      diagnostics.push({
        code: issue.code,
        path: `$.tree${issue.at.map((index) => `.children[${index}]`).join('')}`,
        message: issue.message,
      });
    }
    diagnostics.push(
      ...validateTree(input.tree, documents.catalog, {
        portable,
        path: '$.tree',
        state,
        flow,
        root: contractRoot(documents.blueprintSchema, workflow?.schema),
        workflow,
        warnings,
        ...(documents.sources ? { sources: documents.sources } : {}),
      })
    );
  }
  return {
    ok: diagnostics.length === 0,
    diagnostics,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// ---------------------------------------------------------------------------
// State and flow

/**
 * Read the envelope's `state` (code `state`): at most 64 variables, safe
 * names, the fields each type takes, and an initial value of the declared
 * type. One diagnostic per refused declaration; a refused declaration stays
 * declared (so bindings to it are not also `unknown-state`). Shape problems
 * the schema reports are not repeated.
 */
export function checkStateDeclarations(
  input: unknown,
  out: SpecDiagnostic[],
  workflow?: WorkflowSupport
): Map<string, SpecStateVariable> {
  const declared = new Map<string, SpecStateVariable>();
  if (!isRecord(input)) return declared;
  const names = Object.keys(input);
  if (names.length > SPEC_LIMITS.stateVars) {
    out.push({
      code: 'state',
      path: '$.state',
      message: `At most ${SPEC_LIMITS.stateVars} state variables (got ${names.length}).`,
    });
  }
  for (const name of names) {
    const path = `$.state.${name}`;
    if (!SPEC_REGEX.stateName.test(name)) {
      out.push({
        code: 'state',
        path,
        message: `"${name}" is not a valid state name.`,
      });
      continue;
    }
    const raw = input[name];
    if (!isRecord(raw) || !(SPEC_STATE_TYPES as readonly unknown[]).includes(raw.type)) continue;
    const variable = readDeclaration(name, raw, path, out, workflow);
    declared.set(name, variable);
  }
  return declared;
}

function readDeclaration(
  name: string,
  raw: Record<string, unknown>,
  path: string,
  out: SpecDiagnostic[],
  workflow: WorkflowSupport | undefined
): SpecStateVariable {
  const type = raw.type as SpecStateType;
  const writable = raw.source === undefined;
  const refuse = (where: string, message: string): SpecStateVariable => {
    out.push({ code: 'state', path: where, message });
    return { type, valid: false, initial: undefined, writable };
  };
  const accept = (initial: unknown, bounds?: Partial<SpecStateVariable>): SpecStateVariable => ({
    type,
    valid: true,
    initial,
    writable,
    ...bounds,
  });
  // Unknown keys are the schema's to report; only fields of another type are judged here.
  const extra = Object.keys(raw).find(
    (key) => STATE_KEYS.has(key) && !STATE_FIELDS[type].includes(key)
  );
  if (extra !== undefined)
    return refuse(`${path}.${extra}`, `A ${type} variable takes no "${extra}".`);
  const has = (key: string) => Object.hasOwn(raw, key);
  switch (type) {
    case 'boolean': {
      const initial = has('initial') ? raw.initial : false;
      if (typeof initial !== 'boolean')
        return refuse(`${path}.initial`, `"${name}" needs a boolean.`);
      return accept(initial);
    }
    case 'number': {
      const { min, max } = raw;
      if (!finite(min) || !finite(max) || min > max) {
        return refuse(path, `"${name}" needs finite min ≤ max.`);
      }
      const initial = has('initial') ? raw.initial : min;
      if (!finite(initial) || initial < min || initial > max) {
        return refuse(`${path}.initial`, `"${name}" initial must be between ${min} and ${max}.`);
      }
      return accept(initial, { min, max });
    }
    case 'enum': {
      const values = raw.values;
      if (!Array.isArray(values)) return refuse(path, `"${name}" needs values.`);
      if (new Set(values).size !== values.length) {
        return refuse(`${path}.values`, `"${name}" values must be distinct.`);
      }
      const initial = has('initial') ? raw.initial : values[0];
      if (typeof initial !== 'string' || !values.includes(initial)) {
        return refuse(`${path}.initial`, `"${name}" initial must be one of its values.`);
      }
      return accept(initial, { values: values as string[] });
    }
    case 'string': {
      const maxLength = has('maxLength')
        ? (raw.maxLength as number)
        : SPEC_LIMITS.defaultStringLength;
      const initial = has('initial') ? raw.initial : '';
      if (typeof initial !== 'string' || initial.length > maxLength) {
        return refuse(
          `${path}.initial`,
          `"${name}" initial must be a string of at most ${maxLength}.`
        );
      }
      return accept(initial, { maxLength });
    }
    case 'list': {
      const maxItems = has('maxItems') ? (raw.maxItems as number) : SPEC_LIMITS.listItems;
      const initial = has('initial') ? raw.initial : [];
      const problem = listProblem(initial, maxItems);
      if (problem) return refuse(`${path}.initial${problem.at}`, problem.message);
      return accept(initial, { maxItems });
    }
    case 'workflow': {
      if (!has('initial')) return refuse(path, `"${name}" needs an initial workflow graph.`);
      if (!workflow) {
        return refuse(`${path}.initial`, 'Workflow state needs the workflow schema and validator.');
      }
      const result = workflow.validate(raw.initial, workflow.schema);
      for (const d of result.diagnostics) {
        out.push({ ...d, path: `${path}.initial${d.path.slice(1)}` });
      }
      return { type, valid: result.ok, initial: raw.initial, writable };
    }
  }
}

/**
 * A list value: at most `maxItems` items, each `{ id, ...fields }` with a
 * unique item key and at most 16 scalar fields (string ≤ 1000, finite
 * number, boolean) named like state variables. Strings follow the
 * `listText` rule: a draggable item's text never hides or reorders itself.
 */
export function listProblem(
  value: unknown,
  maxItems: number
): { at: string; message: string } | null {
  if (!Array.isArray(value)) return { at: '', message: 'A list value is an array of items.' };
  if (value.length > maxItems) return { at: '', message: `At most ${maxItems} items.` };
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    const at = `[${index}]`;
    if (!isRecord(item) || typeof item.id !== 'string' || !SPEC_REGEX.itemKey.test(item.id)) {
      return { at, message: 'An item is an object with an item key "id".' };
    }
    if (ids.has(item.id)) return { at: `${at}.id`, message: `Item "${item.id}" appears twice.` };
    ids.add(item.id);
    const fields = Object.keys(item).filter((key) => key !== 'id');
    if (fields.length > SPEC_LIMITS.listItemFields) {
      return { at, message: `At most ${SPEC_LIMITS.listItemFields} fields besides "id".` };
    }
    for (const key of fields) {
      const field = item[key];
      const ok =
        SPEC_REGEX.stateName.test(key) &&
        (typeof field === 'boolean' ||
          finite(field) ||
          (typeof field === 'string' && field.length <= SPEC_LIMITS.stringLength));
      if (!ok) {
        return {
          at: `${at}.${key}`,
          message: 'Item fields are named scalars (strings of at most 1000).',
        };
      }
      if (typeof field === 'string' && !SPEC_REGEX.listText.test(field)) {
        return {
          at: `${at}.${key}`,
          message:
            'Item text cannot hold control, bidirectional or invisible formatting characters.',
        };
      }
    }
  }
  return null;
}

/**
 * Read the envelope's `flow` (code `state`): distinct views, an initial and
 * transitions that name declared views (or `*` as a source).
 */
export function checkFlow(input: unknown, out: SpecDiagnostic[]): SpecFlowInfo | null {
  if (!isRecord(input) || !Array.isArray(input.views)) return null;
  const views = input.views.filter((view): view is string => typeof view === 'string');
  const fail = (path: string, message: string) => out.push({ code: 'state', path, message });
  if (new Set(views).size !== views.length) fail('$.flow.views', 'Flow views must be distinct.');
  if (input.initial !== undefined && !views.includes(input.initial as string)) {
    fail('$.flow.initial', 'flow.initial must be one of the declared views.');
  }
  const events = new Set<string>();
  if (Array.isArray(input.transitions)) {
    input.transitions.forEach((transition, index) => {
      if (!isRecord(transition)) return;
      const path = `$.flow.transitions[${index}]`;
      const { from, to, on } = transition;
      if (typeof from === 'string' && from !== '*' && !views.includes(from)) {
        fail(`${path}.from`, 'from must be a declared view or "*".');
      }
      if (typeof to === 'string' && !views.includes(to))
        fail(`${path}.to`, 'to must be a declared view.');
      if (typeof on === 'string') events.add(on);
    });
  }
  return { views, events };
}

// ---------------------------------------------------------------------------
// The tree

interface NodeContext {
  id: string;
  state: ReadonlyMap<string, SpecStateVariable>;
  flow: SpecFlowInfo | null;
  root: Schema;
  insideForm: boolean;
  out: SpecDiagnostic[];
  workflow: WorkflowSupport | undefined;
  sources: readonly SpecSourceDescriptor[] | undefined;
  /** Reports a diagnostic on this node into `out`. */
  fail(code: SpecDiagnosticCode, path: string, message: string): void;
}

/** A context reporting into `out`. */
function reportInto(context: Omit<NodeContext, 'fail'>): NodeContext {
  return {
    ...context,
    fail: (code, path, message) => context.out.push({ code, path, id: context.id, message }),
  };
}

/** Check one catalog tree against the vocabulary. See {@link validateBlueprint}. */
export function validateTree(
  tree: unknown,
  catalog: SpecCatalog,
  options: TreeOptions = {}
): SpecDiagnostic[] {
  const byId = new Map<string, SpecComponent>(catalog.components.map((c) => [c.id, c]));
  const out: SpecDiagnostic[] = [];
  const state = options.state ?? new Map<string, SpecStateVariable>();
  const flow = options.flow ?? null;
  const root = options.root ?? { $defs: {} };
  const warn = (warning: SpecWarning) => options.warnings?.push(warning);
  // Spec 0.7.0 (ADR-014): a node key is unique in its tree; the schema checks its pattern.
  const keys = new Set<string>();
  const visit = (
    node: unknown,
    path: string,
    depth: number,
    parent: SpecComponent | null | undefined,
    insideForm: boolean
  ): void => {
    if (!isRecord(node) || typeof node.id !== 'string' || depth > MAX_TREE_DEPTH) return;
    if (typeof node.key === 'string' && SPEC_REGEX.nodeKey.test(node.key)) {
      if (keys.has(node.key)) {
        out.push({
          code: 'duplicate-key',
          path: `${path}.key`,
          id: node.id,
          message: `The key "${node.key.slice(0, 64)}" is already used in this tree.`,
        });
      }
      keys.add(node.key);
    }
    checkSlot(node.slot, parent, node.id, path, out);
    const component = byId.get(node.id);
    const context = reportInto({
      id: node.id,
      state,
      flow,
      root,
      insideForm,
      out,
      workflow: options.workflow,
      sources: options.sources,
    });
    if (!component) {
      context.fail('unknown-id', `${path}.id`, `"${node.id}" is not in the catalog.`);
    } else {
      if (options.portable && component.capability !== 'portable-core') {
        context.fail(
          'unsupported-profile',
          path,
          `"${node.id}" is ${component.capability}, not portable core.`
        );
      }
      const props = isRecord(node.props) ? node.props : {};
      const bind = isRecord(node.bind) ? node.bind : {};
      checkProps(props, bind, component, `${path}.props`, context);
      checkBind(bind, props, component, `${path}.bind`, context);
      if (isRecord(node.on)) checkOn(node.on, component, `${path}.on`, context);
      if (component.deprecated) {
        warn(deprecation(`${path}.id`, node.id, `"${node.id}"`, component.deprecated));
      }
      for (const prop of component.props) {
        if (!prop.deprecated) continue;
        const where = Object.hasOwn(props, prop.name)
          ? `${path}.props.${prop.name}`
          : Object.hasOwn(bind, prop.name)
            ? `${path}.bind.${prop.name}`
            : undefined;
        if (where) warn(deprecation(where, node.id, `"${prop.name}"`, prop.deprecated));
      }
    }
    if (Array.isArray(node.children)) {
      const inside = insideForm || node.id === FORM_ID;
      node.children.forEach((child, index) => {
        visit(child, `${path}.children[${index}]`, depth + 1, component, inside);
      });
    }
  };
  visit(tree, options.path ?? '$', 0, null, false);
  return out;
}

function deprecation(
  path: string,
  id: string,
  what: string,
  info: { since: string; replacement?: string }
): SpecWarning {
  const instead = info.replacement ? `; use "${info.replacement}"` : '';
  return {
    code: 'deprecated',
    path,
    id,
    message: `${what} is deprecated since ${info.since}${instead}.`,
  };
}

/**
 * A node's `slot` (audit G04) must name a slot prop of its parent; omitted
 * or `children` is the default slot. A root fills no slot. An unknown
 * parent was already reported, so its children's slots are not judged.
 */
function checkSlot(
  slot: unknown,
  parent: SpecComponent | null | undefined,
  id: string,
  path: string,
  out: SpecDiagnostic[]
): void {
  if (slot === undefined || slot === 'children' || parent === undefined) return;
  const named =
    parent !== null &&
    typeof slot === 'string' &&
    parent.props.some((prop) => prop.kind === 'slot' && prop.name === slot);
  if (named) return;
  out.push({
    code: 'unknown-slot',
    path: `${path}.slot`,
    id,
    message:
      parent === null
        ? 'A root node fills no slot.'
        : `"${String(slot)}" is not a slot of "${parent.id}".`,
  });
}

function kindProblem(prop: SpecProp, value: unknown): 'prop-type' | 'enum-value' | null {
  const kindOk =
    prop.kind === 'string' || prop.kind === 'enum'
      ? typeof value === 'string'
      : prop.kind === 'number'
        ? finite(value)
        : prop.kind === 'boolean'
          ? typeof value === 'boolean'
          : prop.kind === 'array'
            ? Array.isArray(value)
            : prop.kind === 'object'
              ? isRecord(value)
              : false;
  if (!kindOk) return 'prop-type';
  if (prop.kind === 'enum' && !(prop.enumValues ?? []).includes(value as string)) {
    return 'enum-value';
  }
  return null;
}

/** Whether a value reads as a binding (`$state` or `$data` as an own key). */
function isBindingShaped(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    (Object.hasOwn(value, STATE_BINDING_KEY) || Object.hasOwn(value, DATA_BINDING_KEY))
  );
}

/** The binding's key and name when it has exactly one key with a string name. */
function bindingTarget(value: Record<string, unknown>): { key: string; name: string } | null {
  const keys = Object.keys(value);
  const key = keys[0];
  if (keys.length !== 1 || (key !== STATE_BINDING_KEY && key !== DATA_BINDING_KEY)) return null;
  const name = value[key];
  return typeof name === 'string' ? { key, name } : null;
}

function checkProps(
  given: Record<string, unknown>,
  bind: Record<string, unknown>,
  component: SpecComponent,
  path: string,
  context: NodeContext
): void {
  const { id, fail } = context;
  const declared = new Map(component.props.map((p) => [p.name, p]));
  for (const [name, value] of Object.entries(given)) {
    const here = `${path}.${name}`;
    const prop = declared.get(name);
    if (!prop) {
      fail('unknown-prop', here, `"${id}" has no "${name}" prop.`);
      continue;
    }
    if (prop.extension) {
      fail(
        'extension-prop',
        here,
        `"${name}" is a ${prop.extension} extension (${prop.kind}) and cannot come from data.`
      );
      continue;
    }
    if (isSourceBinding(value)) {
      checkPropSource(value, prop, component, here, context);
      continue;
    }
    if (isBindingShaped(value)) {
      checkPropBinding(value, prop, here, context);
      continue;
    }
    const problem = kindProblem(prop, value);
    if (problem === 'prop-type') {
      fail('prop-type', here, `"${name}" must be ${prop.kind}.`);
    } else if (problem === 'enum-value') {
      fail('enum-value', here, `"${name}" must be one of ${(prop.enumValues ?? []).join(', ')}.`);
    } else if (prop.schema && (prop.kind === 'array' || prop.kind === 'object')) {
      checkPropSchemaValue(prop.name, prop.schema, value, here, context);
    } else if (prop.kind === 'array' || prop.kind === 'object') {
      walkOpaque(value, here, 0, context);
    }
  }
  for (const prop of component.props) {
    const given_ = Object.hasOwn(given, prop.name) || Object.hasOwn(bind, prop.name);
    if (prop.required && !prop.extension && !given_) {
      fail('missing-required', `${path}.${prop.name}`, `"${id}" needs "${prop.name}".`);
    }
  }
}

/**
 * A whole prop read from a host data source (spec 0.8.0): a sourceable prop,
 * the closed `$defs.sourceBinding` shape, then the binding against the
 * host's sources (fail closed without them).
 */
function checkPropSource(
  value: Record<string, unknown>,
  prop: SpecProp,
  component: SpecComponent,
  path: string,
  context: NodeContext
): void {
  const fail = (code: SpecDiagnosticCode, at: string, message: string) =>
    context.fail(code, `${path}${at}`, message);
  if (!(component.sourceable ?? []).includes(prop.name)) {
    fail('source', '', `"${prop.name}" of "${component.id}" cannot read a data source.`);
    return;
  }
  const shape = context.root.$defs?.sourceBinding;
  if (!shape) {
    fail('source', '', 'The blueprint schema has no data-source binding.');
    return;
  }
  const issues = validateInstance(shape, value, context.root);
  const first = issues[0];
  if (first) {
    fail('source', first.path.slice(1), `A data-source binding is ${SHAPE_HINT}: ${first.message}`);
    return;
  }
  const itemSchema = prop.schema?.items;
  const itemFields = itemSchema?.properties ? Object.keys(itemSchema.properties) : undefined;
  for (const issue of checkSourceBinding(value, {
    ...(context.sources ? { sources: context.sources } : {}),
    ...(itemFields ? { itemFields } : {}),
  })) {
    fail(issue.code, issue.at, issue.message);
  }
}

const SHAPE_HINT = `{"${SOURCE_BINDING_KEY}": name, "query": {...}, "map": {...}}`;

/** Whether `value` is a legal value of `prop` (kind, enum and property schema). */
function fits(prop: SpecProp, value: unknown, root: Schema): boolean {
  if (kindProblem(prop, value) !== null) return false;
  if (prop.schema && (prop.kind === 'array' || prop.kind === 'object')) {
    return validateInstance(toDialectSchema(prop.schema), value, root).length === 0;
  }
  return true;
}

/** A whole prop given as a binding: `$state` of a fitting variable, or `$data` for a scalar prop. */
function checkPropBinding(
  value: Record<string, unknown>,
  prop: SpecProp,
  path: string,
  context: NodeContext
): void {
  const { state } = context;
  const target = bindingTarget(value);
  const fail = (code: SpecDiagnosticCode, message: string) => context.fail(code, path, message);
  if (!target) {
    fail('binding', BINDING_SHAPE);
    return;
  }
  if (target.key === DATA_BINDING_KEY) {
    if (!SPEC_REGEX.dataName.test(target.name) || target.name.length > 64) {
      fail('binding', `"${target.name}" is not a host data name.`);
    } else if (!['string', 'number', 'boolean', 'enum'].includes(prop.kind)) {
      fail('binding', 'Host data binds only a whole string, number, boolean or enum prop.');
    }
    return;
  }
  const variable = state.get(target.name);
  if (!variable) {
    fail('unknown-state', `No state variable named "${target.name}".`);
    return;
  }
  if (variable.valid && !fits(prop, variable.initial, context.root)) {
    fail(
      'binding',
      `"${target.name}" (${variable.type}) does not fit "${prop.name}" (${prop.kind}).`
    );
  }
}

/**
 * Nested bindings inside an array or object prop without a property schema:
 * `$state` names must be declared; `$data` binds only a whole prop.
 */
function walkOpaque(value: unknown, path: string, depth: number, context: NodeContext): void {
  if (depth > SPEC_LIMITS.propDepth) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkOpaque(item, `${path}[${index}]`, depth + 1, context);
    });
    return;
  }
  if (!isRecord(value)) return;
  if (isSourceBinding(value)) {
    context.fail('source', path, 'A data-source binding reads only a whole top-level prop.');
    return;
  }
  if (isBindingShaped(value)) {
    nestedBinding(value, path, context, undefined);
    return;
  }
  for (const [key, item] of Object.entries(value))
    walkOpaque(item, `${path}.${key}`, depth + 1, context);
}

/** A binding nested in a prop value; `schema` (when known) is the position's schema. */
function nestedBinding(
  value: Record<string, unknown>,
  path: string,
  context: NodeContext,
  schema: Schema | undefined
): void {
  const { state } = context;
  const target = bindingTarget(value);
  const fail = (code: SpecDiagnosticCode, message: string) => context.fail(code, path, message);
  if (!target) {
    fail('binding', BINDING_SHAPE);
  } else if (target.key === DATA_BINDING_KEY) {
    fail('binding', 'Host data binds only a whole top-level prop.');
  } else {
    const variable = state.get(target.name);
    if (!variable) fail('unknown-state', `No state variable named "${target.name}".`);
    else if (
      schema &&
      variable.valid &&
      validateInstance(schema, variable.initial, context.root).length > 0
    ) {
      fail('binding', `"${target.name}" (${variable.type}) does not fit this position.`);
    }
  }
}

/**
 * An array or object prop with a property schema: the dialect checks the
 * value (its first issue is the prop's `prop-type`), then binding, reorder,
 * action and workflow positions add their own diagnostics.
 */
function checkPropSchemaValue(
  name: string,
  propSchema: SpecPropSchema,
  value: unknown,
  path: string,
  context: NodeContext
): void {
  const { id, root } = context;
  const defs = root.$defs ?? {};
  const extra: SpecDiagnostic[] = [];
  const sub = reportInto({ ...context, out: extra });
  const at = (relative: string) => `${path}${relative.slice(1)}`;
  const issues = validateInstance(toDialectSchema(propSchema), value, root, {
    value(node, current, relative): readonly SchemaIssue[] | undefined {
      if (node === defs.binding) {
        if (isRecord(current) && Object.keys(current).length !== 1) {
          sub.fail('binding', at(relative), BINDING_SHAPE);
        } else if (
          isRecord(current) &&
          typeof current.$state === 'string' &&
          !context.state.has(current.$state)
        ) {
          sub.fail('unknown-state', at(relative), `No state variable named "${current.$state}".`);
        }
        return undefined;
      }
      if (node === defs.reorder) {
        if (isRecord(current) && isRecord(current.bind)) {
          reorderBinding(current.bind, at(`${relative}.bind`), sub);
        }
        return undefined;
      }
      if (node === defs.action) {
        if (isRecord(current)) checkAction(current, at(relative), undefined, sub);
        return undefined;
      }
      if (node === defs.workflowGraph) {
        // contractRoot adds workflowGraph only with a validator; a caller-built root fails closed here.
        if (!context.workflow)
          return [{ code: 'bad-ref', path: relative, message: 'No validator.' }];
        const schema: Schema = { ...node, $defs: defs };
        const result = context.workflow.validate(current, schema);
        const schemaIssues: SchemaIssue[] = [];
        for (const d of result.diagnostics) {
          if (d.code === 'schema')
            schemaIssues.push({
              code: 'schema',
              path: `${relative}${d.path.slice(1)}`,
              message: d.message,
            });
          else extra.push({ ...d, path: at(`${relative}${d.path.slice(1)}`), id });
        }
        return schemaIssues;
      }
      if (isSourceBinding(current)) {
        sub.fail(
          'source',
          at(relative),
          'A data-source binding reads only a whole top-level prop.'
        );
        return [];
      }
      if (isBindingShaped(current)) {
        nestedBinding(current, at(relative), sub, node);
        return [];
      }
      return undefined;
    },
  });
  const first = issues[0];
  if (first) {
    context.fail(
      'prop-type',
      at(first.path),
      `"${name}" does not match its schema: ${first.code}: ${first.message}`
    );
  }
  context.out.push(...extra);
}

/** `reorder.bind` must be `$state` of a writable list. */
function reorderBinding(bind: Record<string, unknown>, path: string, context: NodeContext): void {
  const name = bind.$state;
  if (typeof name !== 'string' || Object.keys(bind).length !== 1) {
    if (typeof bind.$data === 'string') {
      context.fail('binding', path, 'reorder needs a writable list, not host data.');
    }
    return;
  }
  const variable = context.state.get(name);
  if (variable?.valid && (variable.type !== 'list' || !variable.writable)) {
    context.fail('binding', path, `reorder binds a writable list; "${name}" is not one.`);
  }
}

/** `bind`: two-way bindings to bindable props, `$state` only, writable and fitting. */
function checkBind(
  bind: Record<string, unknown>,
  props: Record<string, unknown>,
  component: SpecComponent,
  path: string,
  context: NodeContext
): void {
  const { id, state } = context;
  for (const [name, value] of Object.entries(bind)) {
    const here = `${path}.${name}`;
    const fail = (code: SpecDiagnosticCode, message: string) => context.fail(code, here, message);
    const prop = component.props.find((p) => p.name === name);
    if (!prop) {
      fail('unknown-prop', `"${id}" has no "${name}" prop.`);
      continue;
    }
    if (!(component.bindable ?? []).includes(name)) {
      fail('binding', `"${name}" is not bindable on "${id}".`);
      continue;
    }
    if (Object.hasOwn(props, name)) {
      fail('binding', `"${name}" is set both as a prop and as a binding.`);
      continue;
    }
    const target = isRecord(value) ? bindingTarget(value) : null;
    if (!target || target.key !== STATE_BINDING_KEY) {
      fail('binding', 'bind takes exactly {"$state": name}; host data is read-only.');
      continue;
    }
    const variable = state.get(target.name);
    if (!variable) {
      fail('unknown-state', `No state variable named "${target.name}".`);
      continue;
    }
    if (!variable.valid) continue;
    if (!variable.writable) {
      fail('binding', `"${target.name}" is host-bound and read-only.`);
    } else if (!fits(prop, variable.initial, context.root)) {
      fail('binding', `"${target.name}" (${variable.type}) does not fit "${name}" (${prop.kind}).`);
    }
  }
}

/** `on`: events the component declares, each with its closed actions. */
function checkOn(
  on: Record<string, unknown>,
  component: SpecComponent,
  path: string,
  context: NodeContext
): void {
  for (const [event, actions] of Object.entries(on)) {
    const here = `${path}.${event}`;
    if (!(component.events ?? []).includes(event as never)) {
      context.fail('unknown-event', here, `"${component.id}" fires no "${event}" event.`);
    }
    if (!Array.isArray(actions)) continue;
    actions.forEach((action, index) => {
      if (isRecord(action)) checkAction(action, `${here}[${index}]`, event, context);
    });
  }
}

/**
 * One closed action: the fields its op takes, then its targets. At most one
 * diagnostic per action (the first problem). `event` is the firing event,
 * unknown for an action given as a prop value.
 */
function checkAction(
  action: Record<string, unknown>,
  path: string,
  event: string | undefined,
  context: NodeContext
): void {
  const { state, flow, fail } = context;
  const op = action.op;
  if (!(SPEC_ACTION_OPS as readonly unknown[]).includes(op)) return;
  const fields = ACTION_FIELDS[op as SpecActionOp];
  // Unknown keys are the schema's to report; only fields of another op are judged here.
  const extra = Object.keys(action).find(
    (key) => ACTION_KEYS.has(key) && !fields.allowed.includes(key)
  );
  if (extra !== undefined) {
    fail('action', `${path}.${extra}`, `${String(op)} takes no "${extra}".`);
    return;
  }
  const missing = fields.required.find((key) => !Object.hasOwn(action, key));
  if (missing !== undefined) {
    fail('action', `${path}.${missing}`, `${String(op)} needs "${missing}".`);
    return;
  }
  /** The declared variable `key` names, or null after reporting it. */
  const variable = (key: string): SpecStateVariable | null => {
    const name = action[key];
    if (typeof name !== 'string') return null;
    const found = state.get(name);
    if (!found) {
      fail('unknown-state', `${path}.${key}`, `No state variable named "${name}".`);
      return null;
    }
    // A refused declaration was reported once; judging its uses would only cascade.
    if (!found.valid) return null;
    if (!found.writable) {
      fail('action', `${path}.${key}`, `"${name}" is host-bound and read-only.`);
      return null;
    }
    return found;
  };
  switch (op as SpecActionOp) {
    case 'setState': {
      const hasValue = Object.hasOwn(action, 'value');
      if (hasValue === Object.hasOwn(action, 'fromEvent')) {
        fail('action', path, 'setState takes exactly one of "value" and "fromEvent".');
        return;
      }
      const target = variable('state');
      if (!target) return;
      if (target.type === 'list' || target.type === 'workflow') {
        fail('action', `${path}.state`, `setState cannot replace a ${target.type}; use moveItem.`);
      } else if (hasValue && target.valid && !fitsVariable(target, action.value)) {
        fail('action', `${path}.value`, `The value does not fit "${String(action.state)}".`);
      } else if (!hasValue && event !== undefined && event !== 'change' && event !== 'select') {
        fail(
          'action',
          `${path}.fromEvent`,
          'fromEvent reads the value of a change or select event.'
        );
      }
      return;
    }
    case 'toggleState': {
      const target = variable('state');
      if (target && target.type !== 'boolean') {
        fail('action', `${path}.state`, 'toggleState flips a boolean.');
      }
      return;
    }
    case 'moveItem': {
      for (const key of ['from', 'to']) {
        if (!Object.hasOwn(action, key)) continue;
        const target = variable(key);
        if (!target) return;
        if (target.type !== 'list') {
          fail('action', `${path}.${key}`, 'moveItem moves items between lists.');
          return;
        }
      }
      return;
    }
    case 'flowGo': {
      if (!flow) fail('action', path, 'flowGo needs a declared flow.');
      else if (!flow.events.has(action.event as string)) {
        fail('action', `${path}.event`, `No transition handles "${String(action.event)}".`);
      }
      return;
    }
    case 'emit': {
      if (!isRecord(action.values)) return;
      const entries = Object.entries(action.values);
      if (entries.length > SPEC_LIMITS.emitValues) {
        fail('action', `${path}.values`, `At most ${SPEC_LIMITS.emitValues} values.`);
        return;
      }
      for (const [name, value] of entries) {
        const here = `${path}.values.${name}`;
        if (!SPEC_REGEX.intentName.test(name)) {
          fail('action', here, `"${name}" is not a value name.`);
          return;
        }
        if (isRecord(value)) {
          const target = bindingTarget(value);
          if (!target || target.key !== STATE_BINDING_KEY) {
            fail('action', here, 'An emitted value is a scalar or {"$state": name}.');
            return;
          }
          const found = state.get(target.name);
          if (!found) {
            fail('unknown-state', here, `No state variable named "${target.name}".`);
            return;
          }
          if (found.valid && (found.type === 'list' || found.type === 'workflow')) {
            fail('action', here, 'Only scalar variables can be emitted.');
            return;
          }
        } else if (
          !(
            typeof value === 'boolean' ||
            finite(value) ||
            (typeof value === 'string' && value.length <= SPEC_LIMITS.emitValueLength)
          )
        ) {
          fail('action', here, 'An emitted value is a boolean, a number or a short string.');
          return;
        }
      }
      return;
    }
    case 'submit': {
      if (!context.insideForm) fail('action', path, `submit runs only inside an ${FORM_ID}.`);
      return;
    }
  }
}

/** Whether `value` is a legal value of a scalar variable. */
function fitsVariable(variable: SpecStateVariable, value: unknown): boolean {
  switch (variable.type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return (
        finite(value) &&
        value >= (variable.min ?? Number.NEGATIVE_INFINITY) &&
        value <= (variable.max ?? Number.POSITIVE_INFINITY)
      );
    case 'enum':
      return typeof value === 'string' && (variable.values ?? []).includes(value);
    case 'string':
      return typeof value === 'string' && value.length <= (variable.maxLength ?? 0);
    default:
      return false;
  }
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
