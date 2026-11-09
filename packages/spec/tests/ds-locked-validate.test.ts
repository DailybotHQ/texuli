/**
 * ADR-032 locked design systems: structural approval rules, catalog
 * membership via `checkDesignSystemAllow` (catalog injected, never bundled),
 * and hostile inputs on the new sections.
 */
import { describe, expect, it } from 'vitest';
import {
  checkDesignSystemAllow,
  DESIGN_SYSTEM_ALLOW_CODES,
  DESIGN_SYSTEM_CODES,
  DESIGN_SYSTEM_LIMITS,
  type DesignSystemAllowCatalog,
  validateDesignSystem,
} from '../src/design-system/index.ts';
import { DS_LOCKED_LIMITS } from '../src/design-system/types-locked.ts';
import { json } from './helpers.ts';

const base = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.2.0',
  name: 'Harborline',
} as const;

const catalog: DesignSystemAllowCatalog = {
  components: [
    {
      id: 'button',
      axes: {
        variant: { values: ['default', 'outline'] },
        size: { values: ['sm', 'md'] },
      },
      states: ['hover', 'focus-visible', 'disabled'],
    },
    {
      id: 'badge',
      axes: { tone: { values: ['success', 'warning'] }, color: { values: ['none', 'chart-1'] } },
    },
    {
      id: 'data-grid',
      axes: { density: { values: ['comfortable', 'compact'] } },
    },
    { id: 'card' },
  ],
};

const withDoc = (patch: Record<string, unknown>) => ({ ...base, ...patch });
const codes = (result: { errors: readonly { code: string; path: string }[] }) =>
  result.errors.map((issue) => [issue.code, issue.path]);

describe('validateDesignSystem: approval-invalid', () => {
  it('refuses an approved document without approvedBy and approvedAt', () => {
    expect(
      codes(validateDesignSystem(withDoc({ approval: { status: 'approved', version: '1.2.0' } })))
    ).toEqual([['approval-invalid', '$.approval']]);
    expect(
      codes(
        validateDesignSystem(
          withDoc({
            approval: {
              status: 'approved',
              version: '1.2.0',
              approvedBy: 'Design reviewer',
              approvedAt: '2026-11-09T14:30:00Z',
            },
          })
        )
      )
    ).toEqual([]);
    expect(
      codes(validateDesignSystem(withDoc({ approval: { status: 'draft', version: '1.2.0' } })))
    ).toEqual([]);
  });

  it('refuses an approved library entry without its own approval', () => {
    const entry = {
      id: 'pricing-card',
      name: 'Pricing card',
      purpose: 'One plan with its price and a call to action.',
      version: '0.3.0',
      composes: ['card'],
    };
    expect(
      codes(validateDesignSystem(withDoc({ library: [{ ...entry, status: 'approved' }] })))
    ).toEqual([['approval-invalid', '$.library[0]']]);
    expect(
      codes(
        validateDesignSystem(
          withDoc({
            library: [
              {
                ...entry,
                status: 'approved',
                approval: { status: 'approved', version: '0.3.0' },
              },
            ],
          })
        )
      )
    ).toEqual([]);
  });
});

describe('checkDesignSystemAllow', () => {
  it('accepts omitted allow, empty allow, omitted lists and catalog values', () => {
    expect(checkDesignSystemAllow(base, catalog)).toEqual({ ok: true, errors: [] });
    expect(checkDesignSystemAllow(withDoc({ allow: {} }), catalog).ok).toBe(true);
    expect(
      checkDesignSystemAllow(
        withDoc({
          allow: {
            button: { variants: ['default'], sizes: ['sm'], states: ['hover'] },
            badge: { tones: ['success'], colors: ['none'] },
            'data-grid': { densities: ['compact'] },
            card: {},
          },
        }),
        catalog
      )
    ).toEqual({ ok: true, errors: [] });
    expect(
      checkDesignSystemAllow(withDoc({ allow: { button: { variants: [] } } }), catalog).ok
    ).toBe(true);
  });

  it('reports each catalog-membership code with a JSON path', () => {
    expect(
      codes(checkDesignSystemAllow(withDoc({ allow: { 'ghost-widget': {} } }), catalog))
    ).toEqual([['unknown-component', '$.allow["ghost-widget"]']]);
    expect(
      codes(
        checkDesignSystemAllow(withDoc({ allow: { button: { variants: ['ghost'] } } }), catalog)
      )
    ).toEqual([['unknown-variant', '$.allow.button.variants[0]']]);
    expect(
      codes(checkDesignSystemAllow(withDoc({ allow: { button: { sizes: ['xl'] } } }), catalog))
    ).toEqual([['unknown-size', '$.allow.button.sizes[0]']]);
    expect(
      codes(checkDesignSystemAllow(withDoc({ allow: { badge: { tones: ['rainbow'] } } }), catalog))
    ).toEqual([['unknown-tone', '$.allow.badge.tones[0]']]);
    expect(
      codes(
        checkDesignSystemAllow(
          withDoc({ allow: { 'data-grid': { densities: ['ultra'] } } }),
          catalog
        )
      )
    ).toEqual([['unknown-density', '$.allow["data-grid"].densities[0]']]);
    expect(
      codes(checkDesignSystemAllow(withDoc({ allow: { badge: { colors: ['rainbow'] } } }), catalog))
    ).toEqual([['unknown-color', '$.allow.badge.colors[0]']]);
    expect(
      codes(
        checkDesignSystemAllow(withDoc({ allow: { button: { states: ['loading'] } } }), catalog)
      )
    ).toEqual([['unknown-state', '$.allow.button.states[0]']]);
  });

  it('refuses a library compose id that is not in the catalog', () => {
    expect(
      codes(
        checkDesignSystemAllow(
          withDoc({
            library: [
              {
                id: 'pricing-card',
                name: 'Pricing card',
                purpose: 'P',
                version: '1.0.0',
                status: 'draft',
                composes: ['ghost-widget'],
              },
            ],
          }),
          catalog
        )
      )
    ).toEqual([['unknown-component', '$.library[0].composes[0]']]);
  });

  it('does not bundle the catalog into validateDesignSystem', () => {
    const doc = withDoc({ allow: { 'ghost-widget': {}, button: { variants: ['ghost'] } } });
    expect(validateDesignSystem(doc).ok).toBe(true);
    expect(checkDesignSystemAllow(doc, catalog).ok).toBe(false);
    expect(DESIGN_SYSTEM_ALLOW_CODES.every((code) => DESIGN_SYSTEM_CODES.includes(code))).toBe(
      true
    );
  });
});

describe('locked sections: hostile input', () => {
  it('refuses oversize allow maps and axis lists with the existing invalid-value cap', () => {
    const many = Object.fromEntries(
      Array.from({ length: DS_LOCKED_LIMITS.allowComponents + 1 }, (_, i) => [`c-${i}`, {}])
    );
    expect(codes(validateDesignSystem(withDoc({ allow: many })))).toEqual([
      ['invalid-value', '$.allow'],
    ]);
    const flood = Object.fromEntries(Array.from({ length: 30_000 }, (_, i) => [`k-${i}`, {}]));
    expect(codes(validateDesignSystem(withDoc({ allow: flood })))).toEqual([
      ['invalid-value', '$.allow'],
    ]);
    const values = Array.from({ length: DS_LOCKED_LIMITS.axisValues + 1 }, (_, i) => `v${i}`);
    expect(
      codes(validateDesignSystem(withDoc({ allow: { button: { variants: values } } })))
    ).toEqual([['invalid-value', '$.allow.button.variants']]);
  });

  it('refuses reserved keys, non-string values and deep nesting on allow', () => {
    expect(
      codes(validateDesignSystem(withDoc({ allow: JSON.parse('{"__proto__": {}}') })))
    ).toEqual([['invalid-value', '$.allow.__proto__']]);
    expect(
      codes(validateDesignSystem(withDoc({ allow: JSON.parse('{"constructor": {}}') })))
    ).toEqual([['invalid-value', '$.allow.constructor']]);
    expect(codes(validateDesignSystem(withDoc({ allow: { button: { variants: [1] } } })))).toEqual([
      ['invalid-type', '$.allow.button.variants[0]'],
    ]);
    let deep: unknown = 'leaf';
    for (let i = 0; i < 40; i++) deep = { nest: deep };
    expect(codes(validateDesignSystem(withDoc({ allow: { button: { variants: deep } } })))).toEqual(
      [['invalid-type', '$.allow.button.variants']]
    );
  });

  it('caps checkDesignSystemAllow at 64 errors on a flood of unknown ids, quickly', () => {
    const allow = Object.fromEntries(
      Array.from({ length: 1_000 }, (_, i) => [`ghost-${i}`, { variants: ['x'] }])
    );
    const started = performance.now();
    const result = checkDesignSystemAllow(withDoc({ allow }), catalog);
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(DESIGN_SYSTEM_LIMITS.errors);
    expect(new Set(result.errors.map((issue) => issue.code))).toEqual(
      new Set(['unknown-component'])
    );
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('skips prototype keys and never echoes a huge catalog into messages', () => {
    const doc = JSON.parse(
      `{"format":"texuli/design-system","formatVersion":1,"id":"a","version":"1.0.0","name":"A","allow":{"__proto__":{},"button":{"variants":["ghost"]}}}`
    );
    const result = checkDesignSystemAllow(doc, catalog);
    expect(codes(result)).toEqual([['unknown-variant', '$.allow.button.variants[0]']]);
    for (const issue of result.errors) {
      expect(issue.message.length).toBeLessThan(80);
      expect(issue.message).not.toMatch(/__proto__/);
    }
  });
});

describe('invalid fixtures cover every new locked code', () => {
  it('matches each locked invalid fixture', () => {
    const catalogCodes = new Set<string>(DESIGN_SYSTEM_ALLOW_CODES);
    for (const code of [
      'approval-invalid',
      'unknown-component',
      'unknown-variant',
      'unknown-size',
      'unknown-tone',
      'unknown-density',
      'unknown-state',
    ]) {
      const fixture = json<{
        expect: [string, string][];
        catalog?: DesignSystemAllowCatalog;
        document: unknown;
      }>(`fixtures/design-systems/invalid/${code}.json`);
      const result = catalogCodes.has(code)
        ? checkDesignSystemAllow(fixture.document, fixture.catalog as DesignSystemAllowCatalog)
        : validateDesignSystem(fixture.document);
      expect(codes(result), code).toEqual(fixture.expect);
    }
  });
});
