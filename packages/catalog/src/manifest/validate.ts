import { manifestData } from './data.ts';
import type {
  CatalogDeprecation,
  CatalogEventName,
  CatalogExample,
  CatalogManifest,
  CatalogPropKind,
  CatalogPropSchema,
  CatalogTier,
  ManifestDiagnostic,
  ManifestPath,
  ManifestValidation,
} from './types.ts';

const TIERS = new Set<CatalogTier>(['app', 'content']);
const PROP_KINDS = new Set<CatalogPropKind>([
  'string',
  'number',
  'boolean',
  'enum',
  'array',
  'object',
  'slot',
  'event',
  'unknown',
]);
const TRUST = new Set(['developer', 'untrusted']);

/** The closed event vocabulary (spec 0.3.0 `SPEC_EVENT_NAMES`). */
export const CATALOG_EVENT_NAMES: readonly CatalogEventName[] = Object.freeze([
  'press',
  'change',
  'select',
  'submit',
  'dismiss',
  'move',
]);

/** The contract `$defs` a property schema may `$ref` (spec 0.3.0 `SPEC_PROP_REFS`). */
export const CATALOG_SCHEMA_REFS: readonly string[] = Object.freeze([
  'binding',
  'reorder',
  'action',
  'eventMap',
  'condition',
  'workflowGraph',
  'document',
  // Spec 0.8.0 (ADR-015): a closed form schema, checked again by @texuli/forms/model.
  'formSchema',
  // Spec 0.8.0 (ADR-012): a canvas, checked again by the host's validateCanvas.
  'canvas',
  // Spec 0.8.0 (ADR-015): a sheet, checked again by the host's validateSheet (formulas included).
  'sheet',
]);

const SCHEMA_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean']);
const SCHEMA_KEYS = new Set([
  'type',
  'description',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'minItems',
  'maxItems',
  '$ref',
]);
const SCHEMA_NUMBERS = ['minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems'];
const MAX_SCHEMA_DEPTH = 16;
const SPEC_VERSION_RE = /^\d+\.\d+\.\d+$/;

/**
 * Structural check of a property schema: the dialect subset, closed keys,
 * a type wherever there is no `$ref`, a `$ref` that names a contract
 * `$defs` entry and stands alone. `@texuli/spec` conformance runs the full
 * dialect check on the projected catalog.
 */
function schemaProblems(raw: unknown, path: ManifestPath[], depth = 0): [ManifestPath[], string][] {
  if (!isRecord(raw)) return [[path, 'A schema must be an object.']];
  if (depth > MAX_SCHEMA_DEPTH) return [[path, `Schemas nest at most ${MAX_SCHEMA_DEPTH} levels.`]];
  const out: [ManifestPath[], string][] = [];
  for (const key of Object.keys(raw)) {
    if (!SCHEMA_KEYS.has(key)) out.push([[...path, key], `"${key}" is not a schema keyword.`]);
  }
  if (raw.$ref !== undefined) {
    const name =
      typeof raw.$ref === 'string' ? /^#\/\$defs\/([A-Za-z]+)$/.exec(raw.$ref)?.[1] : undefined;
    if (name === undefined || !CATALOG_SCHEMA_REFS.includes(name)) {
      out.push([[...path, '$ref'], '$ref must name a contract $defs entry (#/$defs/<name>).']);
    }
    if (Object.keys(raw).some((key) => key !== '$ref' && key !== 'description')) {
      out.push([path, '$ref stands alone (only a description may sit beside it).']);
    }
    return out;
  }
  if (typeof raw.type !== 'string' || !SCHEMA_TYPES.has(raw.type)) {
    out.push([[...path, 'type'], 'A schema needs a type (or a $ref).']);
  }
  for (const key of SCHEMA_NUMBERS) {
    if (raw[key] !== undefined && (typeof raw[key] !== 'number' || !Number.isFinite(raw[key]))) {
      out.push([[...path, key], `"${key}" must be a finite number.`]);
    }
  }
  if (
    raw.enum !== undefined &&
    (!Array.isArray(raw.enum) || !raw.enum.every((v) => typeof v === 'string'))
  ) {
    out.push([[...path, 'enum'], '"enum" must list strings.']);
  }
  if (
    raw.required !== undefined &&
    (!Array.isArray(raw.required) || !raw.required.every((v) => typeof v === 'string'))
  ) {
    out.push([[...path, 'required'], '"required" must list property names.']);
  }
  if (raw.properties !== undefined) {
    if (!isRecord(raw.properties))
      out.push([[...path, 'properties'], '"properties" must be an object.']);
    else {
      for (const [name, child] of Object.entries(raw.properties)) {
        out.push(...schemaProblems(child, [...path, 'properties', name], depth + 1));
      }
    }
  }
  if (raw.items !== undefined)
    out.push(...schemaProblems(raw.items, [...path, 'items'], depth + 1));
  if (raw.additionalProperties !== undefined) {
    out.push(
      ...schemaProblems(raw.additionalProperties, [...path, 'additionalProperties'], depth + 1)
    );
  }
  return out;
}

function deprecationProblem(raw: unknown): string | undefined {
  if (!isRecord(raw) || typeof raw.since !== 'string' || !SPEC_VERSION_RE.test(raw.since)) {
    return 'deprecated needs { since: "<x.y.z>", replacement? }.';
  }
  if (Object.keys(raw).some((key) => key !== 'since' && key !== 'replacement')) {
    return 'deprecated takes only since and replacement.';
  }
  if (
    raw.replacement !== undefined &&
    (typeof raw.replacement !== 'string' || raw.replacement === '')
  ) {
    return 'deprecated.replacement must be a non-empty string.';
  }
  return undefined;
}

/**
 * The authored-manifest schema version this validator understands. A
 * manifest may declare `"schemaVersion": 1`; any other value is refused
 * with a `schema-version` diagnostic, so a future schema change fails
 * loudly instead of misreading old data. The field never reaches the built
 * catalog (see `buildCatalog`), which keeps the content address identical
 * whether an author declares it or omits it.
 */
export const MANIFEST_SCHEMA_VERSION = 1;

/** Component ids and example ids: lowercase kebab-case. */
const ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** Prop names: lower camelCase. */
const PROP_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;
/** Package names: unscoped `texuli` or `@texuli/<name>`. */
const PACKAGE_RE = /^(texuli|@texuli\/[a-z][a-z0-9-]*)$/;

const MAX_SUMMARY = 240;
const MAX_LABEL = 80;
const MAX_A11Y = 1_000;
const MAX_GUIDANCE = 280;
const MAX_USE_WHEN = 12;
const MAX_PROPS = 64;
const MAX_EXAMPLES = 24;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function jsonPathOf(path: ManifestPath[]): string {
  if (path.length === 0) return '$';
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) return `${acc}.${segment}`;
    return `${acc}[${JSON.stringify(segment)}]`;
  }, '$');
}

function issue(
  diagnostics: ManifestDiagnostic[],
  code: string,
  path: ManifestPath[],
  message: string,
  hint: string
): void {
  diagnostics.push({ code, path, jsonPath: jsonPathOf(path), message, hint });
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function readStringList(
  value: unknown,
  path: ManifestPath[],
  diagnostics: ManifestDiagnostic[],
  field: string,
  opts: { min?: number; maxItems?: number; maxItemLength?: number; required?: boolean } = {}
): string[] | undefined {
  const { min = 0, maxItems = MAX_USE_WHEN, maxItemLength = MAX_GUIDANCE, required = true } = opts;
  if (value === undefined || value === null) {
    if (required) {
      issue(
        diagnostics,
        'missing-field',
        path,
        `Missing "${field}".`,
        `Add a non-empty "${field}" array of short guidance strings.`
      );
    }
    return undefined;
  }
  if (!Array.isArray(value)) {
    issue(
      diagnostics,
      'invalid-type',
      path,
      `"${field}" must be an array of strings.`,
      `Use a JSON array of plain strings for "${field}".`
    );
    return undefined;
  }
  if (value.length < min) {
    issue(
      diagnostics,
      'too-few',
      path,
      `"${field}" needs at least ${min} item(s) (got ${value.length}).`,
      `Add more "${field}" entries.`
    );
  }
  if (value.length > maxItems) {
    issue(
      diagnostics,
      'too-many',
      path,
      `"${field}" has ${value.length} items (max ${maxItems}).`,
      `Trim "${field}" to ${maxItems} or fewer.`
    );
  }
  const out: string[] = [];
  value.forEach((item, i) => {
    if (typeof item !== 'string' || item.trim() === '') {
      issue(
        diagnostics,
        'invalid-item',
        [...path, i],
        `"${field}[${i}]" must be a non-empty string.`,
        'Replace empty or non-string items with plain guidance text.'
      );
      return;
    }
    const trimmed = item.trim();
    if (trimmed.length > maxItemLength) {
      issue(
        diagnostics,
        'too-long',
        [...path, i],
        `"${field}[${i}]" is ${trimmed.length} characters (max ${maxItemLength}).`,
        'Shorten the guidance line.'
      );
    }
    out.push(trimmed);
  });
  return out;
}

function readA11y(
  value: unknown,
  path: ManifestPath[],
  diagnostics: ManifestDiagnostic[]
): string | string[] | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      issue(
        diagnostics,
        'missing-field',
        path,
        'Missing "a11y".',
        'Describe keyboard, SR and contrast notes.'
      );
      return undefined;
    }
    if (trimmed.length > MAX_A11Y) {
      issue(
        diagnostics,
        'too-long',
        path,
        `"a11y" is ${trimmed.length} characters (max ${MAX_A11Y}).`,
        'Shorten the accessibility notes.'
      );
    }
    return trimmed;
  }
  return readStringList(value, path, diagnostics, 'a11y', {
    min: 1,
    maxItems: 16,
    maxItemLength: MAX_A11Y,
  });
}

function validateProp(
  raw: unknown,
  path: ManifestPath[],
  diagnostics: ManifestDiagnostic[],
  seenNames: Set<string>
): CatalogPropSchema | undefined {
  if (!isRecord(raw)) {
    issue(
      diagnostics,
      'invalid-type',
      path,
      'Each prop must be an object.',
      'Use a prop schema object.'
    );
    return undefined;
  }
  const name = asNonEmptyString(raw.name);
  if (!name) {
    issue(
      diagnostics,
      'missing-field',
      [...path, 'name'],
      'Prop is missing "name".',
      'Set a camelCase prop name.'
    );
  } else if (!PROP_NAME_RE.test(name)) {
    issue(
      diagnostics,
      'invalid-id',
      [...path, 'name'],
      `Prop name "${name}" must be lower camelCase.`,
      'Rename to camelCase (e.g. open, defaultValue).'
    );
  } else if (seenNames.has(name)) {
    issue(
      diagnostics,
      'duplicate-prop',
      [...path, 'name'],
      `Duplicate prop name "${name}".`,
      'Prop names must be unique on one manifest.'
    );
  } else {
    seenNames.add(name);
  }

  const kindRaw = asNonEmptyString(raw.kind);
  if (!kindRaw || !PROP_KINDS.has(kindRaw as CatalogPropKind)) {
    issue(
      diagnostics,
      'invalid-kind',
      [...path, 'kind'],
      `Prop kind must be one of: ${[...PROP_KINDS].join(', ')}.`,
      'Pick a closed prop kind from the CatalogPropKind set.'
    );
  }
  const kind = (kindRaw as CatalogPropKind) ?? 'unknown';

  if (kind === 'enum') {
    if (!Array.isArray(raw.enumValues) || raw.enumValues.length === 0) {
      issue(
        diagnostics,
        'enum-values-required',
        [...path, 'enumValues'],
        'Enum props require a non-empty "enumValues" array.',
        'List every allowed string value.'
      );
    } else {
      raw.enumValues.forEach((v, i) => {
        if (typeof v !== 'string' || v.trim() === '') {
          issue(
            diagnostics,
            'invalid-item',
            [...path, 'enumValues', i],
            'enumValues entries must be non-empty strings.',
            'Use plain string tokens.'
          );
        }
      });
    }
  } else if (raw.enumValues !== undefined) {
    issue(
      diagnostics,
      'enum-values-unexpected',
      [...path, 'enumValues'],
      '"enumValues" is only valid when kind is "enum".',
      'Remove enumValues or set kind to "enum".'
    );
  }

  if (raw.trust !== undefined) {
    if (typeof raw.trust !== 'string' || !TRUST.has(raw.trust)) {
      issue(
        diagnostics,
        'invalid-trust',
        [...path, 'trust'],
        'trust must be "developer" or "untrusted".',
        'Match the core URL policy tiers.'
      );
    }
  }

  if (raw.required !== undefined && typeof raw.required !== 'boolean') {
    issue(
      diagnostics,
      'invalid-type',
      [...path, 'required'],
      '"required" must be a boolean when set.',
      'Use true or false.'
    );
  }

  if (raw.description !== undefined && typeof raw.description !== 'string') {
    issue(
      diagnostics,
      'invalid-type',
      [...path, 'description'],
      '"description" must be a string when set.',
      'Use a short plain-string description.'
    );
  }

  if (raw.schema !== undefined) {
    if (kind !== 'array' && kind !== 'object') {
      issue(
        diagnostics,
        'schema-unexpected',
        [...path, 'schema'],
        'Only array and object props take a schema.',
        'Remove the schema or change the kind.'
      );
    } else {
      for (const [where, message] of schemaProblems(raw.schema, [...path, 'schema'])) {
        issue(
          diagnostics,
          'invalid-schema',
          where,
          message,
          'Use the spec property-schema subset.'
        );
      }
    }
  }
  if (raw.deprecated !== undefined) {
    const problem = deprecationProblem(raw.deprecated);
    if (problem) {
      issue(
        diagnostics,
        'invalid-deprecated',
        [...path, 'deprecated'],
        problem,
        'Name the spec version.'
      );
    }
  }

  if (!name || !kindRaw || !PROP_KINDS.has(kindRaw as CatalogPropKind)) return undefined;

  const prop: CatalogPropSchema = {
    name,
    kind,
    ...(typeof raw.required === 'boolean' ? { required: raw.required } : {}),
    ...(typeof raw.description === 'string' ? { description: raw.description.trim() } : {}),
    ...(kind === 'enum' && Array.isArray(raw.enumValues)
      ? {
          enumValues: raw.enumValues
            .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
            .map((v) => v.trim()),
        }
      : {}),
    ...(raw.default !== undefined ? { default: raw.default } : {}),
    ...(typeof raw.trust === 'string' && TRUST.has(raw.trust)
      ? { trust: raw.trust as 'developer' | 'untrusted' }
      : {}),
    ...(isRecord(raw.schema) ? { schema: raw.schema as CatalogPropSchema['schema'] } : {}),
    ...(isRecord(raw.deprecated)
      ? { deprecated: raw.deprecated as unknown as CatalogDeprecation }
      : {}),
  };
  return prop;
}

function validateExample(
  raw: unknown,
  path: ManifestPath[],
  diagnostics: ManifestDiagnostic[],
  propNames: ReadonlySet<string>,
  seenExampleIds: Set<string>
): CatalogExample | undefined {
  if (!isRecord(raw)) {
    issue(
      diagnostics,
      'invalid-type',
      path,
      'Each example must be an object.',
      'Use an example object.'
    );
    return undefined;
  }
  const id = asNonEmptyString(raw.id);
  if (!id) {
    issue(
      diagnostics,
      'missing-field',
      [...path, 'id'],
      'Example is missing "id".',
      'Set a kebab-case example id.'
    );
  } else if (!ID_RE.test(id)) {
    issue(
      diagnostics,
      'invalid-id',
      [...path, 'id'],
      `Example id "${id}" must be kebab-case.`,
      'Use lowercase letters, digits and single hyphens.'
    );
  } else if (seenExampleIds.has(id)) {
    issue(
      diagnostics,
      'duplicate-example',
      [...path, 'id'],
      `Duplicate example id "${id}".`,
      'Example ids must be unique within one manifest.'
    );
  } else {
    seenExampleIds.add(id);
  }

  const title = asNonEmptyString(raw.title);
  if (!title) {
    issue(
      diagnostics,
      'missing-field',
      [...path, 'title'],
      'Example is missing "title".',
      'Add a short title.'
    );
  }

  if (raw.description !== undefined && typeof raw.description !== 'string') {
    issue(
      diagnostics,
      'invalid-type',
      [...path, 'description'],
      'Example description must be a string when set.',
      'Use plain text.'
    );
  }

  if (!isRecord(raw.props)) {
    issue(
      diagnostics,
      'missing-field',
      [...path, 'props'],
      'Example is missing a "props" object.',
      'Provide the props bag the example would pass.'
    );
    return undefined;
  }

  for (const key of Object.keys(raw.props)) {
    if (!propNames.has(key)) {
      issue(
        diagnostics,
        'unknown-prop',
        [...path, 'props', key],
        `Example props include unknown key "${key}".`,
        'Every example prop key must appear in the manifest props list.'
      );
    }
  }

  if (!id || !title || !ID_RE.test(id)) return undefined;

  return {
    id,
    title,
    ...(typeof raw.description === 'string' && raw.description.trim()
      ? { description: raw.description.trim() }
      : {}),
    props: raw.props,
  };
}

/**
 * Validate one authored catalog manifest. Safe for untrusted JSON input:
 * never throws on shape alone; returns diagnostics.
 */
export function validateCatalogManifest(input: unknown): ManifestValidation {
  const diagnostics: ManifestDiagnostic[] = [];

  if (!isRecord(input)) {
    issue(
      diagnostics,
      'invalid-type',
      [],
      'Manifest must be a plain object.',
      'Export a CatalogManifest object or JSON object.'
    );
    return { valid: false, diagnostics };
  }

  const id = asNonEmptyString(input.id);
  if (!id) {
    issue(
      diagnostics,
      'missing-field',
      ['id'],
      'Missing "id".',
      'Set a unique kebab-case component id.'
    );
  } else if (!ID_RE.test(id)) {
    issue(
      diagnostics,
      'invalid-id',
      ['id'],
      `id "${id}" must be kebab-case (e.g. dialog, data-grid).`,
      'Use lowercase letters, digits and single hyphens.'
    );
  }

  const pkg = asNonEmptyString(input.package);
  if (!pkg) {
    issue(
      diagnostics,
      'missing-field',
      ['package'],
      'Missing "package".',
      'Set the owning package (texuli or @texuli/<name>).'
    );
  } else if (!PACKAGE_RE.test(pkg)) {
    issue(
      diagnostics,
      'invalid-package',
      ['package'],
      `package "${pkg}" must be "texuli" or "@texuli/<name>".`,
      'Point at a Texuli workspace package name.'
    );
  }

  const label = asNonEmptyString(input.label);
  if (!label) {
    issue(diagnostics, 'missing-field', ['label'], 'Missing "label".', 'Add a short display name.');
  } else if (label.length > MAX_LABEL) {
    issue(
      diagnostics,
      'too-long',
      ['label'],
      `label is ${label.length} characters (max ${MAX_LABEL}).`,
      'Shorten the label.'
    );
  }

  const summary = asNonEmptyString(input.summary);
  if (!summary) {
    issue(
      diagnostics,
      'missing-field',
      ['summary'],
      'Missing "summary".',
      'Add a one-line summary.'
    );
  } else if (summary.length > MAX_SUMMARY) {
    issue(
      diagnostics,
      'too-long',
      ['summary'],
      `summary is ${summary.length} characters (max ${MAX_SUMMARY}).`,
      'Shorten the summary.'
    );
  }

  const tierRaw = asNonEmptyString(input.tier);
  if (!tierRaw || !TIERS.has(tierRaw as CatalogTier)) {
    issue(
      diagnostics,
      'invalid-tier',
      ['tier'],
      'tier must be "app" or "content".',
      'Use "app" for chrome and "content" for agent-facing blocks.'
    );
  }
  const tier = (tierRaw as CatalogTier) ?? 'app';

  if (input.schemaVersion !== undefined && input.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    issue(
      diagnostics,
      'schema-version',
      ['schemaVersion'],
      `"schemaVersion" must be ${MANIFEST_SCHEMA_VERSION} (the current manifest schema version).`,
      `Write the number ${MANIFEST_SCHEMA_VERSION}, or omit the field: omitted means the current version.`
    );
  }

  if (input.agentEmittable !== undefined && typeof input.agentEmittable !== 'boolean') {
    issue(
      diagnostics,
      'invalid-type',
      ['agentEmittable'],
      'agentEmittable must be a boolean when set (default false).',
      'Omit the field or set true/false explicitly.'
    );
  }
  const agentEmittable = input.agentEmittable === true;

  const useWhen =
    readStringList(input.useWhen, ['useWhen'], diagnostics, 'useWhen', { min: 1 }) ?? [];
  const dontUseWhen =
    readStringList(input.dontUseWhen, ['dontUseWhen'], diagnostics, 'dontUseWhen', {
      min: 0,
      required: true,
    }) ?? [];

  // Contradictory guidance: the same line in both lists.
  const useSet = new Set(useWhen.map((s) => s.toLowerCase()));
  dontUseWhen.forEach((line, i) => {
    if (useSet.has(line.toLowerCase())) {
      issue(
        diagnostics,
        'contradiction',
        ['dontUseWhen', i],
        `Guidance appears in both useWhen and dontUseWhen: "${line}".`,
        'Keep useWhen and dontUseWhen disjoint.'
      );
    }
  });

  const a11y = readA11y(input.a11y, ['a11y'], diagnostics);

  if (!Array.isArray(input.props)) {
    issue(
      diagnostics,
      'missing-field',
      ['props'],
      'Missing "props" array (may be empty for pure layout shells).',
      'Declare the public props list, or [].'
    );
  } else if (input.props.length > MAX_PROPS) {
    issue(
      diagnostics,
      'too-many',
      ['props'],
      `props has ${input.props.length} entries (max ${MAX_PROPS}).`,
      'Split the component or trim the public surface.'
    );
  }

  const seenPropNames = new Set<string>();
  const props: CatalogPropSchema[] = [];
  if (Array.isArray(input.props)) {
    input.props.forEach((item, i) => {
      const prop = validateProp(item, ['props', i], diagnostics, seenPropNames);
      if (prop) props.push(prop);
    });
  }

  if (!Array.isArray(input.examples)) {
    issue(
      diagnostics,
      'missing-field',
      ['examples'],
      'Missing "examples" array.',
      'Add at least one example when agentEmittable is true; otherwise [].'
    );
  } else if (input.examples.length > MAX_EXAMPLES) {
    issue(
      diagnostics,
      'too-many',
      ['examples'],
      `examples has ${input.examples.length} entries (max ${MAX_EXAMPLES}).`,
      'Keep a small gallery set.'
    );
  }

  const seenExampleIds = new Set<string>();
  const examples: CatalogExample[] = [];
  if (Array.isArray(input.examples)) {
    input.examples.forEach((item, i) => {
      const example = validateExample(
        item,
        ['examples', i],
        diagnostics,
        seenPropNames,
        seenExampleIds
      );
      if (example) examples.push(example);
    });
  }

  if (agentEmittable) {
    if (useWhen.length === 0) {
      issue(
        diagnostics,
        'agent-requires-use-when',
        ['useWhen'],
        'agentEmittable components need non-empty useWhen.',
        'Tell agents when to pick this component.'
      );
    }
    if (examples.length === 0) {
      issue(
        diagnostics,
        'agent-requires-examples',
        ['examples'],
        'agentEmittable components need at least one example.',
        'Add a minimal valid example props bag.'
      );
    }
    if (a11y === undefined) {
      issue(
        diagnostics,
        'agent-requires-a11y',
        ['a11y'],
        'agentEmittable components need a11y notes.',
        'Document keyboard, names and contrast.'
      );
    }
    // Content tier is the default home for emittable pieces; app+emittable is allowed
    // only when the author is explicit (e.g. a simple Button). Flag empty dontUseWhen
    // on emittable app chrome as incomplete, not forbidden.
    if (tier === 'app' && dontUseWhen.length === 0) {
      issue(
        diagnostics,
        'app-emittable-needs-guardrails',
        ['dontUseWhen'],
        'agentEmittable app-tier components need dontUseWhen guardrails.',
        'Say when agents must not emit this chrome (e.g. prefer content blocks).'
      );
    }
  }

  if (input.related !== undefined) {
    if (!Array.isArray(input.related)) {
      issue(
        diagnostics,
        'invalid-type',
        ['related'],
        '"related" must be an array of component ids when set.',
        'List related kebab-case ids.'
      );
    } else {
      input.related.forEach((item, i) => {
        if (typeof item !== 'string' || !ID_RE.test(item)) {
          issue(
            diagnostics,
            'invalid-id',
            ['related', i],
            'related entries must be kebab-case component ids.',
            'Match other manifest ids.'
          );
        }
        if (typeof item === 'string' && id && item === id) {
          issue(
            diagnostics,
            'self-related',
            ['related', i],
            'related must not include this component id.',
            'Remove the self-reference.'
          );
        }
      });
    }
  }

  // Events, bindable props and deprecation (spec 0.3.0).
  if (input.events !== undefined) {
    if (!Array.isArray(input.events)) {
      issue(
        diagnostics,
        'invalid-type',
        ['events'],
        '"events" must be an array.',
        'List event names.'
      );
    } else {
      const seen = new Set<string>();
      input.events.forEach((event, i) => {
        if (typeof event !== 'string' || !CATALOG_EVENT_NAMES.includes(event as CatalogEventName)) {
          issue(
            diagnostics,
            'invalid-event',
            ['events', i],
            `Events are one of ${CATALOG_EVENT_NAMES.join(', ')}.`,
            'Use the closed event vocabulary.'
          );
        } else if (seen.has(event)) {
          issue(
            diagnostics,
            'duplicate-event',
            ['events', i],
            `Event "${event}" repeats.`,
            'List it once.'
          );
        }
        if (typeof event === 'string') seen.add(event);
      });
    }
  }
  if (input.bindable !== undefined) {
    const props = Array.isArray(input.props) ? input.props.filter(isRecord) : [];
    if (!Array.isArray(input.bindable)) {
      issue(
        diagnostics,
        'invalid-type',
        ['bindable'],
        '"bindable" must be an array.',
        'List prop names.'
      );
    } else {
      input.bindable.forEach((name, i) => {
        const prop = props.find((candidate) => candidate.name === name);
        const portable =
          prop !== undefined &&
          !['slot', 'event', 'unknown'].includes(String(prop.kind)) &&
          !['class', 'className', 'style', 'renderer'].includes(String(name));
        if (!portable) {
          issue(
            diagnostics,
            'invalid-bindable',
            ['bindable', i],
            `"${String(name)}" is not a portable data prop of this component.`,
            'Bindable props are declared props of a data kind.'
          );
        }
      });
    }
  }
  if (input.sourceable !== undefined) {
    const props = Array.isArray(input.props) ? input.props.filter(isRecord) : [];
    if (!Array.isArray(input.sourceable) || input.sourceable.length > 8) {
      issue(
        diagnostics,
        'invalid-type',
        ['sourceable'],
        '"sourceable" must be an array of at most 8 prop names.',
        'List array prop names.'
      );
    } else {
      input.sourceable.forEach((name, i) => {
        const prop = props.find((candidate) => candidate.name === name);
        if (prop === undefined || prop.kind !== 'array') {
          issue(
            diagnostics,
            'invalid-sourceable',
            ['sourceable', i],
            `"${String(name)}" is not an array prop of this component.`,
            'Sourceable props are declared array props whose items are rows.'
          );
        }
      });
    }
  }
  if (input.deprecated !== undefined) {
    const problem = deprecationProblem(input.deprecated);
    if (problem)
      issue(diagnostics, 'invalid-deprecated', ['deprecated'], problem, 'Name the spec version.');
  }

  // Unknown top-level keys are rejected so typos fail build validation.
  const allowed = new Set([
    'id',
    'package',
    'label',
    'summary',
    'tier',
    'schemaVersion',
    'agentEmittable',
    'useWhen',
    'dontUseWhen',
    'a11y',
    'props',
    'examples',
    'related',
    'events',
    'bindable',
    'sourceable',
    'deprecated',
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      issue(
        diagnostics,
        'unknown-field',
        [key],
        `Unknown field "${key}".`,
        'Remove the field or use a documented CatalogManifest key.'
      );
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

/**
 * Validate a closed list of manifests. Also rejects duplicate ids across the
 * list (the catalog is content-addressed by id).
 */
export function validateCatalogManifests(inputs: readonly unknown[]): ManifestValidation {
  const diagnostics: ManifestDiagnostic[] = [];
  const seen = new Map<string, number>();

  inputs.forEach((input, i) => {
    const result = validateCatalogManifest(input);
    for (const d of result.diagnostics) {
      diagnostics.push({
        ...d,
        path: [i, ...d.path],
        jsonPath: jsonPathOf([i, ...d.path]),
      });
    }
    if (isRecord(input) && typeof input.id === 'string' && ID_RE.test(input.id)) {
      const prev = seen.get(input.id);
      if (prev !== undefined) {
        issue(
          diagnostics,
          'duplicate-id',
          [i, 'id'],
          `Duplicate catalog id "${input.id}" (also at index ${prev}).`,
          'Component ids must be unique in the closed catalog.'
        );
      } else {
        seen.set(input.id, i);
      }
    }
  });

  return { valid: diagnostics.length === 0, diagnostics };
}

/**
 * Apply defaults and return a frozen manifest when validation passes.
 * Throws {@link CatalogManifestError} when invalid.
 */
export function defineCatalogManifest(input: unknown): Readonly<CatalogManifest> {
  const result = validateCatalogManifest(input);
  if (!result.valid || !isRecord(input)) {
    throw new CatalogManifestError(result.diagnostics);
  }

  return manifestData(input as unknown as CatalogManifest);
}

/** Error thrown by {@link defineCatalogManifest} with structured diagnostics. */
export class CatalogManifestError extends Error {
  readonly diagnostics: readonly ManifestDiagnostic[];

  constructor(diagnostics: readonly ManifestDiagnostic[]) {
    const first = diagnostics[0];
    super(
      first
        ? `Invalid catalog manifest at ${first.jsonPath}: ${first.message}`
        : 'Invalid catalog manifest'
    );
    this.name = 'CatalogManifestError';
    this.diagnostics = diagnostics;
  }
}

/** Type guard: true when validation succeeds (does not freeze). */
export function isCatalogManifest(input: unknown): input is CatalogManifest {
  return validateCatalogManifest(input).valid;
}
