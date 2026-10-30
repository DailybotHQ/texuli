// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { safeImageSrc } from '../../core/src/url-policy/index.ts';
import { DESIGN_DEFAULTS_VOCABULARY } from '../../texuli/src/defaults/vocabulary.ts';
import { COMPONENT_TOKEN_FAMILIES } from '../../tokens/src/components/registry.ts';
import { SEMANTIC_ROLES } from '../../tokens/src/contract/semantic.ts';
import { NEUTRAL_FAMILIES } from '../../tokens/src/generator/seed.ts';
import { MOTION_EASING_NAMES } from '../../tokens/src/motion/index.ts';
import { BASE_SYSTEM_TOKEN_NAMES, TYPE_ROLES } from '../../tokens/src/system/names.ts';
import { KOTLIN_OUT, TS_OUT } from '../src/build.ts';
import {
  applyDesignSystemPatch,
  checkDesignSystemReference,
  DESIGN_SYSTEM_CODES,
  DESIGN_SYSTEM_COMPILER_CODES,
  DESIGN_SYSTEM_LIMITS,
  DESIGN_SYSTEM_MIGRATIONS,
  type DesignSystem,
  type DesignSystemPatch,
  migrateDesignSystem,
  validateDesignSystem,
  validateDesignSystemPatch,
} from '../src/design-system/index.ts';
import { designSystemSchema } from '../src/design-system/schema.ts';
import {
  DS_COMPONENT_DEFAULTS,
  DS_COMPONENT_TOKENS,
  DS_DEFS,
  DS_ROLES,
} from '../src/design-system/vocabulary.ts';
import { checkSchemaDocument, type Schema, validateInstance } from '../src/dialect.ts';
import { formatJson } from '../src/format.ts';
import { build, json, normative } from './helpers.ts';

/**
 * The design-system document contract (ADR-021): the generated schema stays
 * fresh and inside the dialect, the vocabulary equals the token and defaults
 * registries it mirrors, the fixtures hold, and validate, patch, migrate and
 * the reference check behave as specified. Hostile inputs:
 * design-system-hostile.test.ts.
 */

type Doc = Record<string, unknown>;
const acme = json<Doc>('fixtures/design-systems/acme.json');
const minimal = json<Doc>('fixtures/design-systems/minimal.json');
const schema = json<Schema>('schemas/design-system.schema.json');
const codes = (result: { errors: readonly { code: string; path: string }[] }) =>
  result.errors.map((e) => [e.code, e.path]);

/** The kind letter a component token's default reference implies (z-index: none). */
function tokenKind(fallback: string): string | undefined {
  if (/--tx-z-/.test(fallback)) return undefined;
  if (/shape-radius/.test(fallback)) return 'r';
  if (/border-width/.test(fallback)) return 'b';
  if (/elevation-/.test(fallback)) return 'e';
  if (/opacity-/.test(fallback)) return 'o';
  if (/icon-stroke/.test(fallback)) return 'k';
  if (/type-\w+-(size|weight|line)|font-size/.test(fallback)) return 't';
  if (/space|size-control|size-icon|size-target/.test(fallback)) return 'd';
  if (/^var\(--tx-[a-z]+\)$/.test(fallback)) return 'c';
  throw new Error(`unclassified component token default ${fallback}`);
}

describe('the design-system schema is generated and fresh', () => {
  it('equals the projection of the vocabulary, stays in the dialect and generates TS and Kotlin', () => {
    const file = readFileSync(
      join(import.meta.dirname, '../schemas/design-system.schema.json'),
      'utf8'
    );
    expect(file, 'run scripts/design-system-schema.ts').toBe(formatJson(designSystemSchema()));
    expect(checkSchemaDocument(schema)).toEqual([]);
    const defs = Object.keys(schema.$defs ?? {});
    expect(defs).toEqual([...defs].sort());
    for (const def of ['color', 'variant', 'roleMap', 'issue', 'issueCode', 'componentsIconButton'])
      expect(defs, def).toContain(def);
    expect(schema.$defs?.issueCode?.enum).toEqual([
      ...DESIGN_SYSTEM_CODES,
      ...DESIGN_SYSTEM_COMPILER_CODES,
    ]);
    expect(schema.$defs?.issueCode?.enum).toHaveLength(13);
    const ts = build.generated[`${TS_OUT}design-system.ts`] as string;
    const kt = build.generated[`${KOTLIN_OUT}DesignSystem.kt`] as string;
    expect(ts).toContain('export interface DesignSystem {');
    expect(ts).toContain("'icon-button'?: DesignSystemComponentsIconButton;");
    expect(kt).toContain('data class DesignSystem(');
    expect(kt).toContain('val iconButton: DesignSystemComponentsIconButton? = null,');
    expect(kt).toContain('fields["icon-button"]');
    expect(kt).toContain('enum class DesignSystemIssueCode(val wire: String) {');
  });

  it('mirrors the token registry, roles, neutrals, easings, type roles and component defaults', () => {
    expect(DS_ROLES.split(' ')).toEqual([...SEMANTIC_ROLES]);
    const enumOf = (name: string) => (DS_DEFS[name] as readonly [string, string])[1].split(' ');
    expect(enumOf('typeRoleName')).toEqual([...TYPE_ROLES]);
    const colorSection = DS_DEFS.color as Record<string, Record<string, readonly string[]>>;
    expect(colorSection.brand?.neutral?.[1]?.split(' ')).toEqual([...NEUTRAL_FAMILIES]);
    const motion = DS_DEFS.motion as Record<string, readonly string[]>;
    expect(motion.easing?.[1]?.split(' ')).toEqual([...MOTION_EASING_NAMES]);
    // Step names exist as system tokens.
    const system = new Set(BASE_SYSTEM_TOKEN_NAMES);
    const token = (step: string) =>
      step.startsWith('space-')
        ? `--tx-${step}`
        : step.startsWith('target-')
          ? `--tx-size-${step}`
          : `--tx-size-${step}`;
    for (const step of enumOf('dimension')) expect(system.has(token(step)), step).toBe(true);
    for (const step of enumOf('radiusStep'))
      expect(system.has(`--tx-shape-radius-${step}`), step).toBe(true);
    for (const step of enumOf('opacityStep'))
      expect(system.has(`--tx-opacity-${step}`), step).toBe(true);
    // Components: every registry family and defaults entry, keys and kinds exact.
    const expected: Record<string, string> = {};
    const ids = new Set([
      ...COMPONENT_TOKEN_FAMILIES.map((f) => f.component),
      ...Object.keys(DESIGN_DEFAULTS_VOCABULARY),
    ]);
    for (const id of [...ids].sort()) {
      const family = COMPONENT_TOKEN_FAMILIES.find((f) => f.component === id);
      expected[id] = (family?.tokens ?? [])
        .flatMap((t) => {
          const kind = tokenKind(t.default);
          return kind ? [`${t.key}:${kind}`] : [];
        })
        .join(' ');
    }
    expect(DS_COMPONENT_TOKENS).toEqual(expected);
    expect(Object.keys(DS_COMPONENT_TOKENS)).toHaveLength(67);
    const defaults = Object.fromEntries(
      Object.entries(DESIGN_DEFAULTS_VOCABULARY).map(([id, v]) => {
        const lists = v as { variant?: readonly string[]; size?: readonly string[] };
        return [id, [(lists.variant ?? []).join(' '), (lists.size ?? []).join(' ')]];
      })
    );
    expect(DS_COMPONENT_DEFAULTS).toEqual(defaults);
    // No token key collides with the defaults key.
    for (const pairs of Object.values(DS_COMPONENT_TOKENS))
      expect(pairs.split(' ').map((p) => p.split(':')[0])).not.toContain('defaults');
  });
});

describe('design-system fixtures', () => {
  it('accepts acme (every section) and minimal under validate and the dialect schema', () => {
    for (const section of Object.keys(DS_DEFS.variant as object))
      expect(Object.keys(acme), section).toContain(section);
    for (const doc of [acme, minimal]) {
      expect(validateDesignSystem(doc)).toEqual({ ok: true, errors: [] });
      expect(validateInstance(schema, doc)).toEqual([]);
    }
  });

  it('refuses each invalid fixture with exactly its code and path, one fixture per code', () => {
    const files = Object.keys(normative).filter((p) =>
      p.startsWith('fixtures/design-systems/invalid/')
    );
    const seen = new Set<string>();
    for (const path of files) {
      const fixture = json<{
        expect: [string, string][];
        trust?: 'developer';
        resolve?: Record<string, unknown>;
        document: unknown;
      }>(path);
      const resolve = fixture.resolve
        ? (ref: string) => (fixture.resolve as Record<string, unknown>)[ref]
        : undefined;
      const result = validateDesignSystem(fixture.document, { trust: fixture.trust, resolve });
      expect(codes(result), path).toEqual(fixture.expect);
      for (const [code] of fixture.expect) seen.add(code);
    }
    expect([...seen].sort()).toEqual([...DESIGN_SYSTEM_CODES].sort());
  });

  it('migrates every per-version fixture to the current formatVersion', () => {
    const files = Object.keys(normative).filter((p) =>
      p.startsWith('fixtures/design-systems/migrations/')
    );
    expect(files).toEqual(['fixtures/design-systems/migrations/v1.json']);
    for (const path of files) {
      const doc = json<Doc>(path);
      const result = migrateDesignSystem(doc);
      expect(result, path).toMatchObject({ ok: true, from: 1, to: 1, applied: [] });
      if (result.ok) expect(validateDesignSystem(result.document).ok).toBe(true);
    }
    expect(DESIGN_SYSTEM_MIGRATIONS).toEqual([]);
  });
});

describe('validateDesignSystem', () => {
  it('reports codes with JSON paths, quoting keys that are not identifiers', () => {
    const doc = {
      ...minimal,
      components: {
        'aspect-ratio': { radius: 'huge', bogus: 1 },
        'icon-button': { radius: 'full' },
        button: { elevation: 2.5 },
      },
      shape: { radius: '8px' },
      tags: ['a', 'a'],
    };
    const result = validateDesignSystem(doc);
    // Issues follow the document's key order.
    expect(codes(result)).toEqual([
      ['invalid-value', '$.components["aspect-ratio"].radius'],
      ['unknown-key', '$.components["aspect-ratio"].bogus'],
      ['unknown-key', '$.components["icon-button"].radius'],
      ['invalid-value', '$.components.button.elevation'],
      ['invalid-type', '$.shape.radius'],
      ['invalid-value', '$.tags'],
    ]);
    expect(result.errors[0]?.hint).toBe('One of: none, xs, sm, md, lg, xl, full');
    expect(result.errors[1]?.hint).toBe('Allowed: radius');
    expect(result.errors[2]?.hint).toBe('Allowed: defaults');
    const missing = validateDesignSystem({ format: 'texuli/design-system', formatVersion: 1 });
    expect(codes(missing)).toEqual([
      ['required', '$.id'],
      ['required', '$.version'],
      ['required', '$.name'],
    ]);
    expect(codes(validateDesignSystem([]))).toEqual([['invalid-type', '$']]);
    expect(codes(validateDesignSystem({ ...minimal, format: 'texuli/theme' }))).toEqual([
      ['invalid-value', '$.format'],
    ]);
  });

  it('checks extends: library themes and exact versions pass; ranges, URLs and loops do not', () => {
    const ext = (value: string, resolve?: (ref: string) => unknown) =>
      codes(validateDesignSystem({ ...minimal, extends: value }, { resolve }));
    for (const ok of ['texuli:violet', 'brand@1.0.0', 'brand-core@2.10.3-beta.1'])
      expect(ext(ok), ok).toEqual([]);
    expect(ext('minimal@1.0.0')).toEqual([['extends-cycle', '$.extends']]);
    expect(ext('minimal@2.0.0')).toEqual([]);
    expect(ext('texuli:Violet')).toEqual([['invalid-value', '$.extends']]);
    expect(ext('brand@latest')).toEqual([['invalid-value', '$.extends']]);
    // A chain of exactly four passes; five is refused.
    const chain = (n: number) => (ref: string) => {
      const i = Number(/^b(\d+)@/.exec(ref)?.[1]);
      return { ...minimal, id: `b${i}`, extends: i + 1 < n ? `b${i + 1}@1.0.0` : 'texuli:violet' };
    };
    expect(ext('b0@1.0.0', chain(4))).toEqual([]);
    expect(ext('b0@1.0.0', chain(5))).toEqual([['extends-depth', '$.extends']]);
    expect(ext('b0@1.0.0', () => undefined)).toEqual([]);
  });

  it('accepts data URLs only at developer trust, within caps, and never SVG', () => {
    const png = (bytes: number) => `data:image/png;base64,${'A'.repeat((bytes / 3) * 4)}`;
    const favicon = (src: string, trust?: 'developer') =>
      codes(validateDesignSystem({ ...minimal, assets: { favicon: src } }, { trust }));
    expect(favicon(png(8_190))).toEqual([['url-refused', '$.assets.favicon']]);
    expect(favicon(png(8_190), 'developer')).toEqual([]);
    // 8,192 bytes (the cap) passes; 8,193 is one byte over.
    expect(favicon(`data:image/png;base64,${'A'.repeat(10_920)}AAA=`, 'developer')).toEqual([]);
    expect(favicon(`data:image/png;base64,${'A'.repeat(10_924)}`, 'developer')).toEqual([
      ['inline-bytes', '$.assets.favicon'],
    ]);
    expect(favicon('data:image/svg+xml;base64,PHN2Zz4=', 'developer')).toEqual([
      ['url-refused', '$.assets.favicon'],
    ]);
    expect(favicon('assets/favicon.svg')).toEqual([]);
    const font = (src: string) =>
      codes(
        validateDesignSystem(
          { ...minimal, typography: { families: { sans: { stack: ['A'], files: [{ src }] } } } },
          { trust: 'developer' }
        )
      );
    expect(font('data:font/woff2;base64,AAAA')).toEqual([]);
    expect(font('data:image/png;base64,AAAA')).toEqual([
      ['url-refused', '$.typography.families.sans.files[0].src'],
    ]);
    expect(font('fonts/a.png')).toEqual([
      ['url-refused', '$.typography.families.sans.files[0].src'],
    ]);
    expect(validateDesignSystem(acme, { trust: 'developer' }).ok).toBe(true);
  });

  it('caps errors at maxErrors (64 at most)', () => {
    const doc = {
      ...minimal,
      ...Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`x${i}`, 1])),
    };
    expect(validateDesignSystem(doc).errors).toHaveLength(64);
    expect(validateDesignSystem(doc, { maxErrors: 3 }).errors).toHaveLength(3);
    expect(validateDesignSystem(doc, { maxErrors: 1_000 }).errors).toHaveLength(64);
    expect(DESIGN_SYSTEM_LIMITS.errors).toBe(64);
  });
});

describe('patches, migration and blueprint references', () => {
  it('validates patches as partial sections where null removes, and merges them purely', () => {
    const patch: DesignSystemPatch = {
      color: { brand: { secondary: '#0ea5e9' }, pin: null },
      voice: { tone: ['bold'], lexicon: { workspace: null } },
      shape: { radius: 4 },
    };
    expect(validateDesignSystemPatch(patch)).toEqual({ ok: true, errors: [] });
    expect(
      codes(validateDesignSystemPatch({ id: 'x', color: { brand: { seed: 'red' } } }))
    ).toEqual([
      ['unknown-key', '$.id'],
      ['invalid-value', '$.color.brand.seed'],
    ]);
    expect(codes(validateDesignSystemPatch({ voice: { tone: [null] } }))).toEqual([
      ['invalid-type', '$.voice.tone[0]'],
    ]);
    const before = JSON.stringify(acme);
    const merged = applyDesignSystemPatch(acme as unknown as DesignSystem, patch);
    expect(JSON.stringify(acme)).toBe(before);
    expect(merged.color?.brand?.secondary).toBe('#0ea5e9');
    expect(merged.color?.brand?.seed).toBe('#4f46e5');
    expect(merged.color?.pin).toBeUndefined();
    expect(merged.voice?.tone).toEqual(['bold']);
    expect(merged.voice?.lexicon).toEqual({ board: 'canvas' });
    expect(merged.shape).toEqual({ radius: 4, radiusScale: 1, borderWidth: 1 });
    expect(validateDesignSystem(merged).ok).toBe(true);
    // Removing a required field is caught when the result is validated again.
    const broken = applyDesignSystemPatch(
      minimal as unknown as DesignSystem,
      {
        color: { brand: { seed: null } },
      } as DesignSystemPatch
    );
    expect(codes(validateDesignSystem(broken))).toEqual([['required', '$.color.brand.seed']]);
  });

  it('migrates purely and refuses unknown versions with format-version', () => {
    const frozen = Object.freeze({ ...minimal });
    const result = migrateDesignSystem(frozen);
    expect(result).toMatchObject({ ok: true, from: 1, to: 1, applied: [] });
    if (result.ok) {
      expect(result.document).toEqual(frozen);
      expect(result.document).not.toBe(frozen);
    }
    expect(migrateDesignSystem({ ...minimal, formatVersion: 2 })).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: 'format-version', path: '$.formatVersion' })],
    });
    expect(codes(validateDesignSystem({ ...minimal, formatVersion: 0, bogus: 1 }))).toEqual([
      ['format-version', '$.formatVersion'],
    ]);
  });

  it('checks a reference: exactly one of ref and inline', () => {
    const ref = (value: unknown, trust?: 'developer') =>
      codes(checkDesignSystemReference(value, { trust }));
    expect(ref({ ref: 'acme@2.1.0' })).toEqual([]);
    expect(ref({ ref: 'texuli:violet' })).toEqual([]);
    expect(ref({ inline: acme })).toEqual([]);
    expect(ref({ ref: 'acme@~2.1.0' })).toEqual([['extends-range', '$.ref']]);
    expect(ref({ ref: 'https://cdn.example/acme.json' })).toEqual([['url-refused', '$.ref']]);
    expect(ref({})).toEqual([['required', '$']]);
    expect(ref({ ref: 'acme@2.1.0', inline: acme })).toEqual([['invalid-value', '$']]);
    expect(ref({ ref: 'acme@2.1.0', theme: 'x' })).toEqual([['unknown-key', '$.theme']]);
    expect(ref({ inline: { ...minimal, shape: { radius: -1 } } })).toEqual([
      ['invalid-value', '$.inline.shape.radius'],
    ]);
    const data = `data:image/png;base64,${'A'.repeat(8)}`;
    expect(ref({ inline: { ...minimal, assets: { favicon: data } } })).toEqual([
      ['url-refused', '$.inline.assets.favicon'],
    ]);
    expect(ref({ inline: { ...minimal, assets: { favicon: data } } }, 'developer')).toEqual([]);
    expect(ref('acme@2.1.0')).toEqual([['invalid-type', '$']]);
    // The blueprint schema carries the reference shape (wired into the envelope later).
    const blueprint = json<Schema>('schemas/blueprint.schema.json');
    const def = blueprint.$defs?.designSystemReference as Schema;
    expect(validateInstance(def, { ref: 'acme@2.1.0' }, blueprint)).toEqual([]);
    expect(validateInstance(def, { inline: acme }, blueprint)).toEqual([]);
    expect(validateInstance(def, { ref: 'acme@^2' }, blueprint).map((i) => i.code)).toEqual([
      'pattern',
    ]);
  });

  it('accepts only image sources the URL policy also accepts at the same trust', () => {
    const assets = acme.assets as { logo: Record<string, string>; favicon: string };
    for (const src of [...Object.values(assets.logo), assets.favicon])
      expect(safeImageSrc(src, 'untrusted'), src).toBe(src);
  });
});
