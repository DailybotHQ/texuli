import type { CatalogTreeInput } from '../render/renderer/types.ts';
import { parseEditOp } from './parse.ts';
import type { EditError, EditOp, EditResult, NodePath } from './types.ts';

type Applied =
  | { ok: true; tree: CatalogTreeInput; inverse: EditOp }
  | { ok: false; error: EditError };

function fail(code: EditError['code'], message: string): Applied {
  return { ok: false, error: { code, message } };
}

function describe(path: NodePath): string {
  return path.length === 0 ? 'the root' : `node [${path.join(', ')}]`;
}

/** The node at `path`, or `undefined` when the path does not resolve. */
export function getNode(tree: CatalogTreeInput, path: NodePath): CatalogTreeInput | undefined {
  let node: CatalogTreeInput | undefined = tree;
  for (const index of path) {
    node = node?.children?.[index];
    if (node === undefined) return undefined;
  }
  return node;
}

/**
 * Copy-on-write update of the node at `path`: only the nodes along the path
 * are copied, every other subtree is shared, and the input is never mutated.
 */
function updateAt(
  tree: CatalogTreeInput,
  path: NodePath,
  update: (node: CatalogTreeInput) => CatalogTreeInput
): CatalogTreeInput {
  if (path.length === 0) return update(tree);
  const [head, ...rest] = path as [number, ...number[]];
  const children = [...(tree.children ?? [])];
  children[head] = updateAt(children[head] as CatalogTreeInput, rest, update);
  return { ...tree, children };
}

function withProp(node: CatalogTreeInput, name: string, value: unknown): CatalogTreeInput {
  const props: Record<string, unknown> = { ...node.props };
  // defineProperty keeps any name an own data property, whatever the prototype holds.
  Object.defineProperty(props, name, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return { ...node, props };
}

function insertChild(
  tree: CatalogTreeInput,
  parent: NodePath,
  index: number,
  node: CatalogTreeInput
): Applied {
  const target = getNode(tree, parent);
  if (target === undefined) return fail('path-not-found', `No ${describe(parent)} to insert into.`);
  const count = target.children?.length ?? 0;
  if (index > count) {
    return fail(
      'index-out-of-range',
      `Index ${index} is past the ${count} children of ${describe(parent)}.`
    );
  }
  const next = updateAt(tree, parent, (current) => {
    const children = [...(current.children ?? [])];
    children.splice(index, 0, node);
    return { ...current, children };
  });
  return { ok: true, tree: next, inverse: { op: 'remove', path: [...parent, index] } };
}

function removeChild(tree: CatalogTreeInput, path: NodePath): Applied {
  if (path.length === 0) return fail('root-op', 'The root cannot be removed; use "replaceAll".');
  const removed = getNode(tree, path);
  if (removed === undefined) return fail('path-not-found', `No ${describe(path)} to remove.`);
  const parent = path.slice(0, -1);
  const index = path[path.length - 1] as number;
  const next = updateAt(tree, parent, (current) => {
    const children = [...(current.children ?? [])];
    children.splice(index, 1);
    return { ...current, children };
  });
  return { ok: true, tree: next, inverse: { op: 'insert', parent, index, node: removed } };
}

function applyOne(tree: CatalogTreeInput, op: EditOp): Applied {
  switch (op.op) {
    case 'insert':
      return insertChild(tree, op.parent, op.index, op.node);
    case 'remove':
      return removeChild(tree, op.path);
    case 'move': {
      const removed = removeChild(tree, op.path);
      if (!removed.ok) return removed;
      const node = getNode(tree, op.path) as CatalogTreeInput;
      const inserted = insertChild(removed.tree, op.parent, op.index, node);
      if (!inserted.ok) return inserted;
      // Both directions address the same intermediate tree (the node removed),
      // and the old parent path is a prefix of the old path, so it is unchanged there.
      const inverse: EditOp = {
        op: 'move',
        path: [...op.parent, op.index],
        parent: op.path.slice(0, -1),
        index: op.path[op.path.length - 1] as number,
      };
      return { ok: true, tree: inserted.tree, inverse };
    }
    case 'setProp': {
      const node = getNode(tree, op.path);
      if (node === undefined)
        return fail('path-not-found', `No ${describe(op.path)} to set "${op.name}" on.`);
      const had = node.props !== undefined && Object.hasOwn(node.props, op.name);
      // Without a props bag to return to, only a replace restores the node exactly.
      const inverse: EditOp =
        node.props === undefined
          ? { op: 'replace', path: op.path, node }
          : had
            ? { op: 'setProp', path: op.path, name: op.name, value: node.props[op.name] }
            : { op: 'unsetProp', path: op.path, name: op.name };
      return {
        ok: true,
        tree: updateAt(tree, op.path, (current) => withProp(current, op.name, op.value)),
        inverse,
      };
    }
    case 'unsetProp': {
      const node = getNode(tree, op.path);
      if (node === undefined)
        return fail('path-not-found', `No ${describe(op.path)} to unset "${op.name}" on.`);
      if (node.props === undefined || !Object.hasOwn(node.props, op.name)) {
        return { ok: true, tree, inverse: op };
      }
      const value = node.props[op.name];
      const next = updateAt(tree, op.path, (current) => {
        const props: Record<string, unknown> = { ...current.props };
        delete props[op.name];
        return { ...current, props };
      });
      return {
        ok: true,
        tree: next,
        inverse: { op: 'setProp', path: op.path, name: op.name, value },
      };
    }
    case 'replace': {
      const node = getNode(tree, op.path);
      if (node === undefined) return fail('path-not-found', `No ${describe(op.path)} to replace.`);
      return {
        ok: true,
        tree: updateAt(tree, op.path, () => op.node),
        inverse: { op: 'replace', path: op.path, node },
      };
    }
    case 'replaceAll':
      return { ok: true, tree: op.tree, inverse: { op: 'replaceAll', tree } };
  }
}

/**
 * Apply ops in order, all or none. Each op is re-checked as untrusted data
 * first, the input tree is never mutated, and the result carries the inverse
 * ops that restore the input exactly (for undo, or to send back as a patch).
 *
 * This checks shape and addressing only. Catalog ids, tiers, limits and
 * grammar are the commit gate's job (see `createEditHistory`).
 */
export function applyEditOps(tree: CatalogTreeInput, ops: readonly EditOp[]): EditResult {
  let current = tree;
  const inverses: EditOp[] = [];
  for (const [index, candidate] of ops.entries()) {
    const parsed = parseEditOp(candidate);
    if (!parsed.ok) return { ok: false, error: { ...parsed.error, opIndex: index } };
    const applied = applyOne(current, parsed.op);
    if (!applied.ok) return { ok: false, error: { ...applied.error, opIndex: index } };
    current = applied.tree;
    inverses.unshift(applied.inverse);
  }
  return { ok: true, tree: current, inverse: inverses, changed: current !== tree };
}

/** Apply one op. See {@link applyEditOps}. */
export function applyEditOp(tree: CatalogTreeInput, op: EditOp): EditResult {
  return applyEditOps(tree, [op]);
}
