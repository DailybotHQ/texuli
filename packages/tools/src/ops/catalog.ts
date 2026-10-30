import { buildCatalog, type CatalogBuild } from '@texuli/catalog/build';
import { validateCatalogManifest, validateCatalogManifests } from '@texuli/catalog/manifest';
import { ALL_MANIFEST_GROUPS } from '@texuli/catalog/manifests/all';
import { defineOperation } from './registry.ts';
import type { JsonSchema } from './schema.ts';
import { type Operation, OperationError } from './types.ts';

/** Default and largest page of catalog and example results. */
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

const READ_ONLY = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: false,
} as const;

let cached: Promise<CatalogBuild> | undefined;

/**
 * The built, content-addressed catalog from the static manifest list of
 * `@texuli/catalog/manifests/all` (edge-safe; same hash as file-system
 * discovery). Built once per process or isolate.
 */
export function loadOpsCatalog(): Promise<CatalogBuild> {
  cached ??= buildCatalog(ALL_MANIFEST_GROUPS);
  return cached;
}

const limitSchema: JsonSchema = {
  type: 'integer',
  minimum: 1,
  maximum: MAX_LIMIT,
  default: DEFAULT_LIMIT,
  description: `How many results to return (1 to ${MAX_LIMIT}, default ${DEFAULT_LIMIT}).`,
};
const tierSchema: JsonSchema = {
  type: 'string',
  enum: ['developer', 'untrusted'],
  description:
    'Keep only components this emit tier may place: untrusted is what agent output may use; developer is app-authored code.',
};
const componentId: JsonSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 128,
  pattern: '^[a-z0-9][a-z0-9-]*$',
  description: 'A catalog component id, e.g. "card" (find ids with catalog.search).',
};
const manifestSchema: JsonSchema = {
  type: 'object',
  description:
    'A candidate catalog manifest (id, package, label, summary, tier, props, examples …).',
};
const diagnosticsSchema: JsonSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      jsonPath: { type: 'string' },
      message: { type: 'string' },
      hint: { type: 'string' },
    },
    required: ['code', 'jsonPath', 'message'],
  },
};

const validManifestExample = {
  id: 'notice-card',
  package: 'texuli',
  label: 'Notice card',
  summary: 'A sample content card.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Show a short notice.'],
  dontUseWhen: ['Application navigation.'],
  a11y: 'Keep the heading descriptive.',
  props: [{ name: 'title', kind: 'string' }],
  examples: [{ id: 'basic', title: 'Basic', props: { title: 'Hello' } }],
};

const queryText = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim().toLowerCase() : undefined;

export const catalogSearch: Operation = defineOperation({
  name: 'catalog.search',
  title: 'Search the component catalog',
  summary:
    'Search the built, content-addressed Texuli component catalog by text, group and emit tier. Returns the catalog hash and file name, the match count and one summary per component (id, package, label, summary, tier, group, emit tiers).',
  input: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 200,
        description: 'Text to match against component ids, labels and summaries.',
      },
      group: {
        type: 'string',
        maxLength: 64,
        description: 'An exact manifest group id, e.g. "display" or "forms".',
      },
      tier: tierSchema,
      limit: limitSchema,
    },
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      hash: { type: 'string', pattern: '^[0-9a-f]{64}$' },
      fileName: { type: 'string' },
      total: { type: 'integer', minimum: 0 },
      limit: { type: 'integer' },
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            package: { type: 'string' },
            label: { type: 'string' },
            summary: { type: 'string' },
            tier: { type: 'string' },
            group: { type: 'string' },
            emit: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'package', 'label', 'summary', 'tier', 'group', 'emit'],
        },
      },
    },
    required: ['hash', 'fileName', 'total', 'entries', 'limit'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: 4096, items: MAX_LIMIT, timeMs: 5000 },
  examples: [
    { title: 'Cards an agent may place', input: { query: 'card', tier: 'untrusted', limit: 5 } },
    { title: 'Every form component', input: { group: 'forms' } },
  ],
  async handler(input) {
    const query = queryText(input.query);
    const group = typeof input.group === 'string' ? input.group : undefined;
    const tier = input.tier as 'developer' | 'untrusted' | undefined;
    const limit = (input.limit as number | undefined) ?? DEFAULT_LIMIT;
    const built = await loadOpsCatalog();
    const filtered = built.catalog.entries.filter((entry) => {
      if (group && entry.group !== group) return false;
      if (tier && !entry.emit.includes(tier)) return false;
      if (query && !`${entry.id} ${entry.label} ${entry.summary}`.toLowerCase().includes(query))
        return false;
      return true;
    });
    return {
      hash: built.hash,
      fileName: built.fileName,
      total: filtered.length,
      entries: filtered.slice(0, limit).map((entry) => ({
        id: entry.id,
        package: entry.package,
        label: entry.label,
        summary: entry.summary,
        tier: entry.tier,
        group: entry.group,
        emit: entry.emit,
      })),
      limit,
    };
  },
});

export const catalogValidate: Operation = defineOperation({
  name: 'catalog.validate',
  title: 'Validate catalog manifests',
  summary:
    'Validate one candidate catalog manifest, or a set (which also catches duplicate ids), without writing files. Returns valid and a list of diagnostics, each with a code, a JSONPath, a message and a hint.',
  input: {
    type: 'object',
    properties: {
      manifest: manifestSchema,
      manifests: {
        type: 'array',
        maxItems: 500,
        items: manifestSchema,
        description: 'A candidate manifest set (at most 500).',
      },
    },
    additionalProperties: false,
    $comment: 'Exactly one of manifest or manifests.',
  },
  output: {
    type: 'object',
    properties: { valid: { type: 'boolean' }, diagnostics: diagnosticsSchema },
    required: ['valid', 'diagnostics'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: 1_000_000, items: 500, timeMs: 5000 },
  examples: [
    { title: 'One manifest', input: { manifest: validManifestExample } },
    {
      title: 'A set with a duplicate id',
      input: { manifests: [validManifestExample, validManifestExample] },
    },
  ],
  handler(input) {
    const hasManifest = Object.hasOwn(input, 'manifest');
    if (hasManifest === Object.hasOwn(input, 'manifests'))
      throw new OperationError(
        'invalid-input',
        'Provide exactly one of "manifest" or "manifests".'
      );
    return hasManifest
      ? validateCatalogManifest(input.manifest)
      : validateCatalogManifests(input.manifests as unknown[]);
  },
});

export const componentGet: Operation = defineOperation({
  name: 'component.get',
  title: 'Read a component manifest',
  summary:
    'Read one component manifest from the catalog: its props with kinds and schemas, events, examples, useWhen and dontUseWhen guidance, accessibility notes and the emit tiers that may place it.',
  input: {
    type: 'object',
    properties: { id: componentId },
    required: ['id'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      component: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          package: { type: 'string' },
          group: { type: 'string' },
          emit: { type: 'array', items: { type: 'string' } },
          props: { type: 'array' },
          examples: { type: 'array' },
        },
        required: ['id', 'package', 'group', 'emit', 'props', 'examples'],
      },
    },
    required: ['component'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: 1024, timeMs: 5000 },
  examples: [{ title: 'The card manifest', input: { id: 'card' } }],
  async handler(input) {
    const id = input.id as string;
    const entry = (await loadOpsCatalog()).catalog.entries.find((item) => item.id === id);
    if (!entry)
      throw new OperationError(
        'not-found',
        `Unknown component "${id}". Search with catalog.search first.`
      );
    return { component: entry };
  },
});

export const exampleSearch: Operation = defineOperation({
  name: 'example.search',
  title: 'Find component examples',
  summary:
    'Find worked manifest examples (props an agent can copy) by component id and/or example id, or search their titles and descriptions. Returns the match count and each example with its component id and package.',
  input: {
    type: 'object',
    properties: {
      componentId,
      exampleId: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        description: 'An exact example id within the component, e.g. "basic".',
      },
      query: {
        type: 'string',
        maxLength: 200,
        description: 'Text to match against example ids, titles and descriptions.',
      },
      limit: limitSchema,
    },
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      total: { type: 'integer', minimum: 0 },
      limit: { type: 'integer' },
      examples: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            componentId: { type: 'string' },
            package: { type: 'string' },
            example: { type: 'object' },
          },
          required: ['componentId', 'package', 'example'],
        },
      },
    },
    required: ['total', 'examples', 'limit'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: 4096, items: MAX_LIMIT, timeMs: 5000 },
  examples: [
    { title: 'Every card example', input: { componentId: 'card' } },
    { title: 'Examples about pricing', input: { query: 'pricing', limit: 5 } },
  ],
  async handler(input) {
    const componentIdValue = input.componentId as string | undefined;
    const exampleId = input.exampleId as string | undefined;
    const query = queryText(input.query);
    const limit = (input.limit as number | undefined) ?? DEFAULT_LIMIT;
    const entries = (await loadOpsCatalog()).catalog.entries;
    const component = componentIdValue
      ? entries.find((entry) => entry.id === componentIdValue)
      : undefined;
    if (componentIdValue && !component)
      throw new OperationError(
        'not-found',
        `Unknown component "${componentIdValue}". Search with catalog.search first.`
      );
    const examples = (component ? [component] : entries).flatMap((entry) =>
      entry.examples
        .filter((example) => !exampleId || example.id === exampleId)
        .filter(
          (example) =>
            !query ||
            `${example.id} ${example.title} ${example.description ?? ''}`
              .toLowerCase()
              .includes(query)
        )
        .map((example) => ({ componentId: entry.id, package: entry.package, example }))
    );
    return { total: examples.length, examples: examples.slice(0, limit), limit };
  },
});
