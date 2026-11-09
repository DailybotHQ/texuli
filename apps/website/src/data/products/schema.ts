export const PRODUCT_STATUSES = ['available', 'in development', 'experimental', 'planned'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProductGroup = 'owner' | 'community';
export type ProductVisibility = 'listed' | 'unlisted';

export interface ProductOffering {
  id: string;
  label: string;
  status: ProductStatus;
  summary: string;
}

export interface ProductEvidence {
  source: string;
  claim: string;
}

export interface ProductEntry {
  id: string;
  name: string;
  group: ProductGroup;
  visibility: ProductVisibility;
  status: ProductStatus;
  domain: string | null;
  summary: string;
  offerings: readonly ProductOffering[];
  evidence: readonly ProductEvidence[];
}

const PRODUCT_KEYS = [
  'id',
  'name',
  'group',
  'visibility',
  'status',
  'domain',
  'summary',
  'offerings',
  'evidence',
] as const;
const OFFERING_KEYS = ['id', 'label', 'status', 'summary'] as const;
const EVIDENCE_KEYS = ['source', 'claim'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isProductStatus(value: unknown): value is ProductStatus {
  return PRODUCT_STATUSES.includes(value as ProductStatus);
}

function isDomain(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(value))
  );
}

/** Validate the closed, data-only product record contract. */
export function assertProductEntry(value: unknown): asserts value is ProductEntry {
  if (!isRecord(value) || !hasExactKeys(value, PRODUCT_KEYS)) {
    throw new Error('A product entry must use the product schema fields only.');
  }
  if (!/^[a-z][a-z0-9-]*$/.test(String(value.id))) throw new Error('Invalid product id.');
  if (!nonEmptyString(value.name) || !nonEmptyString(value.summary)) {
    throw new Error('A product needs a name and summary.');
  }
  if (value.group !== 'owner' && value.group !== 'community') {
    throw new Error('Invalid product group.');
  }
  if (value.visibility !== 'listed' && value.visibility !== 'unlisted') {
    throw new Error('Invalid product visibility.');
  }
  if (!isProductStatus(value.status)) throw new Error('Invalid product status.');
  if (!isDomain(value.domain)) throw new Error('A product domain must be a hostname or null.');
  if (!Array.isArray(value.offerings) || value.offerings.length === 0) {
    throw new Error('A product needs at least one offering.');
  }
  const offeringIds = new Set<string>();
  for (const offering of value.offerings) {
    if (!isRecord(offering) || !hasExactKeys(offering, OFFERING_KEYS)) {
      throw new Error('A product offering must use the offering schema fields only.');
    }
    if (
      !nonEmptyString(offering.id) ||
      !nonEmptyString(offering.label) ||
      !nonEmptyString(offering.summary) ||
      !isProductStatus(offering.status)
    ) {
      throw new Error('A product offering needs an id, label, status and summary.');
    }
    if (offeringIds.has(offering.id)) throw new Error(`Duplicate product offering: ${offering.id}`);
    offeringIds.add(offering.id);
  }
  if (!Array.isArray(value.evidence) || value.evidence.length === 0) {
    throw new Error('A product entry needs audit evidence.');
  }
  for (const evidence of value.evidence) {
    if (
      !isRecord(evidence) ||
      !hasExactKeys(evidence, EVIDENCE_KEYS) ||
      !nonEmptyString(evidence.source) ||
      !nonEmptyString(evidence.claim)
    ) {
      throw new Error('Each product evidence citation needs a source and claim.');
    }
  }
}

export function assertProductEntries(
  values: readonly unknown[]
): asserts values is readonly ProductEntry[] {
  const ids = new Set<string>();
  for (const value of values) {
    assertProductEntry(value);
    if (ids.has(value.id)) throw new Error(`Duplicate product id: ${value.id}`);
    ids.add(value.id);
  }
}
