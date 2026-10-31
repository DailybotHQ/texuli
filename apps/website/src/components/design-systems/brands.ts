/**
 * The three fictional example brands of docs/DESIGN_SYSTEMS.md
 * (`examples/design-systems/`), checked and compiled at build time for
 * /design-systems/ (PLAN_011 T-site-0100), read through the MCP resource
 * that serves them. `checkDesignSystem` is the static
 * half of `texuli ds check`: the spec's validation, the `extends` chain
 * (`texuli:slate-masthead` loads from the theme library), the compile of the
 * base document and its high-contrast variant, and the guarantees re-checked.
 * The page applies the base compile through `DesignSystemProvider` and
 * `designSystemStyle`, so no compiler and no script reach the browser.
 */
import type { CompiledDesignSystem } from '@texuli/tokens/design-system/compile';
import { checkDesignSystem } from '@texuli/tools/ds-check';
import { texuliResources } from '@texuli/tools/mcp';
import { type BrandConformance, summarizeConformance } from './conformance.ts';

export type BrandId = 'quillmark' | 'ledgerline' | 'tumbletown';

/** What each brand demonstrates (the guide's table, docs/DESIGN_SYSTEMS.md#example-brands). */
export const BRAND_NOTES: Readonly<Record<BrandId, { character: string; shows: string }>> = {
  quillmark: {
    character: 'A literary magazine: warm paper neutrals, a terracotta seed, a serif body.',
    shows:
      'A brand seed with a warm neutral, type families and roles, flat surfaces, outline buttons by default.',
  },
  ledgerline: {
    character: 'A finance back office: dense spacing, 14 px base type, crisp edges.',
    shows:
      'extends: "texuli:slate-masthead", small buttons by default, a high-contrast variant held to AAA.',
  },
  tumbletown: {
    character: 'A family game studio: 20 px radius, pill buttons, expressive motion.',
    shows:
      'The brand pink pinned exactly, 44 px targets (control heights lifted), a glow focus ring.',
  },
};

/** The brands, in page order. */
export const BRAND_IDS: readonly BrandId[] = ['quillmark', 'ledgerline', 'tumbletown'];

/**
 * One example document, read exactly as the MCP serves it
 * (`texuli://design-system/<id>`); `@texuli/tools` keeps that copy equal to
 * the file in examples/design-systems/ (its `ds-ops` test).
 */
export async function brandDocument(id: BrandId): Promise<Record<string, unknown>> {
  const contents = await texuliResources.read(`texuli://design-system/${id}`);
  const text = contents?.[0] && 'text' in contents[0] ? contents[0].text : undefined;
  if (typeof text !== 'string') throw new Error(`No example design system named ${id}`);
  return JSON.parse(text) as Record<string, unknown>;
}

export interface Brand {
  id: BrandId;
  name: string;
  version: string;
  description: string;
  extends: string | null;
  seed: string;
  /** The base document compiled (light and dark), applied by the previews. */
  compiled: CompiledDesignSystem;
  conformance: BrandConformance;
  character: string;
  shows: string;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

async function load(id: BrandId): Promise<Brand> {
  const document = await brandDocument(id);
  const report = await checkDesignSystem(document);
  const compiled = report.runs.find((run) => run.variant === null)?.compiled;
  if (!report.ok || !compiled) {
    throw new Error(
      `The example brand ${id} does not pass texuli ds check: ${report.codes.join(', ')}`
    );
  }
  const color = document.color as { brand?: { seed?: unknown } } | undefined;
  return {
    id,
    name: text(document.name),
    version: text(document.version),
    description: text(document.description),
    extends: text(document.extends) || null,
    seed: text(color?.brand?.seed),
    compiled,
    conformance: summarizeConformance(report),
    ...BRAND_NOTES[id],
  };
}

let cached: Promise<Brand[]> | undefined;

/** Every brand, checked and compiled once per build (the page and the stylesheet share it). */
export function loadBrands(): Promise<Brand[]> {
  cached ??= Promise.all(BRAND_IDS.map(load));
  return cached;
}
