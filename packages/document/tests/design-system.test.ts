// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DESIGN_SYSTEM_REF_PATTERN,
  documentJsonSchema,
  validateDocument,
} from '../src/schema/index.ts';
import { everyBlock } from './fixtures.ts';

/**
 * Spec 0.10.0 (ADR-024, T-ds-blueprint): a document may name the design
 * system it follows, `{ ref }` or `{ inline }`. This L1 engine checks the
 * shape, the ref grammar (the blueprint's) and bounded, safe JSON; the
 * reader validates and compiles the inline document before it paints.
 */
const minimal = JSON.parse(
  readFileSync(new URL('../../spec/fixtures/design-systems/minimal.json', import.meta.url), 'utf8')
) as Record<string, unknown>;
const issues = (designSystem: unknown, trust: 'developer' | 'untrusted' = 'untrusted') =>
  validateDocument({ ...everyBlock(), designSystem }, { trust }).issues.map(
    (i) => `${i.code} ${i.jsonPath}`
  );

describe('documents carry a design system (spec 0.10.0)', () => {
  it('accepts a reference or an inline document', () => {
    for (const value of [{ ref: 'acme@2.1.0' }, { ref: 'texuli:violet' }, { inline: minimal }])
      expect(issues(value), JSON.stringify(value)).toEqual([]);
    const result = validateDocument({ ...everyBlock(), designSystem: { inline: minimal } });
    expect(result.ok && result.document.designSystem).toEqual({ inline: minimal });
  });

  it('refuses ranges, URLs, both or neither, extra keys, hostile text and huge values', () => {
    for (const [value, expected] of [
      [{ ref: 'acme@^2' }, 'pattern $.designSystem.ref'],
      [{ ref: 'https://cdn.example/acme.json' }, 'pattern $.designSystem.ref'],
      [{ ref: 'acme@1.0.0', inline: minimal }, 'invalid-value $.designSystem'],
      [{}, 'invalid-value $.designSystem'],
      [{ ref: 'acme@1.0.0', css: ':root{}' }, 'unknown-key $.designSystem.css'],
      [{ inline: [] }, '$.designSystem.inline'],
      [
        { inline: { ...minimal, name: `Ac${String.fromCodePoint(0x202e)}me` } },
        'unsafe-text $.designSystem.inline.name',
      ],
      [
        { inline: { ...minimal, tags: Array.from({ length: 65 }, (_, i) => `t${i}`) } },
        '$.designSystem.inline.tags',
      ],
    ] as const) {
      expect(issues(value).join(' | '), JSON.stringify(value).slice(0, 60)).toContain(expected);
    }
    let deep: Record<string, unknown> = {};
    for (let i = 0; i < 40; i += 1) deep = { nest: deep };
    expect(issues({ inline: { ...minimal, voice: deep } }).join(' ')).toContain('$.designSystem');
    // A prototype key stays an own property and is refused, never merged.
    const parsed = JSON.parse('{"inline":{"__proto__":{"polluted":true}}}');
    expect(issues(parsed).length).toBeGreaterThan(0);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('shares the blueprint grammar and exports it in the JSON Schema', () => {
    const blueprint = JSON.parse(
      readFileSync(new URL('../../spec/schemas/blueprint.schema.json', import.meta.url), 'utf8')
    );
    expect(DESIGN_SYSTEM_REF_PATTERN.source).toBe(
      blueprint.$defs.designSystemReference.properties.ref.pattern
    );
    const schema = documentJsonSchema() as { properties: Record<string, { properties?: object }> };
    expect(Object.keys(schema.properties.designSystem?.properties ?? {})).toEqual([
      'ref',
      'inline',
    ]);
  });
});
