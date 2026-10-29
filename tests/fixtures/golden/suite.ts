/**
 * Golden fixture suite for the PLAN_002 expressiveness audit screens
 * (fixtures 01-08), promoted from the audit's scratch validator to a
 * CI-shaped regression gate.
 *
 * The eight JSON fixtures are verbatim copies of the audit's screens
 * (fictional data only). `golden-expectations.json` records, per fixture,
 * the catalog's behavior on the day the suite was pinned: render codes,
 * grammar issues, sinks, tools guidance, node counts at the fixture tier and
 * at the opposite tier, the artifact frame chrome, and every probe's
 * outcome. `compareGoldenFixtures` recomputes all of it and reports drift as
 * a list of findings; an empty list means no drift.
 *
 * The `expect` arrays inside the fixtures are historical audit provenance and
 * are deliberately not enforced here — the normative-tier decision (D5) and
 * the block-family checks landed after the audit and renamed several of
 * those outcomes (see README.md).
 *
 * Repo-level test code, not a package: deep imports into package sources
 * follow the `scripts/tests` precedent, and `scripts/check-layers.ts` does
 * not scan `tests/`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  artifactChrome,
  createArtifactFrame,
} from '../../../packages/catalog/src/render/frame/index.ts';
import {
  checkCompositionGrammar,
  defaultGrammarRoles,
} from '../../../packages/catalog/src/render/grammar/index.ts';
import { validateCatalogTreeLimits } from '../../../packages/catalog/src/render/limits/index.ts';
import {
  type RenderCatalog,
  type RenderNode,
  renderCatalogTree,
} from '../../../packages/catalog/src/render/renderer/index.ts';
import { scanSinks } from '../../../packages/catalog/src/validate/index.ts';

/** The pinned fixture files; the directory must hold exactly these. */
export const GOLDEN_FIXTURE_FILES = [
  '01-landing-page.json',
  '02-dashboard.json',
  '03-settings-form.json',
  '04-checkout-flow.json',
  '05-chat-thread.json',
  '06-presentation-slide.json',
  '07-report-on-demand.json',
  '08-proactive-deck.json',
  '09-document-brief.json',
] as const;

const EXPECTATIONS_FILE = 'golden-expectations.json';

export type GoldenTier = 'developer' | 'untrusted';

export interface GoldenTreeNode {
  id: string;
  props?: Record<string, unknown>;
  children?: readonly GoldenTreeNode[];
}

export interface GoldenProbe {
  gap: string;
  intent?: string;
  tier?: GoldenTier;
  tree: GoldenTreeNode;
  /** Audit-day expectation; kept for provenance, not enforced. */
  expect: readonly string[];
}

export interface GoldenFixture {
  fixture: string;
  tier: GoldenTier;
  tree: GoldenTreeNode;
  frame?: { label: string; source: string } | null;
  probes?: readonly GoldenProbe[];
}

export interface GoldenFrameExpectation {
  ok: boolean;
  label: string;
  badge: string;
}

export interface GoldenProbeExpectation {
  gap: string;
  tier: GoldenTier;
  codes: readonly string[];
  placeholders: number;
}

export interface GoldenFixtureExpectation {
  tier: GoldenTier;
  nodes: number;
  components: number;
  placeholders: number;
  codes: readonly string[];
  grammar: readonly string[];
  sinks: readonly string[];
  guidance: readonly string[];
  cross: { tier: GoldenTier; codes: readonly string[]; placeholders: number };
  frame: GoldenFrameExpectation | null;
  probes: readonly GoldenProbeExpectation[];
}

export interface GoldenExpectations {
  $comment: string;
  catalogEntries: number;
  fixtures: Readonly<Record<string, GoldenFixtureExpectation>>;
}

/** Optional tools-side guidance check (`checkGuidance` from `@texuli/tools`). */
export type GuidanceCheck = (tree: unknown) => readonly string[];

export interface GoldenCompareOptions {
  /** Defaults to this suite's own directory. */
  dir?: string;
  /** Only the standalone runner injects this; the catalog gate test does not. */
  checkGuidance?: GuidanceCheck;
  /** The build's entry count, pinned as `catalogEntries`. */
  catalogEntries?: number;
}

export interface GoldenEvaluation {
  codes: string[];
  grammar: string[];
  sinks: string[];
  guidance: string[];
  nodes: number;
  components: number;
  placeholders: number;
}

export interface GoldenProbeEvaluation {
  gap: string;
  tier: GoldenTier;
  codes: readonly string[];
  placeholders: number;
}

export interface GoldenFrameEvaluation {
  ok: boolean;
  label: string;
  badge: string;
}

function otherTier(tier: GoldenTier): GoldenTier {
  return tier === 'developer' ? 'untrusted' : 'developer';
}

interface SeenNode {
  path: string;
  node: GoldenTreeNode;
}

function walkTree(node: GoldenTreeNode, path: string, out: SeenNode[]): void {
  out.push({ path, node });
  const children = node.children ?? [];
  for (const [index, child] of children.entries()) {
    walkTree(child, `${path}.children.${String(index)}`, out);
  }
}

function countRendered(roots: readonly RenderNode[]): { components: number; placeholders: number } {
  let components = 0;
  let placeholders = 0;
  const visit = (node: RenderNode): void => {
    if (node.kind === 'placeholder') {
      placeholders += 1;
    } else {
      components += 1;
      node.children.forEach(visit);
    }
  };
  roots.forEach(visit);
  return { components, placeholders };
}

function returnEmpty(): readonly string[] {
  return [];
}

/**
 * Everything the suite pins about one tree at one tier, computed from the
 * catalog as it behaves today. Codes are sorted and deduplicated; the
 * expectations file stores the same shape.
 */
export function evaluateGoldenTree(
  catalog: RenderCatalog,
  tree: GoldenTreeNode,
  tier: GoldenTier,
  checkGuidance?: GuidanceCheck
): GoldenEvaluation {
  const codes = new Set<string>();
  const limits = validateCatalogTreeLimits(tree);
  if (!limits.ok) for (const diagnostic of limits.diagnostics) codes.add(diagnostic.code);
  const { roots, diagnostics } = renderCatalogTree(tree, { catalog, tier });
  for (const diagnostic of diagnostics) codes.add(diagnostic.code);
  const seen: SeenNode[] = [];
  walkTree(tree, '0', seen);
  const counted = countRendered(roots);
  if (counted.components + counted.placeholders < seen.length) codes.add('node-dropped');
  const grammar = checkCompositionGrammar(roots, { roles: defaultGrammarRoles, mode: 'report' });
  return {
    codes: [...codes].sort(),
    grammar: [...new Set(grammar.issues.map((issue) => issue.code))].sort(),
    sinks: [
      ...new Set(scanSinks(tree).map((finding) => `${finding.path}: ${finding.message}`)),
    ].sort(),
    guidance: [...new Set((checkGuidance ?? returnEmpty)(tree))].sort(),
    nodes: seen.length,
    ...counted,
  };
}

export function evaluateGoldenProbe(
  catalog: RenderCatalog,
  probe: GoldenProbe,
  fallbackTier: GoldenTier,
  checkGuidance?: GuidanceCheck
): GoldenProbeEvaluation {
  const tier = probe.tier ?? fallbackTier;
  const evaluation = evaluateGoldenTree(catalog, probe.tree, tier, checkGuidance);
  return { gap: probe.gap, tier, codes: evaluation.codes, placeholders: evaluation.placeholders };
}

export function evaluateGoldenFrame(
  catalog: RenderCatalog,
  tree: GoldenTreeNode,
  frame: { label: string; source: string }
): GoldenFrameEvaluation {
  const created = createArtifactFrame({ ...frame, catalog, tree });
  const chrome = artifactChrome(created);
  return { ok: chrome.ok, label: chrome.label, badge: chrome.badge };
}

function jsonOf(value: unknown): string {
  return JSON.stringify(value);
}

function driftFor(label: string, expected: unknown, actual: unknown): string {
  return `${label}: ${jsonOf(expected)} -> ${jsonOf(actual)}`;
}

/**
 * Recompute every pinned expectation and return the drift findings. An empty
 * list means today's catalog behaves exactly as pinned. Also fails on
 * structural drift: a fixture file added or removed without a matching
 * expectations update, or the reverse.
 */
export function compareGoldenFixtures(
  catalog: RenderCatalog,
  options: GoldenCompareOptions = {}
): string[] {
  const dir = options.dir ?? fileURLToPath(new URL('./', import.meta.url));
  const expectations = JSON.parse(
    readFileSync(`${dir}/${EXPECTATIONS_FILE}`, 'utf8')
  ) as GoldenExpectations;
  const guidance = options.checkGuidance;
  const drift: string[] = [];

  const onDisk = readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== EXPECTATIONS_FILE)
    .sort();
  const expectedFiles = [...GOLDEN_FIXTURE_FILES].sort();
  if (jsonOf(onDisk) !== jsonOf(expectedFiles)) {
    drift.push(`fixture files ${jsonOf(expectedFiles)} -> ${jsonOf(onDisk)}`);
  }
  const pinned = Object.keys(expectations.fixtures).sort();
  const stems = onDisk.map((file) => file.replace(/\.json$/, '')).sort();
  if (jsonOf(stems) !== jsonOf(pinned)) {
    drift.push(`pinned fixture keys ${jsonOf(pinned)} -> ${jsonOf(stems)}`);
  }
  if (
    options.catalogEntries !== undefined &&
    options.catalogEntries !== expectations.catalogEntries
  ) {
    drift.push(
      `catalogEntries ${String(expectations.catalogEntries)} -> ${String(options.catalogEntries)}`
    );
  }

  for (const file of GOLDEN_FIXTURE_FILES) {
    const fixture = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')) as GoldenFixture;
    const name = fixture.fixture;
    const want: GoldenFixtureExpectation | undefined = expectations.fixtures[name];
    if (!want) {
      drift.push(`${name}: not pinned in ${EXPECTATIONS_FILE}`);
      continue;
    }
    const main = evaluateGoldenTree(catalog, fixture.tree, fixture.tier, guidance);
    if (want.tier !== fixture.tier)
      drift.push(`${name}: tier ${jsonOf(want.tier)} -> ${jsonOf(fixture.tier)}`);
    for (const key of ['nodes', 'components', 'placeholders'] as const) {
      if (main[key] !== want[key])
        drift.push(`${name}: ${key} ${String(want[key])} -> ${String(main[key])}`);
    }
    for (const key of ['codes', 'grammar', 'sinks', 'guidance'] as const) {
      if (jsonOf(main[key]) !== jsonOf(want[key]))
        drift.push(driftFor(`${name}.${key}`, want[key], main[key]));
    }
    const crossTier = otherTier(fixture.tier);
    const cross = evaluateGoldenTree(catalog, fixture.tree, crossTier, guidance);
    if (want.cross.tier !== crossTier)
      drift.push(`${name}.cross.tier ${jsonOf(want.cross.tier)} -> ${jsonOf(crossTier)}`);
    if (cross.placeholders !== want.cross.placeholders) {
      drift.push(
        `${name}.cross.placeholders ${String(want.cross.placeholders)} -> ${String(cross.placeholders)}`
      );
    }
    if (jsonOf(cross.codes) !== jsonOf(want.cross.codes)) {
      drift.push(driftFor(`${name}.cross.codes`, want.cross.codes, cross.codes));
    }
    if (fixture.frame) {
      const got = evaluateGoldenFrame(catalog, fixture.tree, fixture.frame);
      if (jsonOf(got) !== jsonOf(want.frame))
        drift.push(driftFor(`${name}.frame`, want.frame, got));
    } else if (want.frame !== null) {
      drift.push(`${name}.frame pinned ${jsonOf(want.frame)} but the fixture has no frame`);
    }
    const probes = fixture.probes ?? [];
    if (probes.length !== want.probes.length) {
      drift.push(`${name}: probe count ${String(want.probes.length)} -> ${String(probes.length)}`);
    }
    probes.forEach((probe, index) => {
      const wantProbe: GoldenProbeExpectation | undefined = want.probes[index];
      if (!wantProbe) return;
      const got = evaluateGoldenProbe(catalog, probe, fixture.tier, guidance);
      if (got.gap !== wantProbe.gap) {
        drift.push(
          `${name} probe ${String(index)}: gap ${jsonOf(wantProbe.gap)} -> ${jsonOf(got.gap)}`
        );
        return;
      }
      if (got.tier !== wantProbe.tier)
        drift.push(
          `${name} probe ${got.gap}: tier ${jsonOf(wantProbe.tier)} -> ${jsonOf(got.tier)}`
        );
      if (got.placeholders !== wantProbe.placeholders) {
        drift.push(
          `${name} probe ${got.gap}: placeholders ${String(wantProbe.placeholders)} -> ${String(got.placeholders)}`
        );
      }
      if (jsonOf(got.codes) !== jsonOf(wantProbe.codes)) {
        drift.push(driftFor(`${name} probe ${got.gap}.codes`, wantProbe.codes, got.codes));
      }
    });
  }
  return drift;
}
