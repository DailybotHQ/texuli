import type { FormulaInputs } from '@texuli/blocks/formula';
import { type BlueprintNodeMotion, checkNodeMotion } from '@texuli/spec/motion';
import { blockFamilyMismatch } from './block-families.ts';
import { sanitizeProps } from './props.ts';
import { resolveTier } from './tier.ts';
import type {
  CatalogTreeInput,
  RenderCatalog,
  RenderComponentSpec,
  RenderConditions,
  RenderDiagnostic,
  RenderNode,
  RenderOptions,
  RenderResult,
  RenderTier,
} from './types.ts';

const DEFAULT_MAX_CHILDREN = 256;
const ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** A node key (spec 0.7.0 `$defs.nodeKey`); a malformed one is not carried. */
const NODE_KEY = /^[A-Za-z0-9._:-]{1,64}$/;
/** The sanctioned inline text node (audit G03): a leaf. */
const INLINE_TEXT_ID = 'inline-text';
/** The default slot: a child that names it is an ordinary child. */
const DEFAULT_SLOT = 'children';

/** What every node of one render shares. */
interface RenderContext {
  catalog: RenderCatalog;
  tier: RenderTier;
  maxChildren: number;
  conditions: RenderConditions | undefined;
  inputs: FormulaInputs;
  diagnostics: RenderDiagnostic[];
}

/**
 * Walk an untrusted catalog tree into a sink-free render tree.
 *
 * Rules (SECURITY.md + T-render-renderer):
 * - unknown / tier-denied ids → labelled **placeholder** (never a component)
 * - schema failure (types, required, HTML strings) → **node dropped**
 * - a `blocks-*` node whose block is another family's → **node dropped**
 * - an `inline-text` node is a leaf → its children are dropped
 * - a child's `slot` must name a `slot` prop of its parent → otherwise the
 *   child is **dropped** (`invalid-slot`); the root has no slot
 * - a `when` condition must parse with the injected `conditions` runtime →
 *   otherwise, or with no runtime, the node is **dropped**
 *   (`invalid-condition`); a valid condition that is false or unknown for
 *   `conditionInputs` hides the node, after its subtree was still checked;
 *   the root cannot be conditional
 * - a `motion` must use the closed spec 0.6.0 vocabulary (presets and token
 *   steps) → otherwise the motion is **dropped** (`invalid-motion`) and the
 *   node paints without it
 * - `class` / `style` (and related) never pass through
 * - no HTML strings, no functions, no host slots/events from the tree
 */
export function renderCatalogTree(input: unknown, options: RenderOptions): RenderResult {
  const diagnostics: RenderDiagnostic[] = [];
  const context: RenderContext = {
    catalog: options.catalog,
    tier: resolveTier(options.tier),
    maxChildren: Math.max(0, Math.floor(options.maxChildren ?? DEFAULT_MAX_CHILDREN)),
    conditions: options.conditions,
    inputs: options.conditionInputs ?? {},
    diagnostics,
  };
  const roots: RenderNode[] = [];

  const list = normalizeRoots(input, diagnostics);
  list.forEach((node, index) => {
    const rendered = renderNode(node, null, String(index), context);
    if (rendered) roots.push(rendered);
  });

  return { roots: Object.freeze(roots), diagnostics: Object.freeze(diagnostics) };
}

function normalizeRoots(input: unknown, diagnostics: RenderDiagnostic[]): CatalogTreeInput[] {
  if (input === null || input === undefined) return [];
  if (Array.isArray(input)) {
    return input.flatMap((item, index) => {
      const node = asTreeNode(item, String(index), diagnostics);
      return node ? [node] : [];
    });
  }
  const single = asTreeNode(input, '0', diagnostics);
  return single ? [single] : [];
}

function asTreeNode(
  value: unknown,
  path: string,
  diagnostics: RenderDiagnostic[]
): CatalogTreeInput | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    diagnostics.push({
      code: 'invalid-node',
      path,
      message: 'Catalog node must be a plain object with an "id" string.',
    });
    return null;
  }
  const record = value as Record<string, unknown>;
  const id = record.id;
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    diagnostics.push({
      code: 'invalid-node',
      path,
      message: 'Catalog node "id" must be a kebab-case component id.',
    });
    return null;
  }
  const props =
    record.props === undefined
      ? undefined
      : isPlainObject(record.props)
        ? (record.props as Record<string, unknown>)
        : undefined;
  if (record.props !== undefined && props === undefined) {
    diagnostics.push({
      code: 'invalid-node',
      path,
      id,
      message: 'Catalog node "props" must be a plain object when present.',
    });
    return null;
  }
  let children: CatalogTreeInput[] | undefined;
  if (record.children !== undefined) {
    if (!Array.isArray(record.children)) {
      diagnostics.push({
        code: 'invalid-node',
        path,
        id,
        message: 'Catalog node "children" must be an array when present.',
      });
      return null;
    }
    children = record.children as CatalogTreeInput[];
  }
  return {
    ...(typeof record.key === 'string' && NODE_KEY.test(record.key) ? { key: record.key } : {}),
    id,
    ...(props ? { props } : {}),
    ...(children ? { children } : {}),
    ...(record.slot !== undefined ? { slot: record.slot as string } : {}),
    ...(record.when !== undefined ? { when: record.when } : {}),
    ...(record.motion !== undefined ? { motion: record.motion } : {}),
  };
}

/**
 * The slot a child fills: `undefined` for the default slot, the slot name, or
 * `null` when the child must be dropped. Reports what it refuses.
 */
function resolveSlot(
  node: CatalogTreeInput,
  parent: RenderComponentSpec | null,
  path: string,
  diagnostics: RenderDiagnostic[]
): string | undefined | null {
  const { slot, id } = node;
  if (slot === undefined || slot === DEFAULT_SLOT) return undefined;
  if (parent === null) {
    diagnostics.push({
      code: 'invalid-slot',
      path,
      id,
      message: 'A root node fills no slot; its "slot" was ignored.',
    });
    return undefined;
  }
  const named =
    typeof slot === 'string' &&
    parent.props.some((prop) => prop.kind === 'slot' && prop.name === slot);
  if (!named) {
    const slots = parent.props.filter((p) => p.kind === 'slot').map((p) => p.name);
    diagnostics.push({
      code: 'invalid-slot',
      path,
      id,
      message: `"${typeof slot === 'string' ? slot : typeof slot}" is not a slot of "${parent.id}" (slots: ${slots.join(', ') || 'none'}); the node was dropped.`,
    });
    return null;
  }
  return slot;
}

/**
 * Whether the node is shown: `true`, `false` (hidden), or `null` when its
 * `when` is invalid and the node must be dropped. Reports what it refuses.
 */
function resolveWhen(
  node: CatalogTreeInput,
  isRoot: boolean,
  path: string,
  context: RenderContext
): boolean | null {
  if (node.when === undefined) return true;
  if (isRoot) {
    context.diagnostics.push({
      code: 'invalid-condition',
      path,
      id: node.id,
      message: 'A root node cannot be conditional; its "when" was ignored.',
    });
    return true;
  }
  const { conditions } = context;
  if (!conditions) {
    context.diagnostics.push({
      code: 'invalid-condition',
      path,
      id: node.id,
      message: 'This host renders no conditions ("when"); the node was dropped.',
    });
    return null;
  }
  const parsed = conditions.parse(node.when);
  if (!parsed.ok) {
    context.diagnostics.push({
      code: 'invalid-condition',
      path,
      id: node.id,
      message: `${parsed.message} The node was dropped.`,
    });
    return null;
  }
  return conditions.evaluate(parsed.condition, context.inputs) === true;
}

function renderNode(
  node: CatalogTreeInput,
  parent: RenderComponentSpec | null,
  path: string,
  context: RenderContext
): RenderNode | null {
  const slot = resolveSlot(node, parent, path, context.diagnostics);
  if (slot === null) return null;
  const shown = resolveWhen(node, parent === null, path, context);
  if (shown === null) return null;
  const rendered = renderComponent(node, slot, path, context);
  // A hidden node was still checked: its diagnostics stand, its output goes.
  return shown ? rendered : null;
}

function renderComponent(
  node: CatalogTreeInput,
  slot: string | undefined,
  path: string,
  context: RenderContext
): RenderNode | null {
  const { catalog, tier, maxChildren, diagnostics } = context;
  const { id } = node;
  const slotted = slot === undefined ? {} : { slot };
  const spec = catalog.get(id);
  const allowed = spec ? (catalog.allows?.(id, tier) ?? defaultAllows(spec, tier)) : false;

  if (!spec || !allowed) {
    const reason = !spec ? 'unknown-id' : 'tier-denied';
    const label = spec ? `${spec.label} (not allowed)` : `Unknown component “${id}”`;
    diagnostics.push({
      code: reason,
      path,
      id,
      message:
        reason === 'unknown-id'
          ? `Component id "${id}" is not in the catalog.`
          : `Component id "${id}" is not allowed for the ${tier} tier.`,
    });
    return Object.freeze({
      kind: 'placeholder' as const,
      id,
      label,
      reason,
      ...slotted,
    });
  }

  const sanitized = sanitizeProps(node.props, spec.props, path, id);
  diagnostics.push(...sanitized.diagnostics);
  if (sanitized.props === null) {
    diagnostics.push({
      code: 'schema-failure',
      path,
      id,
      message: `Node "${id}" was dropped after schema failure.`,
    });
    return null;
  }

  const mismatch = blockFamilyMismatch(id, sanitized.props);
  if (mismatch) {
    diagnostics.push({ code: 'block-family-mismatch', path, id, message: mismatch });
    diagnostics.push({
      code: 'schema-failure',
      path,
      id,
      message: `Node "${id}" was dropped: its block belongs to another family.`,
    });
    return null;
  }

  let childInputs = Array.isArray(node.children) ? node.children : [];
  if (id === INLINE_TEXT_ID && childInputs.length > 0) {
    // Inline text is a leaf: its text is the whole node (audit G03).
    diagnostics.push({
      code: 'invalid-node',
      path,
      id,
      message: `"${INLINE_TEXT_ID}" is a leaf, so its children were dropped (${childInputs.length}).`,
    });
    childInputs = [];
  }
  const children: RenderNode[] = [];
  const limit = Math.min(childInputs.length, maxChildren);
  if (childInputs.length > maxChildren) {
    diagnostics.push({
      code: 'invalid-node',
      path,
      id,
      message: `Children truncated to ${maxChildren} (received ${childInputs.length}).`,
    });
  }
  for (let i = 0; i < limit; i += 1) {
    const childPath = `${path}.children.${i}`;
    const childNode = asTreeNode(childInputs[i], childPath, diagnostics);
    if (!childNode) continue;
    const rendered = renderNode(childNode, spec, childPath, context);
    if (rendered) children.push(rendered);
  }

  const motion = resolveMotion(node, path, diagnostics);
  return Object.freeze({
    kind: 'component' as const,
    id,
    ...(node.key !== undefined ? { key: node.key } : {}),
    props: sanitized.props,
    children: Object.freeze(children),
    ...slotted,
    ...(motion ? { motion } : {}),
  });
}

/** The node's checked motion, or `undefined` (none declared, or refused and reported). */
function resolveMotion(
  node: CatalogTreeInput,
  path: string,
  diagnostics: RenderDiagnostic[]
): Readonly<BlueprintNodeMotion> | undefined {
  if (node.motion === undefined) return undefined;
  const checked = checkNodeMotion(node.motion);
  if (checked.ok) return checked.motion;
  diagnostics.push({
    code: 'invalid-motion',
    path,
    id: node.id,
    message: `motion${checked.path}: ${checked.message} The node paints without motion.`,
  });
  return undefined;
}

function defaultAllows(
  spec: { agentEmittable?: boolean; emit?: readonly RenderTier[] },
  tier: RenderTier
): boolean {
  if (tier !== 'developer') {
    if (spec.emit) return spec.emit.includes('untrusted');
    return spec.agentEmittable === true;
  }
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
