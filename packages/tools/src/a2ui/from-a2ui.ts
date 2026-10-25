import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { copyProps, isPlainRecord } from './props.ts';
import { validateA2uiMessages } from './schema.ts';
import {
  A2UI_RESERVED_KEYS,
  A2UI_ROOT_ID,
  A2UI_ROOTS_COMPONENT,
  type A2uiComponent,
  type A2uiDiagnostic,
  type A2uiLimits,
  type A2uiMessage,
} from './types.ts';

export interface FromA2uiOptions extends A2uiLimits {
  /** The surface to read (default: the first one the messages name). */
  surfaceId?: string;
  /** When set, a `createSurface` naming another catalog fails the conversion. */
  catalogId?: string;
}

export type FromA2uiResult =
  | {
      ok: true;
      surfaceId: string;
      /** From `createSurface`, when the messages include one. */
      catalogId?: string;
      /** The catalog tree's top-level nodes (empty after `deleteSurface`). */
      roots: CatalogTreeInput[];
      /** Components no path from `root` reaches; they are left out. */
      unused: string[];
    }
  | { ok: false; diagnostics: A2uiDiagnostic[] };

function tooManyComponents(message: unknown, max: number): boolean {
  if (!isPlainRecord(message) || !isPlainRecord(message.updateComponents)) return false;
  const { components } = message.updateComponents;
  if (!Array.isArray(components) || components.length > max) return Array.isArray(components);
  return components.some(
    (c) => isPlainRecord(c) && Array.isArray(c.children) && c.children.length > max
  );
}

function surfaceOf(message: A2uiMessage): string {
  if ('createSurface' in message) return message.createSurface.surfaceId;
  if ('updateComponents' in message) return message.updateComponents.surfaceId;
  if ('updateDataModel' in message) return message.updateDataModel.surfaceId;
  return message.deleteSurface.surfaceId;
}

/**
 * Convert untrusted A2UI v0.9 messages (one message or a list, already
 * parsed from JSON) back into a catalog tree.
 *
 * The messages are checked against {@link A2UI_MESSAGE_SCHEMA} first. For
 * the chosen surface, `updateComponents` messages upsert components by id;
 * `deleteSurface` clears them; `updateDataModel` is ignored (catalog trees
 * carry no data model). The tree is rebuilt from `root`. Missing children,
 * cycles, a component used twice, data-bound child templates, bindings,
 * prototype keys and size limits fail the conversion. Messages for other
 * surfaces are ignored. Pass the result to `renderCatalogTree`, which applies
 * the catalog's ids, tiers and prop schemas.
 */
export function a2uiToCatalogTree(input: unknown, options: FromA2uiOptions = {}): FromA2uiResult {
  const maxComponents = options.maxComponents ?? 1000;
  const maxDepth = options.maxDepth ?? 64;
  const list = Array.isArray(input) ? input : [input];
  // Bound the work before the schema walks every item.
  const oversized =
    list.length > maxComponents || list.some((m) => tooManyComponents(m, maxComponents));
  if (oversized) {
    return {
      ok: false,
      diagnostics: [
        { code: 'limit', path: '$', message: `More than ${maxComponents} components or messages.` },
      ],
    };
  }
  const invalid = validateA2uiMessages(list);
  if (invalid.length > 0) return { ok: false, diagnostics: invalid };
  const messages = list as A2uiMessage[];

  const surfaceId = options.surfaceId ?? (messages[0] ? surfaceOf(messages[0]) : undefined);
  if (surfaceId === undefined) {
    return { ok: false, diagnostics: [{ code: 'surface', path: '$', message: 'No messages.' }] };
  }

  const diagnostics: A2uiDiagnostic[] = [];
  const components = new Map<string, { value: A2uiComponent; path: string }>();
  let created = false;
  let catalogId: string | undefined;
  messages.forEach((message, i) => {
    if (surfaceOf(message) !== surfaceId) return;
    if ('createSurface' in message) {
      if (created) {
        diagnostics.push({
          code: 'surface',
          path: `$[${i}]`,
          message: `Surface "${surfaceId}" is created twice without a deleteSurface between.`,
        });
      }
      if (
        options.catalogId !== undefined &&
        message.createSurface.catalogId !== options.catalogId
      ) {
        diagnostics.push({
          code: 'surface',
          path: `$[${i}].createSurface.catalogId`,
          message: `Expected catalog "${options.catalogId}".`,
        });
      }
      created = true;
      catalogId = message.createSurface.catalogId;
    } else if ('deleteSurface' in message) {
      created = false;
      components.clear();
    } else if ('updateComponents' in message) {
      message.updateComponents.components.forEach((value, j) => {
        components.set(value.id, { value, path: `$[${i}].updateComponents.components[${j}]` });
      });
      if (components.size > maxComponents) {
        diagnostics.push({
          code: 'limit',
          path: `$[${i}]`,
          message: `More than ${maxComponents} components.`,
        });
      }
    }
  });
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const base = { ok: true as const, surfaceId, ...(catalogId === undefined ? {} : { catalogId }) };
  if (components.size === 0) return { ...base, roots: [], unused: [] };

  const used = new Set<string>();
  const onPath = new Set<string>();
  const build = (id: string, from: string, depth: number): CatalogTreeInput | null => {
    if (diagnostics.length >= 50) return null;
    const entry = components.get(id);
    if (!entry) {
      diagnostics.push(
        id === A2UI_ROOT_ID
          ? { code: 'missing-root', path: from, message: 'No component has the id "root".' }
          : { code: 'missing-child', path: from, message: `No component has the id "${id}".` }
      );
      return null;
    }
    if (onPath.has(id)) {
      diagnostics.push({ code: 'cycle', path: from, message: `"${id}" contains itself.` });
      return null;
    }
    if (used.has(id)) {
      diagnostics.push({
        code: 'shared-child',
        path: from,
        message: `"${id}" already has a parent; a tree uses each component once.`,
      });
      return null;
    }
    if (depth > maxDepth) {
      diagnostics.push({
        code: 'limit',
        path: entry.path,
        message: `Nesting deeper than ${maxDepth}.`,
      });
      return null;
    }
    const { value, path } = entry;
    used.add(id);
    if (value.component === A2UI_ROOTS_COMPONENT && depth > 1) {
      diagnostics.push({
        code: 'invalid-node',
        path: `${path}.component`,
        message: `"${A2UI_ROOTS_COMPONENT}" may only be the root.`,
      });
      return null;
    }
    if (value.children !== undefined && value.child !== undefined) {
      diagnostics.push({
        code: 'invalid-node',
        path,
        message: 'A component has "children" or "child", not both.',
      });
      return null;
    }
    if (value.children !== undefined && !Array.isArray(value.children)) {
      diagnostics.push({
        code: 'template-children',
        path: `${path}.children`,
        message: 'Data-bound child templates are not supported; list child ids.',
      });
      return null;
    }
    const props = copyProps(value, A2UI_RESERVED_KEYS, path, null, diagnostics);
    const childIds =
      value.child !== undefined ? [value.child] : (value.children as string[] | undefined);
    onPath.add(id);
    const children = childIds?.map((childId, k) =>
      build(
        childId,
        value.child !== undefined ? `${path}.child` : `${path}.children[${k}]`,
        depth + 1
      )
    );
    onPath.delete(id);
    const node: CatalogTreeInput = {
      id: value.component,
      ...(Object.keys(props).length > 0 ? { props } : {}),
      ...(children ? { children: children.filter((c) => c !== null) } : {}),
    };
    return node;
  };

  const root = build(A2UI_ROOT_ID, '$', 1);
  if (diagnostics.length > 0 || root === null) return { ok: false, diagnostics };
  const unused = [...components.keys()].filter((id) => !used.has(id)).sort();
  const roots = root.id === A2UI_ROOTS_COMPONENT ? [...(root.children ?? [])] : [root];
  return { ...base, roots, unused };
}
