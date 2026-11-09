import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertProductEntries,
  assertProductEntry,
  LISTED_PRODUCTS,
  PRODUCT_BY_ID,
  PRODUCTS,
  RONIN_BUILDER,
} from '../../src/data/products/index.ts';

const REPO = resolve(import.meta.dirname, '../../../..');
const ADR_027 = 'docs/DECISIONS.md#adr-027-solutions-capabilities-components-and-products';

/** A public source: an https URL, or a committed repository file (never git-ignored `.dwp/`). */
function isPublicSource(source: string): boolean {
  if (source.startsWith('https://')) return true;
  if (source.startsWith('.dwp/')) return false;
  return existsSync(resolve(REPO, source.split('#')[0] ?? ''));
}

describe('Built with Texuli product data', () => {
  it('validates every product and cites only public sources, including the products ADR', () => {
    expect(() => assertProductEntries(PRODUCTS)).not.toThrow();
    for (const product of PRODUCTS) {
      const sources = product.evidence.map(({ source }) => source);
      for (const source of sources) expect(isPublicSource(source), source).toBe(true);
      expect(sources).toContain(ADR_027);
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
