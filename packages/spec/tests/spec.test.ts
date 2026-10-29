// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENVELOPE_STATUSES, MAX_PROVENANCE, MAX_SOURCES } from '@texuli/catalog/envelope';
import { describe, expect, it } from 'vitest';
import { projectLiveCatalog } from '../scripts/bootstrap-catalog.ts';
import { buildSpec, EXTERNAL_SCHEMAS, KOTLIN_OUT, TS_OUT } from '../src/build.ts';
import { canonicalJson, sha256 } from '../src/canonical.ts';
import type { SpecCatalog } from '../src/catalog.ts';
import { kotlinString } from '../src/codegen/kotlin.ts';
import { checkConformance } from '../src/conformance.ts';
import {
  ACTION_FIELDS,
  DATA_BINDING_KEY,
  SPEC_ACTION_OPS,
  SPEC_EVENT_NAMES,
  SPEC_LIMITS,
  SPEC_PATTERNS,
  SPEC_PROP_REFS,
  SPEC_STATE_TYPES,
  STATE_BINDING_KEY,
  STATE_FIELDS,
} from '../src/contract.ts';
import { checkSchemaDocument, DIALECT_URI, type Schema, validateInstance } from '../src/dialect.ts';
import { formatJson } from '../src/format.ts';
import * as root from '../src/index.ts';
import {
  migrateBlueprint,
  SPEC_MIGRATIONS,
  UNDECLARED_SPEC_VERSION,
} from '../src/migrations/index.ts';
import { validateBlueprint } from '../src/validate.ts';
import { SPEC_VERSION } from '../src/version.ts';
import {
  checkVersionHistory,
  nextSpecVersion,
  type SpecVersionHistory,
} from '../src/versioning.ts';
import { validateWorkflowGraph } from '../src/workflow.ts';
import { build, committedOutputs, json, normative } from './helpers.ts';

/**
 * The spec harness: canonical JSON and hashing, the closed schema dialect,
 * deterministic TypeScript and Kotlin codegen, parity with the web packages,
 * conformance (regenerate-and-diff, golden and invalid fixtures) and the
 * digest-pinned versioning policy.
 */

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);
const committed = committedOutputs();

describe('canonical JSON and sha256', () => {
  it('matches the FIPS 180-4 vectors and hashes UTF-8 bytes across block boundaries', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
    // Two-, three- and four-byte UTF-8 sequences (reference: Node's crypto).
    expect(sha256('é漢字🙂')).toBe(
      'a4d09b21932f5c1f1dfb5d788e8e9e797dcb9a78ab5d4ce76803154078be0313'
    );
    expect(new Set(['x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64)].map(sha256)).size).toBe(3);
  });

  it('sorts keys, refuses inexact values and formats like the repository formatter', () => {
    expect(canonicalJson({ b: [1, { d: 1, c: undefined }], a: 'x' })).toBe(
      '{"a":"x","b":[1,{"d":1}]}'
    );
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => canonicalJson(cycle)).toThrow(/cycle/);
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalJson({ f: () => 1 })).toThrow(/function/);
    expect(formatJson({ b: ['x', 'y'], a: { c: [] } })).toBe(
      '{\n  "a": {\n    "c": []\n  },\n  "b": ["x", "y"]\n}\n'
    );
    const long = Array.from({ length: 30 }, (_, i) => `item-${i}`);
    // `{`, the key line, 30 items, `]`, `}` and the final newline.
    expect(formatJson({ long }).split('\n').length).toBe(35);
  });
});

describe('the closed dialect', () => {
  it('accepts every committed schema and refuses keywords, open objects, refs and dialects', () => {
    const schemas = Object.keys(normative).filter((p) => p.startsWith('schemas/'));
    expect(schemas).toHaveLength(6);
    // The pinned document schema is @texuli/document's export: pinned, not in the dialect.
    expect(EXTERNAL_SCHEMAS).toEqual(['schemas/document.schema.json']);
    const dialect = schemas.filter((path) => !EXTERNAL_SCHEMAS.includes(path));
    expect(dialect).toHaveLength(5);
    for (const path of dialect) expect(checkSchemaDocument(json(path)), path).toEqual([]);
    expect(checkSchemaDocument(json('schemas/document.schema.json')).length).toBeGreaterThan(0);
    const base = { $schema: DIALECT_URI };
    expect(codes(checkSchemaDocument({ ...base, type: 'string', format: 'email' }))).toEqual([
      'unsupported-keyword',
    ]);
    expect(codes(checkSchemaDocument({ ...base, oneOf: [] }))).toEqual(['unsupported-keyword']);
    expect(codes(checkSchemaDocument({ ...base, type: 'object', properties: {} }))).toEqual([
      'open-object',
    ]);
    expect(codes(checkSchemaDocument({ ...base, $ref: 'https://example.com/x.json' }))).toEqual([
      'bad-ref',
    ]);
    expect(
      codes(checkSchemaDocument({ $schema: 'http://json-schema.org/draft-07/schema#' }))
    ).toEqual(['dialect']);
    expect(
      codes(
        checkSchemaDocument({
          ...base,
          type: 'object',
          properties: { a: {} },
          required: ['b'],
          additionalProperties: false,
        })
      )
    ).toEqual(['bad-required']);
  });

  it('validates instances with paths and treats a parsed __proto__ key as a refused field', () => {
    const schema: Schema = {
      type: 'object',
      properties: {
        id: { type: 'string', pattern: '^[a-z]+$', maxLength: 5 },
        count: { type: 'integer', minimum: 0 },
        tags: { type: 'array', maxItems: 2, items: { $ref: '#/$defs/tag' } },
        meta: { type: 'object', additionalProperties: { type: 'boolean' } },
      },
      required: ['id'],
      additionalProperties: false,
      $defs: { tag: { type: 'string', enum: ['a', 'b'] } },
    };
    expect(
      validateInstance(schema, { id: 'abc', count: 2, tags: ['a'], meta: { x: true } })
    ).toEqual([]);
    const issues = validateInstance(schema, {
      id: 'ABCDEFG',
      count: 1.5,
      tags: ['c'],
      meta: { x: 'yes' },
      extra: 1,
    });
    expect(issues.map((i) => `${i.path} ${i.code}`)).toEqual([
      '$.id max-length',
      '$.id pattern',
      '$.count type',
      '$.tags[0] enum',
      '$.meta.x type',
      '$.extra additional-property',
    ]);
    expect(codes(validateInstance(schema, {}))).toEqual(['required']);
    expect(codes(validateInstance(schema, { id: 'a', tags: ['a', 'b', 'a'] }))).toEqual([
      'max-items',
    ]);
    const proto = JSON.parse('{"id":"a","__proto__":{"admin":true}}');
    expect(codes(validateInstance(schema, proto))).toEqual(['additional-property']);
  });
});

describe('deterministic generation', () => {
  it('is byte-identical for any input order, emits every projection and stamps no timestamp', () => {
    expect(buildSpec(normative)).toEqual(build);
    const shuffled = Object.fromEntries(Object.entries(normative).reverse());
    expect(buildSpec(shuffled)).toEqual(build);
    expect(Object.keys(build.generated)).toEqual([
      `${KOTLIN_OUT}Blueprint.kt`,
      `${KOTLIN_OUT}CatalogSchema.kt`,
      `${KOTLIN_OUT}Diagnostics.kt`,
      `${KOTLIN_OUT}Json.kt`,
      `${KOTLIN_OUT}Manifest.kt`,
      `${KOTLIN_OUT}Vocabulary.kt`,
      `${KOTLIN_OUT}Workflow.kt`,
      `${TS_OUT}blueprint.ts`,
      `${TS_OUT}catalog-schema.ts`,
      `${TS_OUT}diagnostics.ts`,
      `${TS_OUT}manifest.ts`,
      `${TS_OUT}vocabulary.ts`,
      `${TS_OUT}workflow.ts`,
    ]);
    for (const [path, text] of Object.entries(build.generated)) {
      expect(text, path).toContain(
        `// Spec ${build.stamp.specVersion}, digest ${build.stamp.specDigest}`
      );
      // The generator stamps no build time: the header carries version and digest
      // only (manifest examples may legitimately hold ISO dates in the body).
      const header = text.split('\n').slice(0, 3).join('\n');
      expect(header, path).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    }
  });

  it('moves the digest on a normative change and refuses schemas outside the dialect', () => {
    const next = buildSpec({ ...normative, 'catalog/capabilities.json': '{ }\n' });
    expect(next.stamp.specDigest).not.toBe(build.stamp.specDigest);
    expect(next.manifest).not.toBe(build.manifest);
    const schema = JSON.parse(normative['schemas/diagnostics.schema.json'] as string);
    schema.properties.ok = { type: 'boolean', format: 'flag' };
    expect(() =>
      buildSpec({ ...normative, 'schemas/diagnostics.schema.json': JSON.stringify(schema) })
    ).toThrow(/not in the spec dialect/);
    expect(() => buildSpec({ ...normative, 'notes/x.json': '{}' })).toThrow(/not a normative/);
  });
});

const kotlin = Object.entries(build.generated).filter(([path]) => path.startsWith(KOTLIN_OUT));

/** Code with string literals and comments blanked, for structure checks (one pass). */
function code(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === '//') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (two === '/*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else if (text[i] === '"') {
      i += 1;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      i += 1;
      out += '""';
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

describe('generated Kotlin (text artifacts; no Kotlin toolchain here)', () => {
  it('is well formed, defines every type it references, decodes closed and escapes strings', () => {
    expect(kotlin).toHaveLength(7);
    for (const [path, text] of kotlin) {
      expect(text, path).toContain('\npackage com.texuli.spec\n');
      expect(text, path).not.toContain('\t');
      const body = code(text);
      for (const [open, close] of [
        ['{', '}'],
        ['(', ')'],
        ['[', ']'],
      ] as const) {
        expect(body.split(open).length, `${path} ${open}`).toBe(body.split(close).length);
      }
      // Every data class rejects unknown fields.
      const classes = text.match(/^data class /gm)?.length ?? 0;
      const closed = text.match(/fields\.requireOnly\(FIELDS, path\)/g)?.length ?? 0;
      expect(closed, `${path} closed decoding`).toBe(classes);
    }
    const all = kotlin.map(([, text]) => code(text)).join('\n');
    const defined = new Set(
      [...all.matchAll(/(?:class|interface|object|typealias)\s+([A-Z][A-Za-z0-9]*)/g)].map(
        (m) => m[1]
      )
    );
    const builtins = new Set([
      'String',
      'Long',
      'Double',
      'Boolean',
      'List',
      'Map',
      'Set',
      'IllegalArgumentException',
      'JsonValue',
      'Str',
      'Num',
      'Bool',
      'Arr',
      'Obj',
      'Null',
    ]);
    for (const [, name] of all.matchAll(/:\s*([A-Z][A-Za-z0-9]*)/g)) {
      expect(defined.has(name as string) || builtins.has(name as string), name).toBe(true);
    }
    expect(kotlinString('Say "hi" for $5\\n')).toBe('"Say \\"hi\\" for \\$5\\\\n"');
    // `$state` and `$data` are wire names, never Kotlin string templates.
    const blueprintKt = build.generated[`${KOTLIN_OUT}Blueprint.kt`] as string;
    expect(blueprintKt).toContain('fields["\\$state"]');
    expect(blueprintKt).toContain('"$path.\\$state"');
    const codeLines = blueprintKt.split('\n').filter((line) => !/^\s*(\/\*\*|\*)/.test(line));
    expect(codeLines.join('\n')).not.toMatch(/[^\\]\$(state|data)\b/);
    const names = [
      ...all.matchAll(/(?:^|\n)(?:data class|enum class|typealias)\s+([A-Z]\w*)/g),
    ].map((m) => m[1]);
    expect(new Set(names).size, 'generated Kotlin type names are unique').toBe(names.length);
  });
});

/**
 * Drift between the spec and the shipped web packages is a failed gate.
 * Refresh with `pnpm exec tsx packages/spec/scripts/bootstrap-catalog.ts`
 * and `pnpm exec tsx packages/spec/scripts/generate.ts`, then review the diff.
 */
describe('parity with the web packages', () => {
  it('projects the live catalog, matches the envelope and marks web-only props', async () => {
    const catalog = json<SpecCatalog>('catalog/components.json');
    expect(catalog).toEqual(await projectLiveCatalog());
    const schema = json<{
      $defs: { status: { enum: string[] } };
      properties: { sources: { maxItems: number }; provenance: { maxItems: number } };
    }>('schemas/blueprint.schema.json');
    expect(schema.$defs.status.enum).toEqual([...ENVELOPE_STATUSES]);
    expect(schema.properties.sources.maxItems).toBe(MAX_SOURCES);
    expect(schema.properties.provenance.maxItems).toBe(MAX_PROVENANCE);
    for (const prop of catalog.components.flatMap((c) => c.props)) {
      const webOnly =
        ['slot', 'event', 'unknown'].includes(prop.kind) ||
        ['class', 'className', 'style', 'renderer'].includes(prop.name);
      expect(prop.extension === 'web', `${prop.name} (${prop.kind})`).toBe(webOnly);
    }
  });
});

describe('conformance harness', () => {
  it('passes on the committed spec and catches edited, missing, extra and stale outputs', () => {
    expect(checkConformance(normative, committed)).toEqual([]);
    expect(committed['manifest.json']).toBe(build.manifest);
    const tsPath = 'generated/typescript/blueprint.ts';
    const edited = { ...committed, [tsPath]: `${committed[tsPath]}// edited\n` };
    expect(checkConformance(normative, edited).map((i) => `${i.check} ${i.path}`)).toEqual([
      `generated ${tsPath}`,
    ]);
    const { [tsPath]: _gone, ...missing } = committed;
    expect(checkConformance(normative, missing)[0]?.message).toBe('missing');
    const extra = { ...committed, 'generated/kotlin/com/texuli/spec/Stray.kt': '' };
    expect(checkConformance(normative, extra)[0]?.message).toMatch(/no generator/);
    // A normative file changed without regenerating.
    const changed = { ...normative, 'catalog/capabilities.json': '{}\n\n' };
    const checks = new Set(checkConformance(changed, committed).map((i) => i.check));
    expect(checks.has('manifest')).toBe(true);
    expect(checks.has('generated')).toBe(true);
    // An unaudited or unknown capability claim.
    const claimed = { ...normative, 'catalog/capabilities.json': '{"no-such-id":"portable-core"}' };
    expect(checkConformance(claimed, committed).some((i) => i.check === 'capabilities')).toBe(true);
  });

  it('validates the golden blueprints and covers every diagnostic code with an invalid fixture', () => {
    const documents = {
      blueprintSchema: json<Schema>('schemas/blueprint.schema.json'),
      catalog: json<SpecCatalog>('catalog/components.json'),
      workflowSchema: json<Schema>('schemas/workflow.schema.json'),
      validateWorkflowGraph,
    };
    const golden = Object.keys(normative).filter((p) => p.startsWith('fixtures/golden/'));
    expect(golden.sort()).toEqual([
      'fixtures/golden/app-dashboard.json',
      'fixtures/golden/conditional-report.json',
      'fixtures/golden/dashboard.json',
      'fixtures/golden/document-brief.json',
      'fixtures/golden/lego.json',
      'fixtures/golden/mobile-flow.json',
      'fixtures/golden/proactive-deck.json',
      'fixtures/golden/report-on-demand.json',
      'fixtures/golden/sortable-board.json',
      'fixtures/golden/workflow-builder.json',
    ]);
    for (const path of golden) expect(validateBlueprint(json(path), documents).ok, path).toBe(true);
    const covered = new Set(
      Object.keys(normative)
        .filter(
          (p) => p.startsWith('fixtures/invalid/') || p.startsWith('fixtures/workflow/invalid/')
        )
        .flatMap((p) => json<{ expect: string[] }>(p).expect)
    );
    const diagnostics = json<{ $defs: { diagnosticCode: { enum: string[] } } }>(
      'schemas/diagnostics.schema.json'
    );
    expect([...covered].sort()).toEqual([...diagnostics.$defs.diagnosticCode.enum].sort());
    // The slot and condition surface: each fixture refuses with exactly its codes.
    for (const [name, expected] of [
      ['unknown-slot', ['unknown-slot']],
      ['unknown-slot-root', ['unknown-slot']],
      ['condition-unknown-op', ['schema']],
      ['condition-extra-field', ['schema']],
      ['state-declaration', ['state']],
      ['unknown-state', ['unknown-state']],
      ['binding-shape', ['binding']],
      ['unknown-event', ['unknown-event']],
      ['action-fields', ['unknown-event', 'action']],
      ['spec-version', ['schema']],
      // The state surface agrees with the player: list item text, forms, controls and flow nodes.
      ['state-list-text', ['state']],
      ['form-outside', ['action', 'action']],
      ['surface-nodes', ['binding', 'state']],
      // Spec 0.6.0 motion: presets and token steps only (ADR-012, ADR-013).
      ['motion-preset', ['schema']],
      ['motion-raw-css', ['schema']],
      ['motion-duration-ms', ['schema']],
      ['motion-level', ['schema']],
      // Spec 0.7.0: node keys and documents (ADR-011, ADR-012, ADR-014).
      ['duplicate-key', ['duplicate-key']],
      ['node-key', ['schema']],
      ['document-format', ['prop-type']],
      ['document-extra-field', ['prop-type']],
      ['document-patch-op', ['schema']],
    ] as const) {
      const fixture = json<{ expect: string[]; blueprint: unknown }>(
        `fixtures/invalid/${name}.json`
      );
      expect(fixture.expect, name).toEqual(expected);
      const found = validateBlueprint(fixture.blueprint, documents).diagnostics.map((d) => d.code);
      expect(found, name).toEqual(fixture.expect);
    }
    const conditional = JSON.stringify(json('fixtures/golden/conditional-report.json'));
    expect(conditional).toContain('"slot"');
    expect(conditional).toContain('"when"');
    // A portable profile fails closed while no id is audited portable.
    expect(documents.catalog.components.some((c) => c.capability === 'portable-core')).toBe(false);
    const portable = {
      ...json<Record<string, unknown>>('fixtures/golden/report-on-demand.json'),
      profile: 'portable',
    };
    expect(validateBlueprint(portable, documents).diagnostics[0]?.code).toBe('unsupported-profile');
  });
});

describe('the 0.3.0 contract mirrors its schemas', () => {
  it('keeps every exported constant equal to the schema JSON', () => {
    type Defs = Record<string, Schema>;
    const blueprint = json<{ $defs: Defs; properties: Record<string, Schema> }>(
      'schemas/blueprint.schema.json'
    );
    const catalog = json<{ $defs: Defs }>('schemas/catalog.schema.json');
    const workflow = json<{ $defs: Defs; properties: Record<string, Schema> }>(
      'schemas/workflow.schema.json'
    );
    const d = blueprint.$defs;
    const field = (def: string, name: string) => d[def]?.properties?.[name] as Schema;
    expect(field('action', 'op').enum).toEqual([...SPEC_ACTION_OPS]);
    expect(field('stateDeclaration', 'type').enum).toEqual([...SPEC_STATE_TYPES]);
    expect(catalog.$defs.eventName?.enum).toEqual([...SPEC_EVENT_NAMES]);
    expect(Object.keys(d.binding?.properties ?? {})).toEqual([STATE_BINDING_KEY, DATA_BINDING_KEY]);
    // Every op and type field the validator allows is a schema field.
    const actionFields = Object.keys(d.action?.properties ?? {});
    for (const op of SPEC_ACTION_OPS) {
      for (const name of ACTION_FIELDS[op].allowed) expect(actionFields, op).toContain(name);
    }
    const stateFields = Object.keys(d.stateDeclaration?.properties ?? {});
    for (const type of SPEC_STATE_TYPES) {
      for (const name of STATE_FIELDS[type]) expect(stateFields, type).toContain(name);
    }
    const ref = catalog.$defs.propSchema?.properties?.$ref?.pattern ?? '';
    expect(ref).toBe(`^#/\\$defs/(${SPEC_PROP_REFS.join('|')})$`);
    for (const [name, pattern] of [
      ['stateName', SPEC_PATTERNS.stateName],
      ['dataName', SPEC_PATTERNS.dataName],
      ['flowName', SPEC_PATTERNS.flowName],
      ['intentName', SPEC_PATTERNS.intentName],
      ['itemKey', SPEC_PATTERNS.itemKey],
      ['nodeKey', SPEC_PATTERNS.nodeKey],
      ['groupName', SPEC_PATTERNS.groupName],
    ] as const) {
      expect(d[name]?.pattern, name).toBe(pattern);
    }
    expect(workflow.$defs.workflowId?.pattern).toBe(SPEC_PATTERNS.workflowId);
    expect(workflow.$defs.workflowLabel?.pattern).toBe(SPEC_PATTERNS.workflowLabel);
    expect(field('stateDeclaration', 'values').maxItems).toBe(SPEC_LIMITS.enumValues);
    expect(field('stateDeclaration', 'values').items?.maxLength).toBe(SPEC_LIMITS.enumValueLength);
    expect(field('stateDeclaration', 'maxLength').maximum).toBe(SPEC_LIMITS.stringLength);
    expect(field('stateDeclaration', 'maxItems').maximum).toBe(SPEC_LIMITS.listItems);
    expect(field('flow', 'views').maxItems).toBe(SPEC_LIMITS.flowViews);
    expect(field('flow', 'transitions').maxItems).toBe(SPEC_LIMITS.flowTransitions);
    expect(d.eventMap?.additionalProperties).toMatchObject({
      maxItems: SPEC_LIMITS.actionsPerEvent,
    });
    expect(workflow.properties.nodes?.maxItems).toBe(SPEC_LIMITS.workflowNodes);
    expect(workflow.properties.edges?.maxItems).toBe(SPEC_LIMITS.workflowEdges);
    expect(workflow.properties.nodeTypes?.maxItems).toBe(SPEC_LIMITS.workflowNodeTypes);
    expect(workflow.properties.groups?.maxItems).toBe(SPEC_LIMITS.workflowGroups);
    expect(d.document?.properties?.blocks?.maxItems).toBe(SPEC_LIMITS.documentBlocks);
    expect(d.documentPatch?.maxItems).toBe(SPEC_LIMITS.documentPatchOps);
    expect(field('editOp', 'op').enum).toContain('patchDocument');
  });
});

describe('migrations', () => {
  it('migrates 0.2.0 goldens to the current spec purely, idempotently, and leaves the tree alone', () => {
    const documents = {
      blueprintSchema: json<Schema>('schemas/blueprint.schema.json'),
      catalog: json<SpecCatalog>('catalog/components.json'),
    };
    const deepFreeze = <T>(value: T): T => {
      if (value && typeof value === 'object') {
        for (const child of Object.values(value)) deepFreeze(child);
        Object.freeze(value);
      }
      return value;
    };
    const goldens = Object.keys(normative).filter((p) => p.startsWith('fixtures/golden/'));
    // Goldens written for the current spec (they stamp `spec`) are already current: migration is a no-op.
    const current = goldens.filter((p) => json<{ spec?: string }>(p).spec === SPEC_VERSION);
    expect(current.length).toBeGreaterThan(0);
    for (const path of current) {
      const input = deepFreeze(json<Record<string, unknown>>(path));
      const result = migrateBlueprint(input);
      expect(result.applied, path).toEqual([]);
      expect(result.blueprint, path).toBe(input);
    }
    const legacy = goldens.filter((p) => !current.includes(p));
    expect(legacy.length).toBeGreaterThan(0);
    for (const path of legacy) {
      const input = deepFreeze(json<Record<string, unknown>>(path));
      const result = migrateBlueprint(input);
      expect(result, path).toMatchObject({
        from: '0.2.0',
        to: SPEC_VERSION,
        applied: ['0.2.0->0.3.0', '0.3.0->0.4.0', '0.4.0->0.5.0', '0.5.0->0.6.0', '0.6.0->0.7.0'],
      });
      expect(result.blueprint, path).toEqual({ ...input, spec: SPEC_VERSION });
      expect((result.blueprint as { tree: unknown }).tree).toBe(input.tree);
      expect(validateBlueprint(result.blueprint, documents).ok, path).toBe(true);
      const again = migrateBlueprint(result.blueprint);
      expect(again.applied).toEqual([]);
      expect(again.blueprint).toBe(result.blueprint);
    }
    // Not an envelope, an unknown version, a non-string version: passed through untouched.
    for (const input of [null, 'text', [1], { spec: '9.9.9', tree: {} }, { spec: 3 }]) {
      const result = migrateBlueprint(input);
      expect(result.blueprint).toBe(input);
      expect(result.applied).toEqual([]);
    }
    // A parsed __proto__ stays an own key, so validation still refuses it.
    const proto = JSON.parse('{"format":"texuli-blueprint","__proto__":{"admin":true}}');
    const migrated = migrateBlueprint(proto).blueprint as Record<string, unknown>;
    expect(Object.hasOwn(migrated, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(migrated)).toBe(Object.prototype);
    // The chain covers every consecutive pinned pair from the undeclared version.
    const pinned = history.releases.map((r) => r.specVersion);
    const chain = pinned.slice(pinned.indexOf(UNDECLARED_SPEC_VERSION));
    expect(SPEC_MIGRATIONS.map((m) => [m.from, m.to])).toEqual(
      chain.slice(1).map((to, i) => [chain[i], to])
    );
    expect(chain.at(-1)).toBe(SPEC_VERSION);
  });

  it('keeps workflow validation and migrations out of the root, in their own subpaths', () => {
    expect(Object.keys(root)).not.toContain('validateWorkflowGraph');
    expect(Object.keys(root)).not.toContain('migrateBlueprint');
    const { exports } = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    ) as { exports: Record<string, { default: string }> };
    expect(exports['./workflow']?.default).toBe('./src/workflow.ts');
    expect(exports['./migrate']?.default).toBe('./src/migrations/index.ts');
  });
});

/**
 * Digest pinning (Task 147) and the versioning policy (Task 148): every
 * released spec version is pinned to its digest in versions.json, and a
 * normative change without a new version fails here.
 */
// versions.json is not a normative file: it pins the digest of the normative files.
const history = JSON.parse(
  readFileSync(join(import.meta.dirname, '../versions.json'), 'utf8')
) as SpecVersionHistory;

describe('the spec version and digest are pinned', () => {
  it('pins the spec as built now to the newest release and fails unpinned changes', () => {
    expect(SPEC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(build.stamp.specVersion).toBe(SPEC_VERSION);
    expect(checkVersionHistory(history, build.stamp)).toEqual([]);
    expect(history.releases.at(-1)).toMatchObject({
      specVersion: SPEC_VERSION,
      specDigest: build.stamp.specDigest,
    });
    // A normative change that kept the version.
    const changed = { specVersion: SPEC_VERSION, specDigest: 'f'.repeat(64) };
    expect(checkVersionHistory(history, changed).map((i) => i.message)).toEqual([
      expect.stringContaining('changed without a new version'),
    ]);
    // A version bump with no pin.
    const bumped = {
      specVersion: nextSpecVersion(SPEC_VERSION, 'minor'),
      specDigest: 'a'.repeat(64),
    };
    expect(checkVersionHistory(history, bumped)[0]?.message).toContain('the newest release');
  });

  it('applies the versioning policy: next versions, refused histories and a well-formed one', () => {
    for (const [from, change, to] of [
      ['0.2.0', 'patch', '0.2.1'],
      ['0.2.0', 'minor', '0.3.0'],
      ['0.2.0', 'major', '0.3.0'],
      ['1.4.2', 'patch', '1.4.3'],
      ['1.4.2', 'minor', '1.5.0'],
      ['1.4.2', 'major', '2.0.0'],
    ] as const) {
      expect(nextSpecVersion(from, change), `${from} ${change}`).toBe(to);
    }
    const pin = (
      specVersion: string,
      change: string,
      specDigest: string | null = 'b'.repeat(64)
    ) => ({ specVersion, specDigest, change, summary: 'x' });
    const now = { specVersion: '0.3.0', specDigest: 'b'.repeat(64) };
    const refused: ReadonlyArray<[string, ReturnType<typeof pin>[], string]> = [
      [
        'a step that does not match the change class',
        [pin('0.1.0', 'initial', null), pin('0.3.0', 'minor')],
        'is 0.2.0',
      ],
      [
        'a second initial release',
        [pin('0.1.0', 'initial', null), pin('0.3.0', 'initial')],
        'only the first',
      ],
      [
        'a later release without a digest',
        [pin('0.1.0', 'initial', null), pin('0.2.0', 'minor'), pin('0.3.0', 'minor', null)],
        'lack a digest',
      ],
      [
        'a first release that is not initial',
        [pin('0.3.0', 'minor')],
        'must have change "initial"',
      ],
      [
        'a digest that is not SHA-256 hex',
        [pin('0.1.0', 'initial', null), pin('0.2.0', 'minor'), pin('0.3.0', 'minor', 'xyz')],
        'SHA-256',
      ],
    ];
    for (const [label, releases, message] of refused) {
      const issues = checkVersionHistory({ releases } as SpecVersionHistory, now);
      expect(issues.map((i) => i.message).join(' | '), label).toContain(message);
    }
    const releases = [
      pin('0.1.0', 'initial', null),
      pin('0.2.0', 'minor'),
      pin('0.2.1', 'patch'),
      pin('0.3.0', 'major'),
    ];
    expect(checkVersionHistory({ releases } as SpecVersionHistory, now)).toEqual([]);
  });
});
