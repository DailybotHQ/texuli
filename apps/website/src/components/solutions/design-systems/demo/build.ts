/**
 * Build-time data for the design-systems demo (PLAN_017 T-demo). Runs in the Astro section
 * only: each fictional brand input goes through `generateDesignSystem` (the function behind
 * `texuli ds generate` and `ds.generate`), then `compileDesignSystem`, and the compiled
 * variables become CSS through `designSystemStyle` (scoped to `[data-tx-ds="<id>"]`, light
 * and dark). The browser receives only that CSS and a short report summary, so no compiler
 * ships in the island. The locked check of the sample prototype runs here too, once per
 * toggle combination, with `usageFromBlueprint` and `checkLockedUsage` against the agent
 * catalog (`loadMergedCatalog([])`): the functions `texuli ds validate --locked --prototype`
 * runs.
 */
import { designSystemStyle } from '@texuli/tokens/design-system/apply';
import { compileDesignSystem } from '@texuli/tokens/design-system/compile';
import { generateDesignSystem } from '@texuli/tokens/design-system/generate';
import {
  checkLockedUsage,
  type LockedCatalog,
  loadMergedCatalog,
  locationText,
  usageFromBlueprint,
} from '@texuli/tools/ds-check';
import { DEMO_BRAND_INPUTS, type DemoBrandInput } from './fixtures/brands.ts';
import {
  DEMO_PROTOTYPE,
  type DemoFinding,
  demoAllow,
  demoToggleCombinations,
  demoToggleKey,
} from './model.ts';

/** One grouped line of the generation report: what changed, where, and how often. */
export interface DemoReportLine {
  readonly path: string;
  readonly reason: string;
  readonly count: number;
}

export interface DemoBrand extends DemoBrandInput {
  /** The scope attributes the compiled design system sets (`data-tx-ds`, surface…). */
  readonly attrs: Readonly<Record<string, string>>;
  readonly losses: readonly DemoReportLine[];
  readonly repairs: readonly DemoReportLine[];
  readonly guaranteesPassed: boolean;
  /** The `texuli ds generate` command that makes the same draft. */
  readonly command: string;
}

export interface DemoBuild {
  readonly brands: readonly DemoBrand[];
  /** The locked check findings per toggle combination (`demoToggleKey`). */
  readonly checks: Readonly<Record<string, readonly DemoFinding[]>>;
  /** The scoped CSS of every brand, light and dark (trusted: built here, sanitized by designSystemStyle). */
  readonly css: string;
}

function group(lines: readonly { path: string; reason: string }[]): DemoReportLine[] {
  const out = new Map<string, DemoReportLine>();
  for (const { path, reason } of lines) {
    const key = `${path}\u0000${reason}`;
    const seen = out.get(key);
    out.set(key, { path, reason, count: (seen?.count ?? 0) + 1 });
  }
  return [...out.values()];
}

function input(brand: DemoBrandInput) {
  if (brand.kind === 'brief') return { brief: brand.source };
  if (brand.kind === 'tokens') return { tokens: brand.source };
  return { css: brand.source };
}

const FILES: Readonly<Record<DemoBrandInput['kind'], string>> = {
  brief: '',
  tokens: 'tokens/brand.tokens.json',
  css: 'src/brand.css',
};

function command(brand: DemoBrandInput): string {
  const value = brand.kind === 'brief' ? JSON.stringify(brand.source) : FILES[brand.kind];
  return `texuli ds generate ${brand.flag} ${value} -o design-systems/${brand.id}.ds.json`;
}

/** The locked check of the sample prototype for every toggle combination. */
export function checkDemoCombinations(
  catalog: LockedCatalog
): Record<string, readonly DemoFinding[]> {
  const usages = usageFromBlueprint(DEMO_PROTOTYPE);
  const checks: Record<string, readonly DemoFinding[]> = {};
  for (const toggles of demoToggleCombinations()) {
    const report = checkLockedUsage(usages, {
      catalog,
      allowManifest: { allow: demoAllow(toggles) },
    });
    checks[demoToggleKey(toggles)] = report.errors.map((issue) => ({
      code: issue.code,
      path: locationText(issue.location),
      message: issue.message,
    }));
  }
  return checks;
}

/** Generate and compile every demo brand and check the prototype; throws at build time if a brand fails. */
export async function buildDesignSystemsDemo(
  inputs: readonly DemoBrandInput[] = DEMO_BRAND_INPUTS
): Promise<DemoBuild> {
  const brands: DemoBrand[] = [];
  const css: string[] = [];
  for (const brand of inputs) {
    const generated = generateDesignSystem(input(brand), { id: brand.id, name: brand.name });
    if (!generated.ok) throw new Error(`Demo brand ${brand.id} did not generate.`);
    const compiled = compileDesignSystem(generated.document);
    if (!compiled.ok) throw new Error(`Demo brand ${brand.id} did not compile.`);
    css.push(designSystemStyle(compiled));
    const attrs: Record<string, string> = {};
    for (const [name, value] of Object.entries(compiled.attrs ?? {}))
      if (typeof value === 'string') attrs[name] = value;
    brands.push({
      ...brand,
      attrs,
      losses: group(generated.report.losses),
      repairs: group(generated.report.repairs),
      guaranteesPassed: generated.report.guarantees.passed,
      command: command(brand),
    });
  }
  const merged = await loadMergedCatalog([]);
  return { brands, checks: checkDemoCombinations(merged.catalog), css: css.join('\n') };
}
