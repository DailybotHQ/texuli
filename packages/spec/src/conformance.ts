import { buildSpec, EXTERNAL_SCHEMAS } from './build.ts';
import { CAPABILITIES, type SpecCatalog, type SpecDeprecation } from './catalog.ts';
import { checkPropSchema, defCollisions } from './contract.ts';
import { checkSchemaDocument, isRecord, type Schema, validateInstance } from './dialect.ts';
import { type SpecDiagnosticCode, validateBlueprint } from './validate.ts';
import { SPEC_VERSION } from './version.ts';
import { validateWorkflowGraph } from './workflow.ts';

/** One conformance failure: drift is a failed gate, never a warning. */
export interface ConformanceIssue {
  check:
    | 'dialect'
    | 'catalog'
    | 'capabilities'
    | 'manifest'
    | 'generated'
    | 'golden'
    | 'invalid'
    | 'contract'
    | 'prop-schema'
    | 'deprecation'
    | 'workflow';
  path: string;
  message: string;
}

/**
 * Run the spec's conformance harness (spec/Compose design §7.1 and §7.3)
 * over the normative files and the committed outputs (`manifest.json`,
 * `generated-manifest.json` and every generated file):
 * - every schema stays in the dialect (except the pinned `EXTERNAL_SCHEMAS`);
 * - `catalog/components.json` and `catalog/capabilities.json` are valid;
 * - the manifest digests match the normative files;
 * - regenerating gives byte-identical TypeScript and Kotlin, with no file
 *   missing or extra;
 * - every golden blueprint validates, and every invalid fixture fails with
 *   exactly its expected diagnostic codes (blueprints and workflow graphs);
 * - the blueprint and workflow `$defs` stay disjoint, every catalog property
 *   schema is usable (array and object props only, contract `$ref`s only),
 *   bindable props are declared portable props, and no deprecation outlives
 *   its one-minor warning window.
 * Runtime-neutral: the caller reads the files.
 */
export function checkConformance(
  normative: Readonly<Record<string, string>>,
  committed: Readonly<Record<string, string>>
): ConformanceIssue[] {
  const issues: ConformanceIssue[] = [];
  const json = (path: string): unknown => JSON.parse(normative[path] ?? 'null');

  const schemas: Record<string, Schema> = {};
  const dialectSchemas = Object.keys(normative).filter(
    (p) => p.startsWith('schemas/') && !EXTERNAL_SCHEMAS.includes(p)
  );
  for (const path of dialectSchemas) {
    const schema = json(path) as Schema;
    schemas[path] = schema;
    for (const issue of checkSchemaDocument(schema)) {
      issues.push({
        check: 'dialect',
        path,
        message: `${issue.path} ${issue.code}: ${issue.message}`,
      });
    }
  }
  const catalogSchema = schemas['schemas/catalog.schema.json'];
  const blueprintSchema = schemas['schemas/blueprint.schema.json'];
  const workflowSchema = schemas['schemas/workflow.schema.json'];
  if (blueprintSchema) {
    for (const name of defCollisions(blueprintSchema, workflowSchema)) {
      issues.push({
        check: 'contract',
        path: 'schemas/blueprint.schema.json',
        message: `$defs.${name} is also a workflow definition`,
      });
    }
  }
  const catalog = json('catalog/components.json') as SpecCatalog;
  if (catalogSchema) {
    for (const issue of validateInstance(catalogSchema, catalog)) {
      issues.push({
        check: 'catalog',
        path: 'catalog/components.json',
        message: `${issue.path} ${issue.code}`,
      });
    }
  }
  const ids = new Set((catalog?.components ?? []).map((c) => c.id));
  const capabilities = json('catalog/capabilities.json');
  if (!isRecord(capabilities)) {
    issues.push({
      check: 'capabilities',
      path: 'catalog/capabilities.json',
      message: 'must be an object',
    });
  } else {
    for (const [id, value] of Object.entries(capabilities)) {
      if (!ids.has(id) || !(CAPABILITIES as readonly unknown[]).includes(value)) {
        issues.push({
          check: 'capabilities',
          path: 'catalog/capabilities.json',
          message: `${id}: an audited capability needs a catalog id and a known tier`,
        });
      }
    }
  }

  issues.push(...checkCatalogContract(catalog));

  let build: ReturnType<typeof buildSpec> | undefined;
  try {
    build = buildSpec(normative);
  } catch (cause) {
    issues.push({ check: 'generated', path: '', message: (cause as Error).message });
  }
  if (build) {
    if (committed['manifest.json'] !== build.manifest) {
      issues.push({
        check: 'manifest',
        path: 'manifest.json',
        message: 'digests do not match the normative files',
      });
    }
    if (committed['generated-manifest.json'] !== build.generatedManifest) {
      issues.push({
        check: 'generated',
        path: 'generated-manifest.json',
        message: 'does not match a fresh generation',
      });
    }
    const expected = new Set(Object.keys(build.generated));
    for (const [path, text] of Object.entries(build.generated)) {
      if (committed[path] !== text) {
        issues.push({
          check: 'generated',
          path,
          message: committed[path] === undefined ? 'missing' : 'differs from a fresh generation',
        });
      }
    }
    for (const path of Object.keys(committed)) {
      if (path.startsWith('generated/') && !expected.has(path)) {
        issues.push({ check: 'generated', path, message: 'no generator produces this file' });
      }
    }
  }

  if (workflowSchema) {
    for (const path of Object.keys(normative).filter((p) => p.startsWith('fixtures/workflow/'))) {
      const fixture = json(path) as { expect?: readonly string[]; graph?: unknown };
      const golden = path.startsWith('fixtures/workflow/golden/');
      const got = validateWorkflowGraph(
        golden ? fixture : fixture.graph,
        workflowSchema
      ).diagnostics.map((d) => d.code);
      const expected = golden ? [] : (fixture.expect ?? []);
      if (got.join(',') !== expected.join(',')) {
        issues.push({
          check: 'workflow',
          path,
          message: `expected [${expected.join(', ')}], got [${got.join(', ')}]`,
        });
      }
    }
  }

  if (blueprintSchema) {
    const documents = { blueprintSchema, catalog, workflowSchema, validateWorkflowGraph };
    for (const path of Object.keys(normative).filter((p) => p.startsWith('fixtures/golden/'))) {
      const result = validateBlueprint(json(path), documents);
      for (const d of result.diagnostics) {
        issues.push({ check: 'golden', path, message: `${d.path} ${d.code}: ${d.message}` });
      }
    }
    for (const path of Object.keys(normative).filter((p) => p.startsWith('fixtures/invalid/'))) {
      const fixture = json(path) as {
        expect: readonly SpecDiagnosticCode[];
        options?: { catalogHash?: string };
        blueprint: unknown;
      };
      const got = validateBlueprint(fixture.blueprint, documents, fixture.options).diagnostics.map(
        (d) => d.code
      );
      if (got.join(',') !== fixture.expect.join(',')) {
        issues.push({
          check: 'invalid',
          path,
          message: `expected [${fixture.expect.join(', ')}], got [${got.join(', ')}]`,
        });
      }
    }
  }
  return issues;
}

/** The minor-version window: a deprecation since `since` expires one minor later. */
export function deprecationExpired(since: string, specVersion: string = SPEC_VERSION): boolean {
  const parse = (v: string) => v.split('.').map(Number) as [number, number, number];
  const [major, minor] = parse(specVersion);
  const [sinceMajor, sinceMinor] = parse(since);
  return major > sinceMajor || (major === sinceMajor && minor >= sinceMinor + 1);
}

/** Catalog rules the schema cannot express: property schemas, bindable props, deprecations. */
export function checkCatalogContract(
  catalog: SpecCatalog,
  specVersion: string = SPEC_VERSION
): ConformanceIssue[] {
  const issues: ConformanceIssue[] = [];
  const path = 'catalog/components.json';
  const expired = (where: string, deprecated: SpecDeprecation | undefined) => {
    if (deprecated && deprecationExpired(deprecated.since, specVersion)) {
      issues.push({
        check: 'deprecation',
        path,
        message: `${where}: deprecated since ${deprecated.since}; remove it (one minor of warnings has passed)`,
      });
    }
  };
  for (const component of catalog?.components ?? []) {
    expired(component.id, component.deprecated);
    const portable = new Set(component.props.filter((p) => !p.extension).map((p) => p.name));
    for (const name of component.bindable ?? []) {
      if (!portable.has(name)) {
        issues.push({
          check: 'prop-schema',
          path,
          message: `${component.id}: bindable "${name}" is not a portable prop`,
        });
      }
    }
    if (new Set(component.events ?? []).size !== (component.events ?? []).length) {
      issues.push({ check: 'catalog', path, message: `${component.id}: events repeat` });
    }
    for (const prop of component.props) {
      expired(`${component.id}.${prop.name}`, prop.deprecated);
      if (!prop.schema) continue;
      if (prop.kind !== 'array' && prop.kind !== 'object') {
        issues.push({
          check: 'prop-schema',
          path,
          message: `${component.id}.${prop.name}: only array and object props take a schema`,
        });
        continue;
      }
      for (const problem of checkPropSchema(prop.schema)) {
        issues.push({
          check: 'prop-schema',
          path,
          message: `${component.id}.${prop.name}: ${problem}`,
        });
      }
    }
  }
  return issues;
}
