import { canonicalJson, sha256 } from './canonical.ts';
import type { SpecCatalog } from './catalog.ts';
import { kotlinJsonRuntime, schemaToKotlin, vocabularyToKotlin } from './codegen/kotlin.ts';
import type { SchemaUnit, Stamp } from './codegen/shared.ts';
import { schemaToTypeScript, vocabularyToTypeScript } from './codegen/typescript.ts';
import { DIALECT_URI, type Schema } from './dialect.ts';
import { formatJson } from './format.ts';

import { SPEC_VERSION } from './version.ts';

export { SPEC_VERSION };

/** Where normative files live inside the package. */
export const NORMATIVE_DIRS = ['schemas/', 'catalog/', 'fixtures/'] as const;

/**
 * Normative schemas that are pinned by digest but are not in the dialect and
 * generate nothing: they are exported by a higher-layer engine and kept here
 * so the contract pins the exact version agents write against. Spec 0.7.0
 * pins `@texuli/document`'s JSON Schema export (ADR-011) and spec 0.8.0
 * `@texuli/canvas`'s (ADR-012); freshness tests in `@texuli/catalog` keep
 * them equal to `documentJsonSchema()` and `canvasJsonSchema()`.
 */
export const EXTERNAL_SCHEMAS: readonly string[] = Object.freeze([
  'schemas/canvas.schema.json',
  'schemas/document.schema.json',
]);

/** The schema documents, their generated names and output files. */
export const SCHEMA_UNITS = [
  { name: 'blueprint', prefix: 'Blueprint', ts: 'blueprint.ts', kt: 'Blueprint.kt' },
  { name: 'catalog', prefix: 'Spec', ts: 'catalog-schema.ts', kt: 'CatalogSchema.kt' },
  { name: 'diagnostics', prefix: 'Spec', ts: 'diagnostics.ts', kt: 'Diagnostics.kt' },
  { name: 'manifest', prefix: 'Spec', ts: 'manifest.ts', kt: 'Manifest.kt' },
  { name: 'workflow', prefix: '', ts: 'workflow.ts', kt: 'Workflow.kt' },
  { name: 'design-system', prefix: 'DesignSystem', ts: 'design-system.ts', kt: 'DesignSystem.kt' },
] as const;

export const TS_OUT = 'generated/typescript/';
export const KOTLIN_OUT = 'generated/kotlin/com/texuli/spec/';

export interface SpecBuild {
  /** `manifest.json`: the spec version and a digest per normative file. */
  manifest: string;
  /** The stamp every generated file carries. */
  stamp: Stamp;
  /** Generated path → content. */
  generated: Readonly<Record<string, string>>;
  /** `generated-manifest.json`: a digest per generated file. */
  generatedManifest: string;
}

/**
 * Build the whole spec from its normative files (path → exact text): the
 * manifest, every TypeScript and Kotlin projection and the generated
 * manifest. Pure and deterministic: the same files give byte-identical
 * output, whatever order they are passed in. Throws when a schema leaves
 * the dialect.
 */
export function buildSpec(
  files: Readonly<Record<string, string>>,
  specVersion = SPEC_VERSION
): SpecBuild {
  const paths = Object.keys(files).sort();
  for (const path of paths) {
    if (!NORMATIVE_DIRS.some((dir) => path.startsWith(dir)) || !path.endsWith('.json')) {
      throw new Error(`${path}: not a normative spec file`);
    }
  }
  const manifestData = {
    specVersion,
    dialect: DIALECT_URI,
    files: Object.fromEntries(paths.map((path) => [path, sha256(files[path] as string)])),
  };
  const stamp: Stamp = { specVersion, specDigest: sha256(canonicalJson(manifestData)) };

  const read = <T>(path: string): T => {
    const text = files[path];
    if (text === undefined) throw new Error(`${path}: missing`);
    return JSON.parse(text) as T;
  };
  const generated: Record<string, string> = {};
  for (const unit of SCHEMA_UNITS) {
    const source = `schemas/${unit.name}.schema.json`;
    const schemaUnit: SchemaUnit = { source, schema: read<Schema>(source), prefix: unit.prefix };
    generated[`${TS_OUT}${unit.ts}`] = schemaToTypeScript(schemaUnit, stamp);
    generated[`${KOTLIN_OUT}${unit.kt}`] = schemaToKotlin(schemaUnit, stamp);
  }
  const catalog = read<SpecCatalog>('catalog/components.json');
  generated[`${TS_OUT}vocabulary.ts`] = vocabularyToTypeScript(catalog, stamp);
  generated[`${KOTLIN_OUT}Vocabulary.kt`] = vocabularyToKotlin(catalog, stamp);
  generated[`${KOTLIN_OUT}Json.kt`] = kotlinJsonRuntime(stamp);

  const sorted = Object.fromEntries(
    Object.keys(generated)
      .sort()
      .map((path) => [path, generated[path] as string])
  );
  const generatedManifest = formatJson({
    specVersion,
    dialect: DIALECT_URI,
    files: Object.fromEntries(Object.entries(sorted).map(([path, text]) => [path, sha256(text)])),
  });
  return { manifest: formatJson(manifestData), stamp, generated: sorted, generatedManifest };
}
