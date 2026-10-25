import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { COMPONENT_ID, copyProps, isPlainRecord } from './props.ts';
import { validateA2uiMessages } from './schema.ts';
import {
  A2UI_ROOT_ID,
  A2UI_ROOTS_COMPONENT,
  A2UI_VERSION,
  type A2uiComponent,
  type A2uiDiagnostic,
  type A2uiLimits,
  type A2uiMessage,
} from './types.ts';

export interface ToA2uiOptions extends A2uiLimits {
  /** The A2UI surface the components belong to. */
  surfaceId: string;
  /** The catalog the client resolves `component` ids in, e.g. `catalog-<sha256>.json`. */
  catalogId: string;
  /** Start with a `createSurface` message (default true). */
  createSurface?: boolean;
}

export type ToA2uiResult =
  | { ok: true; messages: A2uiMessage[] }
  | { ok: false; diagnostics: A2uiDiagnostic[] };

/**
 * Convert a catalog tree (one node or a list of roots) into A2UI v0.9
 * messages: an optional `createSurface`, then one `updateComponents` whose
 * flat component list references children by id.
 *
 * Ids are deterministic: the root is `root` and the rest are `n1`, `n2`… in
 * the order they are visited. Zero or several roots are wrapped in a
 * `texuli-roots` component. Props must be literal JSON; reserved names
 * (`id`, `component`, `children`, `child`), prototype keys, bindings and
 * function calls fail the conversion. The output is checked against
 * {@link A2UI_MESSAGE_SCHEMA} before it is returned.
 */
export function catalogTreeToA2ui(
  tree: CatalogTreeInput | readonly CatalogTreeInput[],
  options: ToA2uiOptions
): ToA2uiResult {
  const maxComponents = options.maxComponents ?? 1000;
  const maxDepth = options.maxDepth ?? 64;
  const diagnostics: A2uiDiagnostic[] = [];
  const components: A2uiComponent[] = [];
  let next = 0;
  let stopped = false;

  const visit = (value: unknown, path: string, depth: number, id: string): void => {
    if (stopped) return;
    if (depth > maxDepth) {
      diagnostics.push({ code: 'limit', path, message: `Nesting deeper than ${maxDepth}.` });
      return;
    }
    if (components.length >= maxComponents) {
      diagnostics.push({ code: 'limit', path, message: `More than ${maxComponents} components.` });
      stopped = true;
      return;
    }
    if (!isPlainRecord(value) || typeof value.id !== 'string' || !COMPONENT_ID.test(value.id)) {
      diagnostics.push({
        code: 'invalid-node',
        path,
        message: 'A catalog node is a plain object with a kebab-case "id".',
      });
      return;
    }
    if (value.id === A2UI_ROOTS_COMPONENT) {
      diagnostics.push({
        code: 'invalid-node',
        path: `${path}.id`,
        message: `"${A2UI_ROOTS_COMPONENT}" is the adapter's own wrapper, not a catalog id.`,
      });
      return;
    }
    if (value.props !== undefined && !isPlainRecord(value.props)) {
      diagnostics.push({
        code: 'invalid-node',
        path: `${path}.props`,
        message: '"props" must be an object.',
      });
      return;
    }
    if (value.children !== undefined && !Array.isArray(value.children)) {
      diagnostics.push({
        code: 'invalid-node',
        path: `${path}.children`,
        message: '"children" must be an array.',
      });
      return;
    }
    const props = copyProps(value.props ?? {}, [], `${path}.props`, 'reserved-prop', diagnostics);
    const component: A2uiComponent = { id, component: value.id, ...props };
    components.push(component);
    if (Array.isArray(value.children)) {
      const ids: string[] = [];
      value.children.forEach((child: unknown, i: number) => {
        if (stopped) return;
        next += 1;
        const childId = `n${next}`;
        ids.push(childId);
        visit(child, `${path}.children[${i}]`, depth + 1, childId);
      });
      component.children = ids;
    }
  };

  if (Array.isArray(tree)) {
    if (tree.length === 1) visit(tree[0], '$[0]', 1, A2UI_ROOT_ID);
    else if (tree.length >= maxComponents) {
      diagnostics.push({
        code: 'limit',
        path: '$',
        message: `More than ${maxComponents} components.`,
      });
    } else {
      const ids = tree.map(() => `n${++next}`);
      components.push({ id: A2UI_ROOT_ID, component: A2UI_ROOTS_COMPONENT, children: ids });
      tree.forEach((node, i) => {
        visit(node, `$[${i}]`, 2, ids[i] as string);
      });
    }
  } else {
    visit(tree, '$', 1, A2UI_ROOT_ID);
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const messages: A2uiMessage[] = [];
  if (options.createSurface !== false) {
    messages.push({
      version: A2UI_VERSION,
      createSurface: { surfaceId: options.surfaceId, catalogId: options.catalogId },
    });
  }
  messages.push({
    version: A2UI_VERSION,
    updateComponents: { surfaceId: options.surfaceId, components },
  });
  const invalid = validateA2uiMessages(messages);
  return invalid.length > 0 ? { ok: false, diagnostics: invalid } : { ok: true, messages };
}
