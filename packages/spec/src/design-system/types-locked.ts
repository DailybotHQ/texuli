/**
 * The locked design-system sections (ADR-032): `allow`, `library` and
 * `approval`, as nodes of the closed vocabulary table (`./vocabulary.ts`
 * spreads them into `DS_DEFS` and the document root). Structural only: the
 * shapes, caps and patterns `validateDesignSystem` and the generated schema
 * enforce. Catalog membership (an unknown component id, or a variant, size,
 * tone, density or state the catalog does not list) is checked against the
 * catalog by `checkDesignSystemAllow`, never here, so the bundled validator
 * never carries the catalog.
 *
 * Self-contained on purpose: `./vocabulary.ts` imports this module, so it
 * takes only a type from there.
 */
import type { DsNode } from './vocabulary.ts';

/** Caps of the locked sections (counts of entries and items). */
export const DS_LOCKED_LIMITS = Object.freeze({
  /** Components in `allow` (the agent catalog lists 170 today). */
  allowComponents: 256,
  /** Values in one `allow` axis list (variants, sizes, tones or densities). */
  axisValues: 32,
  /** Entries in `library`. */
  library: 64,
  /** Catalog ids one library entry composes. */
  composes: 32,
});

/** The closed state vocabulary of the catalog (ADR-032). */
export const DS_COMPONENT_STATES = [
  'hover',
  'focus-visible',
  'active',
  'disabled',
  'loading',
  'invalid',
  'selected',
  'expanded',
  'checked',
  'open',
  'readonly',
] as const;

/** Approval states of the document and of each library entry. */
export const DS_APPROVAL_STATUSES = ['draft', 'approved'] as const;

const ID = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
const SEMVER =
  '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?';

/** Patterns of the locked sections (also written into the schema). */
export const DS_LOCKED_PATTERNS = {
  /** A catalog component id or a library entry id (kebab-case, at most 48 characters). */
  componentId: new RegExp(`^(?=.{1,48}$)${ID}$`),
  /** One axis value as the catalog writes it (an enum prop value, for example `sm` or `h1`). */
  axisValue: /^[A-Za-z0-9][A-Za-z0-9_-]{0,47}$/,
  semver: new RegExp(`^${SEMVER}$`),
  /** An ISO 8601 UTC date-time, for example `2026-11-09T14:30:00Z` (seconds and fraction optional). */
  dateTime:
    /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?Z$/,
  /** A lowercase hex SHA-256. */
  sha256: /^[0-9a-f]{64}$/,
};

const P = DS_LOCKED_PATTERNS;
const L = DS_LOCKED_LIMITS;
const axis: DsNode = ['l', ['s', P.axisValue, 48], 0, L.axisValues, 1];

/**
 * The named definitions of the locked sections. `allow` is a document
 * section (it inherits through `extends`, and variants and patches may
 * narrow it); `library` and `approval` are root keys only.
 */
export const DS_LOCKED_DEFS: Readonly<Record<string, DsNode>> = {
  approvalStatus: ['e', DS_APPROVAL_STATUSES.join(' ')],
  componentState: ['e', DS_COMPONENT_STATES.join(' ')],
  allowEntry: {
    variants: axis,
    sizes: axis,
    tones: axis,
    densities: axis,
    states: ['l', 'componentState', 0, DS_COMPONENT_STATES.length, 1],
  },
  allow: ['m', 'allowEntry', L.allowComponents, P.componentId],
  approval: {
    'status!': 'approvalStatus',
    approvedBy: ['t', 120],
    approvedAt: ['s', P.dateTime, 32],
    'version!': ['s', P.semver, 64],
    contentHash: ['s', P.sha256, 64],
  },
  libraryEntry: {
    'id!': ['s', P.componentId, 48],
    'name!': ['t', 80],
    'purpose!': ['t', 300],
    'version!': ['s', P.semver, 64],
    'status!': 'approvalStatus',
    'composes!': ['l', ['s', P.componentId, 48], 1, L.composes, 1],
    approval: 'approval',
  },
  library: ['l', 'libraryEntry', 0, L.library],
};
