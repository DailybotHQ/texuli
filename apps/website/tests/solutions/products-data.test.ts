import { describe, expect, it } from 'vitest';
import {
  assertProductEntries,
  assertProductEntry,
  LISTED_PRODUCTS,
  PRODUCT_BY_ID,
  PRODUCTS,
  RONIN_BUILDER,
} from '../../src/data/products/index.ts';

const CURRENT_PROTOYARD_AUDIT =
  '.dwp/plans/PLAN_015_ecosystem_solutions_native_site/analysis_results/audit/protoyard-capabilities-current.md';
const FACTS_F51 =
  '.dwp/plans/PLAN_015_ecosystem_solutions_native_site/analysis_results/audit/facts.md#F-51';

describe('Built with Texuli product data', () => {
  it('validates every product and cites the current audit and facts', () => {
    expect(() => assertProductEntries(PRODUCTS)).not.toThrow();
    for (const product of PRODUCTS) {
      const sources = product.evidence.map(({ source }) => source);
      expect(sources).toContain(CURRENT_PROTOYARD_AUDIT);
      expect(sources).toContain(FACTS_F51);
      expect(product.evidence.every(({ claim }) => claim.trim().length > 0)).toBe(true);
    }
  });

  it('lists the verified local Protoyard product and keeps its Cloud roadmap planned', () => {
    const protoyard = PRODUCT_BY_ID.get('protoyard');
    expect(protoyard).toMatchObject({
      name: 'Protoyard',
      group: 'owner',
      visibility: 'listed',
      status: 'available',
      domain: 'protoyard.app',
    });
    expect(protoyard?.offerings).toContainEqual(
      expect.objectContaining({ id: 'open-source-local', status: 'available' })
    );
    expect(protoyard?.offerings).toContainEqual(
      expect.objectContaining({ id: 'cloud', label: 'Protoyard Cloud', status: 'planned' })
    );
    expect(
      protoyard?.offerings.some(({ id, status }) => id === 'cloud' && status === 'available')
    ).toBe(false);
    expect(LISTED_PRODUCTS.map(({ id }) => id)).toEqual(['protoyard']);
  });

  it('keeps Ronin Builder unlisted and planned, with no invented domain or available offering', () => {
    expect(RONIN_BUILDER).toMatchObject({
      name: 'Ronin Builder',
      visibility: 'unlisted',
      status: 'planned',
      domain: null,
    });
    expect(RONIN_BUILDER.offerings.every(({ status }) => status === 'planned')).toBe(true);
    expect(LISTED_PRODUCTS).not.toContain(RONIN_BUILDER);
  });

  it('rejects invalid statuses, open-ended fields, missing evidence and duplicate ids', () => {
    expect(() => assertProductEntry({ ...RONIN_BUILDER, status: 'launched' })).toThrow(
      'Invalid product status.'
    );
    expect(() => assertProductEntry({ ...RONIN_BUILDER, pricing: 'free' })).toThrow(
      'A product entry must use the product schema fields only.'
    );
    expect(() => assertProductEntry({ ...RONIN_BUILDER, evidence: [] })).toThrow(
      'A product entry needs audit evidence.'
    );
    expect(() => assertProductEntries([RONIN_BUILDER, RONIN_BUILDER])).toThrow(
      'Duplicate product id: ronin-builder'
    );
  });
});
