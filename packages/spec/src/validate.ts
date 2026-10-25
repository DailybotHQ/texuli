import type {
  SpecDiagnostic,
  SpecDiagnosticCode,
  SpecValidation,
} from '../generated/typescript/diagnostics.ts';
import type { SpecCatalog, SpecComponent } from './catalog.ts';
import { isRecord, type Schema, validateInstance } from './dialect.ts';

export type { SpecDiagnostic, SpecDiagnosticCode, SpecValidation };

export interface SpecDocuments {
  blueprintSchema: Schema;
  catalog: SpecCatalog;
}

const MAX_TREE_DEPTH = 64;

/**
 * Validate a blueprint envelope against the spec alone: the envelope schema,
 * then every node against the catalog vocabulary (closed ids, closed prop
 * names, prop kinds and enum values, required props, no platform-extension
 * props from data, a `slot` that names a slot prop of the parent) and the
 * declared profile. A `when` condition is checked for shape only; the
 * runtime formula parser checks its operands. With `catalogHash`, an envelope
 * bound to another catalog is refused. This is the shared, target-neutral
 * contract; URL policy, limits, grammar and rendering stay in the runtime
 * validators (`@texuli/catalog/validate`).
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
  const portable = input.profile === 'portable';
  if (isRecord(input.tree)) {
    diagnostics.push(...validateTree(input.tree, documents.catalog, { portable, path: '$.tree' }));
  }
  return { ok: diagnostics.length === 0, diagnostics };
}

/** Check one catalog tree against the vocabulary. See {@link validateBlueprint}. */
export function validateTree(
  tree: unknown,
  catalog: SpecCatalog,
  options: { portable?: boolean; path?: string } = {}
): SpecDiagnostic[] {
  const byId = new Map<string, SpecComponent>(catalog.components.map((c) => [c.id, c]));
  const out: SpecDiagnostic[] = [];
  const visit = (
    node: unknown,
    path: string,
    depth: number,
    parent: SpecComponent | null | undefined
  ): void => {
    if (!isRecord(node) || typeof node.id !== 'string' || depth > MAX_TREE_DEPTH) return;
    checkSlot(node.slot, parent, node.id, path, out);
    const component = byId.get(node.id);
    if (!component) {
      out.push({
        code: 'unknown-id',
        path: `${path}.id`,
        id: node.id,
        message: `"${node.id}" is not in the catalog.`,
      });
    } else {
      if (options.portable && component.capability !== 'portable-core') {
        out.push({
          code: 'unsupported-profile',
          path,
          id: node.id,
          message: `"${node.id}" is ${component.capability}, not portable core.`,
        });
      }
      checkProps(node.props, component, `${path}.props`, out);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, index) => {
        visit(child, `${path}.children[${index}]`, depth + 1, component);
      });
    }
  };
  visit(tree, options.path ?? '$', 0, null);
  return out;
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

function checkProps(
  props: unknown,
  component: SpecComponent,
  path: string,
  out: SpecDiagnostic[]
): void {
  const given = isRecord(props) ? props : {};
  const id = component.id;
  const declared = new Map(component.props.map((p) => [p.name, p]));
  for (const [name, value] of Object.entries(given)) {
    const here = `${path}.${name}`;
    const prop = declared.get(name);
    if (!prop) {
      out.push({ code: 'unknown-prop', path: here, id, message: `"${id}" has no "${name}" prop.` });
      continue;
    }
    if (prop.extension) {
      out.push({
        code: 'extension-prop',
        path: here,
        id,
        message: `"${name}" is a ${prop.extension} extension (${prop.kind}) and cannot come from data.`,
      });
      continue;
    }
    const kindOk =
      prop.kind === 'string' || prop.kind === 'enum'
        ? typeof value === 'string'
        : prop.kind === 'number'
          ? typeof value === 'number' && Number.isFinite(value)
          : prop.kind === 'boolean'
            ? typeof value === 'boolean'
            : prop.kind === 'array'
              ? Array.isArray(value)
              : prop.kind === 'object'
                ? isRecord(value)
                : false;
    if (!kindOk) {
      out.push({ code: 'prop-type', path: here, id, message: `"${name}" must be ${prop.kind}.` });
    } else if (prop.kind === 'enum' && !(prop.enumValues ?? []).includes(value as string)) {
      out.push({
        code: 'enum-value',
        path: here,
        id,
        message: `"${name}" must be one of ${(prop.enumValues ?? []).join(', ')}.`,
      });
    }
  }
  for (const prop of component.props) {
    if (prop.required && !prop.extension && !Object.hasOwn(given, prop.name)) {
      out.push({
        code: 'missing-required',
        path: `${path}.${prop.name}`,
        id,
        message: `"${id}" needs "${prop.name}".`,
      });
    }
  }
}
