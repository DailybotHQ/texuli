// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildSpec, KOTLIN_OUT, TS_OUT } from '../src/build.ts';
import { build, normative } from './helpers.ts';

describe('deterministic generation', () => {
  it('gives byte-identical output on every run and for any input order', () => {
    const again = buildSpec(normative);
    expect(again).toEqual(build);
    const shuffled = Object.fromEntries(Object.entries(normative).reverse());
    expect(buildSpec(shuffled)).toEqual(build);
  });

  it('generates the TypeScript and Kotlin projections of every schema and the vocabulary', () => {
    expect(Object.keys(build.generated)).toEqual([
      `${KOTLIN_OUT}Blueprint.kt`,
      `${KOTLIN_OUT}CatalogSchema.kt`,
      `${KOTLIN_OUT}Diagnostics.kt`,
      `${KOTLIN_OUT}Json.kt`,
      `${KOTLIN_OUT}Manifest.kt`,
      `${KOTLIN_OUT}Vocabulary.kt`,
      `${TS_OUT}blueprint.ts`,
      `${TS_OUT}catalog-schema.ts`,
      `${TS_OUT}diagnostics.ts`,
      `${TS_OUT}manifest.ts`,
      `${TS_OUT}vocabulary.ts`,
    ]);
  });

  it('stamps every generated file with the spec version and digest, and no timestamp', () => {
    for (const [path, text] of Object.entries(build.generated)) {
      expect(text, path).toContain(
        `// Spec ${build.stamp.specVersion}, digest ${build.stamp.specDigest}`
      );
      expect(text, path).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    }
  });

  it('changes the digest and the stamped output when a normative file changes', () => {
    const edited = {
      ...normative,
      'catalog/capabilities.json': '{ }\n',
    };
    const next = buildSpec(edited);
    expect(next.stamp.specDigest).not.toBe(build.stamp.specDigest);
    expect(next.manifest).not.toBe(build.manifest);
  });

  it('refuses to generate from a schema outside the dialect, and from stray files', () => {
    const schema = JSON.parse(normative['schemas/diagnostics.schema.json'] as string);
    schema.properties.ok = { type: 'boolean', format: 'flag' };
    expect(() =>
      buildSpec({ ...normative, 'schemas/diagnostics.schema.json': JSON.stringify(schema) })
    ).toThrow(/not in the spec dialect/);
    expect(() => buildSpec({ ...normative, 'notes/x.json': '{}' })).toThrow(/not a normative/);
  });
});
