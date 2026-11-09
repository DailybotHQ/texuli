/**
 * ADR-032 locked design systems: the `allow`, `library` and `approval`
 * sections, structurally (types, vocabulary, generated schema and
 * projections). Catalog membership is `checkDesignSystemAllow`'s job, not
 * the validator's, so any well-formed id and value passes here.
 */
import { describe, expect, it } from 'vitest';
import { KOTLIN_OUT, TS_OUT } from '../src/build.ts';
import {
  type DesignSystem,
  validateDesignSystem,
  validateDesignSystemPatch,
} from '../src/design-system/index.ts';
import { designSystemSchema } from '../src/design-system/schema.ts';
import { DS_COMPONENT_STATES, DS_LOCKED_LIMITS } from '../src/design-system/types-locked.ts';
import { DS_DEFS, DS_ROOT } from '../src/design-system/vocabulary.ts';
import { type Schema, validateInstance } from '../src/dialect.ts';
import { build, json } from './helpers.ts';

const schema = json<Schema>('schemas/design-system.schema.json');
const HASH = 'a'.repeat(64);

const base = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.2.0',
  name: 'Harborline',
} as const;

const locked: DesignSystem = {
  ...base,
  allow: {
    button: {
      variants: ['default', 'outline'],
      sizes: ['sm', 'md'],
      states: ['hover', 'focus-visible', 'disabled'],
    },
    badge: { tones: ['success', 'warning'] },
    'data-grid': { densities: ['compact'], variants: [] },
    card: {},
  },
  library: [
    {
      id: 'pricing-card',
      name: 'Pricing card',
      purpose: 'One plan with its price and a call to action.',
      version: '0.3.0',
      status: 'draft',
      composes: ['card', 'button', 'badge'],
    },
    {
      id: 'stat-tile',
      name: 'Stat tile',
      purpose: 'A metric with its trend.',
      version: '1.0.0',
      status: 'approved',
      composes: ['stat'],
      approval: {
        status: 'approved',
        approvedBy: 'Design reviewer',
        approvedAt: '2026-11-09T14:30:00Z',
        version: '1.0.0',
        contentHash: HASH,
      },
    },
  ],
  approval: {
    status: 'approved',
    approvedBy: 'Design reviewer',
    approvedAt: '2026-11-09T14:30:00.250Z',
    version: '1.2.0',
    contentHash: HASH,
  },
};

/** Validate with both the validator and the generated dialect schema; return the validator's codes and paths. */
function check(doc: unknown): [string, string][] {
  const result = validateDesignSystem(doc);
  const schemaErrors = validateInstance(schema, doc);
  // The generated schema accepts every document the validator accepts. It may accept more:
  // map key patterns, map caps and unique items are beyond the dialect (schema.ts), so
  // only the validator refuses those.
  if (result.ok) expect(schemaErrors, JSON.stringify(schemaErrors)).toEqual([]);
  return result.errors.map((issue) => [issue.code, issue.path]);
}

/** Refused by the generated schema as well (shapes the dialect expresses). */
function schemaRefuses(doc: unknown): boolean {
  return validateInstance(schema, doc).length > 0;
}

const withDoc = (patch: Record<string, unknown>): Record<string, unknown> => ({
  ...base,
  ...patch,
});

describe('locked design systems: valid documents', () => {
  it('accepts allow, library and approval, under the validator and the generated schema', () => {
    expect(check(locked)).toEqual([]);
    expect(check({ ...base })).toEqual([]);
    expect(check(withDoc({ allow: {} }))).toEqual([]);
    expect(check(withDoc({ library: [] }))).toEqual([]);
    expect(check(withDoc({ approval: { status: 'draft', version: '1.2.0' } }))).toEqual([]);
    expect(check(withDoc({ allow: { button: { states: [...DS_COMPONENT_STATES] } } }))).toEqual([]);
    for (const at of ['2026-11-09T14:30Z', '2026-11-09T14:30:59Z', '2026-02-28T00:00:00.1Z'])
      expect(
        check(withDoc({ approval: { status: 'draft', version: '1.0.0', approvedAt: at } })),
        at
      ).toEqual([]);
  });

  it('places allow among the sections (variants may narrow it) and library and approval at the root only', () => {
    const sections = Object.keys(DS_DEFS.variant as object);
    expect(sections).toContain('allow');
    expect(sections).not.toContain('library');
    expect(sections).not.toContain('approval');
    expect(Object.keys(DS_ROOT)).toEqual(expect.arrayContaining(['allow', 'library', 'approval']));
    expect(validateDesignSystemPatch({ allow: { button: { variants: ['default'] } } }).ok).toBe(
      true
    );
    expect(validateDesignSystemPatch({ allow: { button: null } }).ok).toBe(true);
    expect(validateDesignSystemPatch({ approval: { status: 'approved' } }).errors).toMatchObject([
      { code: 'unknown-key', path: '$.approval' },
    ]);
    expect(validateDesignSystemPatch({ library: [] }).errors).toMatchObject([
      { code: 'unknown-key', path: '$.library' },
    ]);
    expect(
      check(withDoc({ variants: { compact: { allow: { button: { sizes: ['sm'] } } } } }))
    ).toEqual([]);
    expect(check(withDoc({ variants: { compact: { approval: { status: 'draft' } } } }))).toEqual([
      ['unknown-key', '$.variants.compact.approval'],
    ]);
  });
});

describe('locked design systems: malformed shapes', () => {
  const cases: [string, Record<string, unknown>, [string, string][]][] = [
    ['allow is not an object', { allow: [] }, [['invalid-type', '$.allow']]],
    [
      'an allow id that is not kebab-case',
      { allow: { Button: {} } },
      [['invalid-value', '$.allow.Button']],
    ],
    [
      'a reserved allow key',
      { allow: JSON.parse('{"__proto__": {}}') },
      [['invalid-value', '$.allow.__proto__']],
    ],
    [
      'an unknown allow field',
      { allow: { button: { colors: ['red'] } } },
      [['unknown-key', '$.allow.button.colors']],
    ],
    [
      'an axis that is not a list',
      { allow: { button: { variants: 'default' } } },
      [['invalid-type', '$.allow.button.variants']],
    ],
    [
      'an axis value with a space',
      { allow: { button: { sizes: ['extra large'] } } },
      [['invalid-value', '$.allow.button.sizes[0]']],
    ],
    [
      'a duplicate axis value',
      { allow: { button: { variants: ['default', 'default'] } } },
      [['invalid-value', '$.allow.button.variants']],
    ],
    [
      'a state outside the closed list',
      { allow: { button: { states: ['pressed'] } } },
      [['invalid-value', '$.allow.button.states[0]']],
    ],
    ['library is not a list', { library: {} }, [['invalid-type', '$.library']]],
    [
      'a library entry without its required fields',
      { library: [{ id: 'pricing-card' }] },
      [
        ['required', '$.library[0].name'],
        ['required', '$.library[0].purpose'],
        ['required', '$.library[0].version'],
        ['required', '$.library[0].status'],
        ['required', '$.library[0].composes'],
      ],
    ],
    [
      'a library entry that composes nothing',
      {
        library: [
          { id: 'x', name: 'X', purpose: 'P', version: '1.0.0', status: 'draft', composes: [] },
        ],
      },
      [['invalid-value', '$.library[0].composes']],
    ],
    [
      'a library status outside draft and approved',
      {
        library: [
          {
            id: 'x',
            name: 'X',
            purpose: 'P',
            version: '1.0.0',
            status: 'pending',
            composes: ['card'],
          },
        ],
      },
      [['invalid-value', '$.library[0].status']],
    ],
    [
      'a library version that is not semver',
      {
        library: [
          {
            id: 'x',
            name: 'X',
            purpose: 'P',
            version: '^1.0.0',
            status: 'draft',
            composes: ['card'],
          },
        ],
      },
      [['invalid-value', '$.library[0].version']],
    ],
    [
      'approval without status and version',
      { approval: {} },
      [
        ['required', '$.approval.status'],
        ['required', '$.approval.version'],
      ],
    ],
    [
      'an unknown approval field',
      { approval: { status: 'draft', version: '1.0.0', signature: 'x' } },
      [['unknown-key', '$.approval.signature']],
    ],
    [
      'an approval date that is not ISO UTC',
      { approval: { status: 'draft', version: '1.0.0', approvedAt: '09/11/2026' } },
      [['invalid-value', '$.approval.approvedAt']],
    ],
    [
      'an approval date with an offset',
      { approval: { status: 'draft', version: '1.0.0', approvedAt: '2026-11-09T14:30:00+02:00' } },
      [['invalid-value', '$.approval.approvedAt']],
    ],
    [
      'an uppercase content hash',
      { approval: { status: 'draft', version: '1.0.0', contentHash: 'A'.repeat(64) } },
      [['invalid-value', '$.approval.contentHash']],
    ],
    [
      'a short content hash',
      { approval: { status: 'draft', version: '1.0.0', contentHash: 'abc' } },
      [['invalid-value', '$.approval.contentHash']],
    ],
    [
      'approvedBy with a bidi override',
      { approval: { status: 'draft', version: '1.0.0', approvedBy: 'evil\u202Ename' } },
      [['invalid-value', '$.approval.approvedBy']],
    ],
  ];

  /** Refusals the dialect cannot express, so only the validator makes them. */
  const validatorOnly = new Set([
    'an allow id that is not kebab-case',
    'a reserved allow key',
    'a duplicate axis value',
  ]);
  for (const [name, patch, expected] of cases) {
    it(`refuses ${name}`, () => {
      expect(check(withDoc(patch))).toEqual(expected);
      if (!validatorOnly.has(name)) expect(schemaRefuses(withDoc(patch))).toBe(true);
    });
  }

  it('caps the number of allowed components, axis values, library entries and composed ids', () => {
    const many = (n: number) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`c-${i}`, {}]));
    expect(check(withDoc({ allow: many(DS_LOCKED_LIMITS.allowComponents) }))).toEqual([]);
    expect(check(withDoc({ allow: many(DS_LOCKED_LIMITS.allowComponents + 1) }))).toEqual([
      ['invalid-value', '$.allow'],
    ]);
    const values = (n: number) => Array.from({ length: n }, (_, i) => `v${i}`);
    expect(
      check(withDoc({ allow: { button: { variants: values(DS_LOCKED_LIMITS.axisValues + 1) } } }))
    ).toEqual([['invalid-value', '$.allow.button.variants']]);
    const entry = (i: number) => ({
      id: `e-${i}`,
      name: 'E',
      purpose: 'P',
      version: '1.0.0',
      status: 'draft',
      composes: ['card'],
    });
    expect(
      check(
        withDoc({
          library: Array.from({ length: DS_LOCKED_LIMITS.library + 1 }, (_, i) => entry(i)),
        })
      )
    ).toEqual([['invalid-value', '$.library']]);
    expect(
      check(
        withDoc({
          library: [
            { ...entry(0), composes: values(DS_LOCKED_LIMITS.composes + 1).map((v) => `c-${v}`) },
          ],
        })
      )
    ).toEqual([['invalid-value', '$.library[0].composes']]);
  });
});

describe('locked design systems: schema and projections', () => {
  it('projects the new definitions into the schema, TypeScript and Kotlin', () => {
    const defs = designSystemSchema().$defs ?? {};
    for (const def of [
      'allow',
      'allowEntry',
      'approval',
      'approvalStatus',
      'componentState',
      'library',
      'libraryEntry',
    ])
      expect(defs, def).toHaveProperty(def);
    expect(defs.componentState?.enum).toEqual([...DS_COMPONENT_STATES]);
    const ts = build.generated[`${TS_OUT}design-system.ts`] as string;
    const kt = build.generated[`${KOTLIN_OUT}DesignSystem.kt`] as string;
    expect(ts).toMatch(
      /export interface DesignSystem \{[\s\S]*?allow\?: DesignSystemAllow;[\s\S]*?approval\?: DesignSystemApproval;[\s\S]*?library\?: DesignSystemLibrary;/
    );
    expect(ts).toContain('export interface DesignSystemLibraryEntry {');
    expect(kt).toContain('data class DesignSystemAllowEntry(');
    expect(kt).toContain('data class DesignSystemApproval(');
    expect(kt).toContain('data class DesignSystemLibraryEntry(');
    expect(kt).toContain('enum class DesignSystemComponentState(val wire: String) {');
    expect(kt).toContain('val approval: DesignSystemApproval? = null,');
  });
});
