import { describe, expect, it } from 'vitest';
import type { SpecCatalog } from '../src/catalog.ts';
import { checkDesignSystemReference } from '../src/design-system/validate.ts';
import type { Schema } from '../src/dialect.ts';
import { migrateBlueprint } from '../src/migrations/index.ts';
import { validateBlueprint } from '../src/validate.ts';
import { build, json } from './helpers.ts';

/**
 * Spec 0.10.0 (ADR-024, T-ds-blueprint): the envelope carries an optional
 * `designSystem`, `{ ref: "id@x.y.z" }` or `{ inline: <document> }`, closed,
 * exactly one key. The inline document's own rules are
 * `checkDesignSystemReference`'s; migrations stamp only `spec`.
 */
const documents = {
  blueprintSchema: json<Schema>('schemas/blueprint.schema.json'),
  catalog: json<SpecCatalog>('catalog/components.json'),
};
const report = json<Record<string, unknown>>('fixtures/golden/brand-report.json');
const deck = json<Record<string, unknown>>('fixtures/golden/brand-deck.json');
const minimal = json<Record<string, unknown>>('fixtures/design-systems/minimal.json');
const found = (designSystem: unknown) =>
  validateBlueprint({ ...report, designSystem }, documents).diagnostics.map(
    (d) => `${d.code} ${d.path}`
  );

describe('spec 0.10.0: the envelope design system', () => {
  it('accepts a reference and an inline document on blueprints and decks', () => {
    expect(validateBlueprint(report, documents)).toEqual({ ok: true, diagnostics: [] });
    expect(validateBlueprint(deck, documents)).toEqual({ ok: true, diagnostics: [] });
    expect((deck.tree as { id: string }).id).toBe('layout-deck');
    for (const ref of ['acme@2.1.0', 'acme@1.0.0-beta.2', 'texuli:violet'])
      expect(found({ ref }), ref).toEqual([]);
    expect(found({ inline: minimal })).toEqual([]);
    // The inline goldens pass the document's own rules, at the untrusted level.
    expect(checkDesignSystemReference(deck.designSystem).errors).toEqual([]);
  });

  it('keeps the reference closed, exact and one of two keys', () => {
    for (const [value, expected] of [
      [{ ref: 'acme@^2' }, ['schema $.designSystem.ref']],
      [{ ref: 'acme@2' }, ['schema $.designSystem.ref']],
      [{ ref: 'https://cdn.example/acme.json' }, ['schema $.designSystem.ref']],
      [{ ref: '../acme@1.0.0' }, ['schema $.designSystem.ref']],
      [{ ref: 'Acme@1.0.0' }, ['schema $.designSystem.ref']],
      [{ ref: 'acme@1.0.0', inline: minimal }, ['schema $.designSystem']],
      [{}, ['schema $.designSystem']],
      [{ ref: 'acme@1.0.0', theme: 'x' }, ['schema $.designSystem.theme']],
      [
        { ['__proto__']: { ref: 'acme@1.0.0' } },
        ['schema $.designSystem.__proto__', 'schema $.designSystem'],
      ],
      [{ inline: 'acme' }, ['schema $.designSystem.inline']],
      ['acme@1.0.0', ['schema $.designSystem']],
    ] as const) {
      const value2 = JSON.parse(JSON.stringify(value));
      expect(found(value2), JSON.stringify(value)).toEqual(
        expected.map((line) => expect.stringContaining(line))
      );
    }
  });

  it('migrates older envelopes by stamping spec only', () => {
    for (const from of ['0.9.0', '0.8.0']) {
      const { spec: _drop, designSystem: _ds, ...rest } = report;
      const input = { ...rest, spec: from };
      const result = migrateBlueprint(input);
      expect(result.blueprint, from).toEqual({ ...input, spec: '0.10.0' });
      expect(Object.hasOwn(result.blueprint as object, 'designSystem')).toBe(false);
    }
    // A current envelope with a design system passes through untouched.
    expect(migrateBlueprint(deck)).toMatchObject({ blueprint: deck, applied: [] });
  });

  it('projects designSystem into the TypeScript and Kotlin envelopes', () => {
    const ts = build.generated['generated/typescript/blueprint.ts'] as string;
    expect(ts).toMatch(/designSystem\?: BlueprintDesignSystemReference;/);
    const kt = build.generated['generated/kotlin/com/texuli/spec/Blueprint.kt'] as string;
    expect(kt).toContain('val designSystem: BlueprintDesignSystemReference? = null');
    expect(kt).toContain('BlueprintDesignSystemReference.decode(it, "$path.designSystem")');
  });
});
