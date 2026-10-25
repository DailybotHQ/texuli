import { buildSpec } from './build.ts';
import { CAPABILITIES, type SpecCatalog } from './catalog.ts';
import { checkSchemaDocument, isRecord, type Schema, validateInstance } from './dialect.ts';
import { type SpecDiagnosticCode, validateBlueprint } from './validate.ts';

/** One conformance failure: drift is a failed gate, never a warning. */
export interface ConformanceIssue {
  check: 'dialect' | 'catalog' | 'capabilities' | 'manifest' | 'generated' | 'golden' | 'invalid';
  path: string;
  message: string;
}

/**
 * Run the spec's conformance harness (spec/Compose design §7.1 and §7.3)
 * over the normative files and the committed outputs (`manifest.json`,
 * `generated-manifest.json` and every generated file):
 * - every schema stays in the dialect;
 * - `catalog/components.json` and `catalog/capabilities.json` are valid;
 * - the manifest digests match the normative files;
 * - regenerating gives byte-identical TypeScript and Kotlin, with no file
 *   missing or extra;
 * - every golden blueprint validates, and every invalid fixture fails with
 *   exactly its expected diagnostic codes.
 * Runtime-neutral: the caller reads the files.
 */
export function checkConformance(
  normative: Readonly<Record<string, string>>,
  committed: Readonly<Record<string, string>>
): ConformanceIssue[] {
  const issues: ConformanceIssue[] = [];
  const json = (path: string): unknown => JSON.parse(normative[path] ?? 'null');

  const schemas: Record<string, Schema> = {};
  for (const path of Object.keys(normative).filter((p) => p.startsWith('schemas/'))) {
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

  if (blueprintSchema) {
    const documents = { blueprintSchema, catalog };
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
