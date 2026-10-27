import { canonicalBlueprintJson, createEditHistory } from '@texuli/catalog/edit';
import { DEFAULT_TREE_LIMITS, validateCatalogTreeLimits } from '@texuli/catalog/render/limits';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { FORBIDDEN_PROP_NAMES } from '@texuli/catalog/render/renderer';
import { BUILDER_MANIFEST_BY_ID } from './manifest.ts';

export const EMPTY_BLUEPRINT: CatalogTreeInput = {
  id: 'layout-page',
  props: {},
  children: [],
};

export const MAX_BLUEPRINT_BYTES = DEFAULT_TREE_LIMITS.maxBytes + 8_192;

export function canonicalJson(tree: CatalogTreeInput): string {
  return canonicalBlueprintJson(tree);
}

/**
 * True while the draft is only the untouched page root (punch-list row 3):
 * the first-run state in the structure pane shows until the first child
 * lands, then it never comes back for that draft.
 */
export function isBareDraft(tree: CatalogTreeInput): boolean {
  return (tree.children?.length ?? 0) === 0;
}

export type FlatNode = {
  node: CatalogTreeInput;
  path: number[];
  parent: number[] | null;
  depth: number;
};

/** Every node in reading order, with its path; the inspector finds the selection here. */
export function flattenTree(root: CatalogTreeInput): FlatNode[] {
  const rows: FlatNode[] = [];
  const visit = (
    node: CatalogTreeInput,
    path: number[],
    parent: number[] | null,
    depth: number
  ) => {
    rows.push({ node, path, parent, depth });
    node.children?.forEach((child, index) => {
      visit(child, [...path, index], path, depth + 1);
    });
  };
  visit(root, [], null, 0);
  return rows;
}

export function validateBuilderTree(value: unknown): value is CatalogTreeInput {
  if (!isNode(value)) return false;
  const limits = validateCatalogTreeLimits(value);
  if (!limits.ok) return false;
  return idsAllowed(value);
}

function isNode(value: unknown): value is CatalogTreeInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const node = value as Record<string, unknown>;
  if (typeof node.id !== 'string' || !BUILDER_MANIFEST_BY_ID.has(node.id)) return false;
  if (
    node.props !== undefined &&
    (typeof node.props !== 'object' || node.props === null || Array.isArray(node.props))
  )
    return false;
  if (
    node.children !== undefined &&
    (!Array.isArray(node.children) || !node.children.every(isNode))
  )
    return false;
  return true;
}

/** The only node fields a builder tree carries; `slot`, `when` and anything else are refused. */
const NODE_FIELDS = new Set(['id', 'props', 'children']);

/**
 * The closed rule every builder edit passes (history, inspector writes and
 * payload commits alike): node fields, a props object, a children array,
 * palette ids and manifest prop names, never `class`, `style` or `on*`.
 */
function idsAllowed(node: CatalogTreeInput): boolean {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return false;
  if (Object.keys(node).some((key) => !NODE_FIELDS.has(key))) return false;
  if (
    node.props !== undefined &&
    (typeof node.props !== 'object' || node.props === null || Array.isArray(node.props))
  )
    return false;
  if (node.children !== undefined && !Array.isArray(node.children)) return false;
  const manifest = BUILDER_MANIFEST_BY_ID.get(node.id);
  if (!manifest) return false;
  const allowed = new Set(manifest.props.map((prop) => prop.name));
  if (Object.keys(node.props ?? {}).some((name) => !allowed.has(name) || refusedPropName(name)))
    return false;
  return (node.children ?? []).every(idsAllowed);
}

/**
 * Prop names a blueprint never carries, whatever the manifest lists: `on*`
 * handlers and the renderer's own forbidden names (`class`, `className`,
 * `style`, `html`, …), so no inspector field can only produce refusals.
 */
export function refusedPropName(name: string): boolean {
  return name.startsWith('on') || FORBIDDEN_PROP_NAMES.has(name);
}

/**
 * The props the inspector offers: not slots or events (they come from code),
 * and not names the closed rule refuses, so no field can only produce refusals.
 */
export function inspectorFields<P extends { name: string; kind: string }>(
  props: readonly P[]
): P[] {
  return props.filter(
    (prop) => prop.kind !== 'slot' && prop.kind !== 'event' && !refusedPropName(prop.name)
  );
}

export function createBuilderHistory(initial = EMPTY_BLUEPRINT) {
  return createEditHistory(initial, {
    validate(tree) {
      const limits = validateCatalogTreeLimits(tree);
      return { ok: limits.ok && idsAllowed(tree), diagnostics: limits.diagnostics };
    },
  });
}

export function duplicateJsonKeys(text: string): string[] {
  const keys: string[] = [];
  const path: string[] = [];
  let index = 0;
  const whitespace = () => {
    while (/\s/.test(text[index] ?? '')) index += 1;
  };
  const string = (): string | null => {
    const start = index;
    if (text[index] !== '"') return null;
    index += 1;
    while (index < text.length) {
      if (text[index] === '\\') index += 2;
      else if (text[index++] === '"') {
        try {
          return JSON.parse(text.slice(start, index)) as string;
        } catch {
          return null;
        }
      }
    }
    return null;
  };
  const value = (): void => {
    whitespace();
    if (text[index] === '{') {
      index += 1;
      const seen = new Set<string>();
      whitespace();
      while (index < text.length && text[index] !== '}') {
        whitespace();
        const key = string();
        if (key === null) return;
        if (seen.has(key)) keys.push([...path, key].join('.'));
        seen.add(key);
        whitespace();
        if (text[index++] !== ':') return;
        path.push(key);
        value();
        path.pop();
        whitespace();
        if (text[index] !== ',') break;
        index += 1;
      }
      if (text[index] === '}') index += 1;
    } else if (text[index] === '[') {
      index += 1;
      while (index < text.length && text[index] !== ']') {
        value();
        whitespace();
        if (text[index] !== ',') break;
        index += 1;
      }
      if (text[index] === ']') index += 1;
    } else if (text[index] === '"') {
      string();
    } else {
      while (index < text.length && !/[\s,}\]]/.test(text[index] ?? '')) index += 1;
    }
  };
  value();
  return keys;
}
