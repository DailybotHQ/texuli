/**
 * Copy and facts for the Protoyard case study (`/built-with/protoyard/`, vision §40.3,
 * §18.2). The product record (name, status, domain, offerings and evidence) comes from
 * `data/products` (`PROTOYARD`). The verified capabilities and the Texuli packages come
 * from the Protoyard capability audit of 2026-11-08: Protoyard 1.5.0 (local checkout), built on
 * Texuli 0.14.2. Each claim on this page carries the id of its audit row in `source`, so
 * the test can check them all. Protoyard Cloud is roadmap only: it renders under a
 * "Roadmap" heading with a planned badge and is never called available.
 */
import { PROTOYARD } from '../../../data/products/index.ts';
import type { ProductStatus } from '../../../data/products/schema.ts';

export const PROTOYARD_PRODUCT = PROTOYARD;

/** The external product site, from the product record's domain. */
export const PROTOYARD_SITE = `https://${PROTOYARD.domain}`;

/** Audit rows the page cites (the golden-path stages and the package table). */
export type ProtoyardAuditRow =
  | 'stage-1-brief'
  | 'stage-2-spec'
  | 'stage-3-generation'
  | 'stage-4-iteration'
  | 'stage-5-validation'
  | 'stage-6-export'
  | 'stage-7-hardening'
  | 'stage-8-launch'
  | 'packages'
  | 'boundaries';

export interface ProtoyardClaim {
  readonly title: string;
  readonly body: string;
  /** The audit status of the stage: only `implemented` and `partial` are shown as today. */
  readonly audit: 'implemented' | 'partial';
  readonly source: ProtoyardAuditRow;
}

export const PROTOYARD_PAGE = {
  title: 'Protoyard: prototypes that behave like real apps',
  description:
    'Protoyard is an open-source local prototyping tool built on Texuli. What it does today, which Texuli packages it uses, and what is only on its roadmap.',
  hero: {
    id: 'built-with-protoyard-title',
    eyebrow: 'Built with Texuli',
    title: 'Protoyard',
    lede: 'Build prototypes that behave like real apps. Open-source local prototyping today, built on Texuli components and themes.',
    cta: { label: 'Visit protoyard.app', href: PROTOYARD_SITE },
    art: 'built-with-protoyard',
  },
  job: {
    id: 'built-with-protoyard-job',
    title: 'The job it does',
    body: 'Protoyard helps a team explore, prototype, compare and validate a product idea before building it: a brief becomes a working prototype that people can click through, review and export.',
  },
  today: {
    id: 'built-with-protoyard-today',
    title: 'What works today',
    intro:
      'The open-source local version, as audited on 8 November 2026 (Protoyard 1.5.0). Each item is a command of its CLI.',
  },
  built: {
    id: 'built-with-protoyard-built',
    title: 'What is built with Texuli',
    intro:
      'In the 8 November 2026 audit, Protoyard 1.5.0 kits declare these Texuli 0.14.2 packages. Protoyard keeps its own blueprint format and player.',
  },
  roadmap: {
    id: 'built-with-protoyard-roadmap',
    title: 'Roadmap',
    intro: 'Planned, not available. Nothing below is part of the open-source version today.',
  },
  pathway: {
    id: 'built-with-protoyard-pathway',
    title: 'Want to build something like this?',
    body: 'Protoyard composes the same Texuli components, themes and engines you can install today.',
  },
} as const;

/** Verified capabilities of the open-source local version (audit golden path, stages 1–6). */
export const PROTOYARD_TODAY: readonly ProtoyardClaim[] = [
  {
    title: 'From a brief to a blueprint',
    body: 'The CLI turns a prose brief into a prototype blueprint offline.',
    audit: 'partial',
    source: 'stage-1-brief',
  },
  {
    title: 'A spec beside every prototype',
    body: 'Each prototype keeps its own spec and agent instructions, checked by the CLI.',
    audit: 'implemented',
    source: 'stage-2-spec',
  },
  {
    title: 'Generate and restyle',
    body: 'Quick prototypes and generated apps, restyled with Texuli design systems.',
    audit: 'partial',
    source: 'stage-3-generation',
  },
  {
    title: 'Iterate locally',
    body: 'Variants, undo and review comments, all on your machine.',
    audit: 'implemented',
    source: 'stage-4-iteration',
  },
  {
    title: 'Validate with scenarios',
    body: 'Scenarios and personas exercise a prototype, and validation builds it.',
    audit: 'partial',
    source: 'stage-5-validation',
  },
  {
    title: 'Export and publish a prototype',
    body: 'Export a prototype as a zip, or publish it to a static host.',
    audit: 'partial',
    source: 'stage-6-export',
  },
];

/** The Texuli packages Protoyard 1.5.0's kits declare (audit package table, 2026-11-08). */
export const PROTOYARD_TEXULI_PACKAGES: readonly string[] = [
  'texuli',
  '@texuli/core',
  '@texuli/primitives',
  '@texuli/tokens',
  '@texuli/data',
  '@texuli/date',
  '@texuli/charts',
  '@texuli/chat',
  '@texuli/blocks',
  '@texuli/forms',
  '@texuli/document',
  '@texuli/pages',
  '@texuli/canvas',
  '@texuli/sheets',
];

export interface ProtoyardRoadmapItem {
  readonly title: string;
  readonly body: string;
  readonly status: Extract<ProductStatus, 'planned'>;
  readonly source: ProtoyardAuditRow;
}

/** Roadmap only. Each item is absent from the audited checkout. */
export const PROTOYARD_ROADMAP: readonly ProtoyardRoadmapItem[] = [
  {
    title: 'Protoyard Cloud',
    body: 'Collaborative prototyping in the cloud: a shared, multiplayer workspace where teams turn ideas into products, with hosted agents.',
    status: 'planned',
    source: 'boundaries',
  },
  {
    title: 'Production hardening',
    body: 'Real authentication, billing and AI providers instead of the simulated ones in prototypes.',
    status: 'planned',
    source: 'stage-7-hardening',
  },
  {
    title: 'From prototype to launch',
    body: 'Handing a validated prototype to an independent production product and its launch.',
    status: 'planned',
    source: 'stage-8-launch',
  },
];

/** Texuli routes the developer pathway links, kept only when their page exists. */
export const PROTOYARD_PATHWAY_LINKS = [
  { label: 'Get started with Texuli', href: '/guides/getting-started/' },
  { label: 'Browse components', href: '/component-pages/' },
  { label: 'Explore Solutions', href: '/solutions/' },
  { label: 'Design systems', href: '/design-systems/' },
  { label: 'The Design Systems Solution', href: '/solutions/design-systems/' },
] as const;
