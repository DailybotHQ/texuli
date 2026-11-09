import { PROTOYARD } from './entries/protoyard.ts';
import { RONIN_BUILDER } from './entries/ronin-builder.ts';
import { assertProductEntries } from './schema.ts';

export * from './schema.ts';
export { PROTOYARD, RONIN_BUILDER };

export const PRODUCTS = [PROTOYARD, RONIN_BUILDER] as const;

assertProductEntries(PRODUCTS);

export const LISTED_PRODUCTS = PRODUCTS.filter((product) => product.visibility === 'listed');
export const PRODUCT_BY_ID = new Map(PRODUCTS.map((product) => [product.id, product] as const));
