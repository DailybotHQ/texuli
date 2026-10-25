import type { CatalogPropKind, CatalogPropSchema } from '../../manifest/types.ts';
import type { RenderDiagnostic, RenderIssueCode } from './types.ts';

/** Props that must never pass through from untrusted (or any) catalog trees. */
export const FORBIDDEN_PROP_NAMES = new Set([
  'class',
  'className',
  'style',
  'styles',
  'css',
  'html',
  'innerHTML',
  'outerHTML',
  'dangerouslySetInnerHTML',
  '__html',
]);

/**
 * Detects string values that look like HTML markup (tags), which the
 * sink-free renderer must never forward to the host.
 */
export function looksLikeHtmlString(value: string): boolean {
  // `<tag`, `</tag`, or HTML comments — not bare `<` in math copy.
  return /<\/?[a-zA-Z!]/.test(value) || /&lt;\/?[a-zA-Z!]/.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function kindMatches(kind: CatalogPropKind, value: unknown): boolean {
  switch (kind) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'enum':
      return typeof value === 'string';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isPlainObject(value);
    case 'slot':
      // Slots are host-only; agents must not supply them.
      return false;
    case 'event':
      // Events are host callbacks; never from the tree.
      return false;
    case 'unknown':
      return (
        value === null ||
        ['string', 'number', 'boolean'].includes(typeof value) ||
        Array.isArray(value) ||
        isPlainObject(value)
      );
    default:
      return false;
  }
}

export interface PropSanitizeResult {
  /** Clean props bag, or `null` when the node must be dropped. */
  props: Readonly<Record<string, unknown>> | null;
  diagnostics: RenderDiagnostic[];
}

/**
 * Strips forbidden keys, validates remaining props against the schema, and
 * refuses HTML-like strings. Schema failures return `props: null` (drop node).
 */
export function sanitizeProps(
  raw: Readonly<Record<string, unknown>> | undefined,
  schemas: readonly CatalogPropSchema[],
  path: string,
  id: string
): PropSanitizeResult {
  const diagnostics: RenderDiagnostic[] = [];
  const note = (code: RenderIssueCode, message: string) => {
    diagnostics.push({ code, path, message, id });
  };

  const byName = new Map(schemas.map((schema) => [schema.name, schema]));
  const out: Record<string, unknown> = {};
  const source = raw ?? {};

  for (const key of Object.keys(source)) {
    if (FORBIDDEN_PROP_NAMES.has(key)) {
      note('forbidden-prop', `Prop "${key}" is never passed through.`);
      continue;
    }
    if (!byName.has(key)) {
      // Unknown keys are dropped (not a full schema failure — catalog evolves).
      note('invalid-prop', `Unknown prop "${key}" was dropped.`);
    }
  }

  for (const schema of schemas) {
    const { name, kind, required, enumValues } = schema;
    if (FORBIDDEN_PROP_NAMES.has(name)) {
      // Schema should not declare these; ignore if present.
      continue;
    }
    if (kind === 'slot' || kind === 'event') {
      // Never accept from the tree.
      if (Object.hasOwn(source, name) && source[name] !== undefined) {
        note('invalid-prop', `Prop "${name}" (${kind}) cannot come from a catalog tree.`);
      }
      continue;
    }

    if (!Object.hasOwn(source, name) || source[name] === undefined) {
      if (required) {
        note('missing-required', `Required prop "${name}" is missing.`);
        return { props: null, diagnostics };
      }
      continue;
    }

    const value = source[name];

    if (typeof value === 'string' && looksLikeHtmlString(value)) {
      note('html-string', `Prop "${name}" looks like an HTML string and was refused.`);
      return { props: null, diagnostics };
    }

    if (!kindMatches(kind, value)) {
      note(
        'schema-failure',
        `Prop "${name}" expected kind "${kind}" (got ${describeType(value)}).`
      );
      return { props: null, diagnostics };
    }

    if (kind === 'enum') {
      const allowed = enumValues ?? [];
      if (typeof value !== 'string' || !allowed.includes(value)) {
        note(
          'schema-failure',
          `Prop "${name}" must be one of: ${allowed.join(', ') || '(empty enum)'}.`
        );
        return { props: null, diagnostics };
      }
    }

    // Deep-freeze plain JSON data only (no functions / symbols).
    out[name] = freezeJson(value);
  }

  return { props: Object.freeze(out), diagnostics };
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Structured clone of JSON-safe values; non-JSON becomes null (caller already typed). */
function freezeJson(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeJson(item)));
  }
  if (isPlainObject(value)) {
    const copy: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_PROP_NAMES.has(key)) continue;
      if (typeof entry === 'function' || typeof entry === 'symbol') continue;
      if (typeof entry === 'string' && looksLikeHtmlString(entry)) continue;
      copy[key] = freezeJson(entry);
    }
    return Object.freeze(copy);
  }
  return null;
}
