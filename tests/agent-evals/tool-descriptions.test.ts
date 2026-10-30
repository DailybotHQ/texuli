// @vitest-environment node
/**
 * The tool-description lint (T-agent-evals): agent-facing text is product.
 * An agent picks a tool from its title, description and input schema alone,
 * so every operation must say what it returns, state its limits, describe
 * every argument, bound every argument, close its schema and carry a worked
 * example. The test fails with the full list of offenders.
 */
import { describe, expect, it } from 'vitest';
import { createMcpHandler } from '../../packages/tools/src/mcp/handler.ts';
import {
  type JsonSchema,
  type Operation,
  TEXULI_OPERATIONS,
  texuliOps,
  validateJson,
} from '../../packages/tools/src/ops/index.ts';

/** Summary bounds: long enough to choose by, short enough to scan in a list of tools. */
const SUMMARY_MIN = 80;
const SUMMARY_MAX = 400;
/** What a door shows (summary plus limits, or an alias's pointer): hosts truncate long descriptions. */
const DESCRIPTION_MAX = 1024;
const TITLE_MAX = 60;
const PROPERTY_DESCRIPTION_MIN = 10;

/** Words that sell instead of inform. */
const MARKETING =
  /\b(powerful|seamless(ly)?|effortless(ly)?|blazing|amazing|awesome|best-in-class|world-class|cutting-edge|revolutionary|robust|simply|just works|magic(al)?|delightful|beautiful(ly)?|lightning)\b/iu;

/** Every property schema of an input, with its path (nested declared properties included). */
function properties(schema: JsonSchema, path = '$'): [string, JsonSchema][] {
  return Object.entries(schema.properties ?? {}).flatMap(([name, property]) => [
    [`${path}.${name}`, property] as [string, JsonSchema],
    ...properties(property, `${path}.${name}`),
  ]);
}

/** Every object schema that declares properties: each must be closed. */
function declaredObjects(schema: JsonSchema, path = '$'): [string, JsonSchema][] {
  const own: [string, JsonSchema][] = schema.properties ? [[path, schema]] : [];
  const nested = Object.entries(schema.properties ?? {}).flatMap(([name, property]) =>
    declaredObjects(property, `${path}.${name}`)
  );
  const items = schema.items ? declaredObjects(schema.items, `${path}[]`) : [];
  return [...own, ...nested, ...items];
}

const typesOf = (schema: JsonSchema): string[] =>
  schema.type === undefined
    ? []
    : Array.isArray(schema.type)
      ? [...schema.type]
      : [schema.type as string];

/** One sentence per problem in an input schema: descriptions, bounds and closure. */
function inputOffences(input: JsonSchema): string[] {
  const offences: string[] = [];
  if (input.type !== 'object') offences.push('input is not an object schema');
  for (const [path, schema] of declaredObjects(input))
    if (schema.additionalProperties !== false)
      offences.push(`${path} is open (additionalProperties is not false)`);
  for (const [path, property] of properties(input)) {
    if ((property.description ?? '').trim().length < PROPERTY_DESCRIPTION_MIN)
      offences.push(`${path} has no description`);
    const types = typesOf(property);
    const closedValue = property.enum !== undefined || property.const !== undefined;
    if (
      types.includes('string') &&
      !closedValue &&
      property.maxLength === undefined &&
      property.pattern === undefined
    )
      offences.push(`${path} is an unbounded string (no maxLength, pattern or enum)`);
    if (types.includes('array') && property.maxItems === undefined)
      offences.push(`${path} is an unbounded array (no maxItems)`);
    if ((types.includes('integer') || types.includes('number')) && !closedValue) {
      if (property.minimum === undefined || property.maximum === undefined)
        offences.push(`${path} is an unbounded number (needs minimum and maximum)`);
      else if (!(property.description ?? '').includes(String(property.maximum)))
        offences.push(`${path}'s description does not state its maximum (${property.maximum})`);
    }
  }
  return offences;
}

/** Every problem of one operation, prefixed with its name. */
function operationOffences(operation: Operation): string[] {
  const offences: string[] = [];
  const { summary, title, limits } = operation;
  if (summary.length < SUMMARY_MIN || summary.length > SUMMARY_MAX)
    offences.push(`summary is ${summary.length} characters (${SUMMARY_MIN}–${SUMMARY_MAX})`);
  if (!/\breturns?\b/iu.test(summary)) offences.push('summary does not say what it returns');
  if (MARKETING.test(summary))
    offences.push(`summary uses a marketing word ("${MARKETING.exec(summary)?.[0]}")`);
  if (title.length === 0 || title.length > TITLE_MAX)
    offences.push(`title is ${title.length} characters (1–${TITLE_MAX})`);
  if (title !== title.trim() || /\.$/u.test(title)) offences.push('title is not a bare phrase');

  // The description a door shows states every limit the registry enforces.
  const description = texuliOps.describe(operation.name) ?? '';
  if (description.length > DESCRIPTION_MAX)
    offences.push(`description is ${description.length} characters (max ${DESCRIPTION_MAX})`);
  const stated = [`input up to ${limits.inputBytes} bytes`, `${limits.timeMs} ms budget`];
  if (limits.items !== undefined) stated.push(`at most ${limits.items} items`);
  for (const limit of stated)
    if (!description.includes(limit)) offences.push(`description does not state "${limit}"`);

  // A list the input accepts or a page it returns is capped by limits.items.
  for (const [path, property] of properties(operation.input)) {
    const cap = typesOf(property).includes('array')
      ? property.maxItems
      : path === '$.limit'
        ? property.maximum
        : undefined;
    if (cap === undefined) continue;
    if (limits.items === undefined)
      offences.push(`${path} is capped at ${cap} but limits.items is not set`);
    else if (cap > limits.items)
      offences.push(`${path} allows ${cap}, over limits.items (${limits.items})`);
  }

  offences.push(...inputOffences(operation.input));
  if (operation.output.type !== 'object') offences.push('output is not an object schema');

  if (operation.examples.length === 0) offences.push('has no worked example');
  for (const example of operation.examples) {
    if (example.title.trim() === '') offences.push('an example has no title');
    for (const issue of validateJson(operation.input, example.input))
      offences.push(`example "${example.title}" is invalid input: ${issue.message}`);
  }
  return offences.map((offence) => `${operation.name}: ${offence}`);
}

describe('tool descriptions an agent chooses by', () => {
  it('every operation states what it returns, its limits, described and bounded arguments, a closed schema and an example', () => {
    expect(TEXULI_OPERATIONS.length).toBeGreaterThan(0);
    expect(TEXULI_OPERATIONS.flatMap(operationOffences)).toEqual([]);
  });

  it('every deprecated alias a door still lists has a described, bounded, closed input and points at its operations', () => {
    const offences = texuliOps.aliases().flatMap((alias) => {
      const description = texuliOps.describe(alias.name) ?? '';
      const own = [
        ...(description.length > DESCRIPTION_MAX
          ? [`description is ${description.length} characters (max ${DESCRIPTION_MAX})`]
          : []),
        ...alias.targets
          .filter((target) => !description.includes(target))
          .map((target) => `description does not name ${target}`),
        ...(description.includes(`removed in ${alias.removeIn}`)
          ? []
          : ['description does not say when it is removed']),
        ...inputOffences(texuliOps.inputSchema(alias.name) as JsonSchema),
      ];
      return own.map((offence) => `${alias.name}: ${offence}`);
    });
    expect(offences).toEqual([]);
  });

  it('serves exactly the registry text on tools/list, so the lint covers what agents read', async () => {
    const handle = createMcpHandler({ mode: 'stateless', runtimes: ['edge', 'node'] });
    const answer = (await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' })) as unknown as {
      result: {
        tools: { name: string; title?: string; description: string; inputSchema: unknown }[];
      };
    };
    const tools = answer.result.tools;
    expect(tools.length).toBe(TEXULI_OPERATIONS.length + texuliOps.aliases().length);
    for (const tool of tools) {
      expect(tool.description, tool.name).toBe(texuliOps.describe(tool.name));
      expect(tool.inputSchema, tool.name).toEqual(texuliOps.inputSchema(tool.name));
      const operation = texuliOps.get(tool.name);
      if (operation) expect(tool.title, tool.name).toBe(operation.title);
    }
  });
});
