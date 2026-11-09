/**
 * Content for the /native/ "One blueprint, many renderers" diagram. The blueprint shown is
 * a real golden fixture (`packages/spec/fixtures/golden/brand-report.json`), read raw at
 * build time and never retyped; its conformance trace is
 * `native/conformance/expected/brand-report.trace.json`. Renderer statuses reuse the
 * native hero's derivation from `NATIVE_COMPATIBILITY`, and the per-component paint status
 * comes from the same data, so no count or status is typed here.
 */
import { NATIVE_COMPATIBILITY } from '../../../../data/native/compatibility.ts';
import type { SolutionStatus } from '../../../../data/solutions/schema.ts';
import { REPOSITORY_URL } from '../../../foundation/site.ts';
import { nativeHeroStatus } from '../hero/hero-content.ts';

export const BLUEPRINT_FIXTURE = 'packages/spec/fixtures/golden/brand-report.json';
export const BLUEPRINT_TRACE = 'native/conformance/expected/brand-report.trace.json';

const FIXTURE_RAW = import.meta.glob<string>(
  '../../../../../../../packages/spec/fixtures/golden/brand-report.json',
  { query: '?raw', import: 'default', eager: true }
);

interface BlueprintNode {
  readonly id: string;
  readonly children?: readonly BlueprintNode[];
}

interface BlueprintDocument {
  readonly format: string;
  readonly spec: string;
  readonly id: string;
  readonly tree: BlueprintNode;
}

function fixtureSource(): string {
  const raw = Object.values(FIXTURE_RAW)[0];
  if (!raw) throw new Error(`Blueprint diagram: fixture missing (${BLUEPRINT_FIXTURE})`);
  return raw;
}

/** Component ids in tree order, each once. */
export function blueprintComponents(node: BlueprintNode, out: string[] = []): string[] {
  if (!out.includes(node.id)) out.push(node.id);
  for (const child of node.children ?? []) blueprintComponents(child, out);
  return out;
}

export interface RendererView {
  readonly id: string;
  readonly name: string;
  readonly via: string;
  readonly status: SolutionStatus;
  readonly detail: string;
  readonly planned: boolean;
}

export interface FixtureComponentView {
  readonly id: string;
  readonly web: string;
  readonly composeDesktop: string;
}

export interface BlueprintDiagramView {
  readonly headingId: string;
  readonly title: string;
  readonly lede: string;
  readonly specVersion: string;
  readonly blueprintId: string;
  readonly json: string;
  readonly renderers: readonly RendererView[];
  readonly components: readonly FixtureComponentView[];
  readonly summary: string;
  readonly links: readonly Readonly<{ label: string; href: string }>[];
}

const VIA: Readonly<Record<string, string>> = {
  web: '@texuli/player',
  'compose-desktop': 'texuli-compose (Kotlin Multiplatform)',
};

const NAMES: Readonly<Record<string, string>> = {
  web: 'Web player',
  'compose-desktop': 'Compose Desktop',
  android: 'Android',
  ios: 'iOS',
};

export function blueprintDiagram(
  data: typeof NATIVE_COMPATIBILITY = NATIVE_COMPATIBILITY,
  raw: string = fixtureSource()
): BlueprintDiagramView {
  const doc = JSON.parse(raw) as BlueprintDocument;
  if (doc.format !== 'texuli-blueprint') throw new Error('Blueprint diagram: not a blueprint');
  const byId = new Map(data.components.map((c) => [c.id, c]));
  const components = blueprintComponents(doc.tree).map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error(`Blueprint diagram: "${id}" is not in the native parity data`);
    return { id, web: row.web, composeDesktop: row.composeDesktop };
  });
  const renderers = nativeHeroStatus(data).map((row) => ({
    id: row.id,
    name: NAMES[row.id] ?? row.platform,
    via: VIA[row.id] ?? '',
    status: row.status,
    detail: row.detail,
    planned: row.status === 'planned',
  }));
  const painted = components.filter((c) => c.composeDesktop !== 'Unsupported').length;
  const live = renderers.filter((r) => !r.planned).map((r) => r.name);
  const planned = renderers.filter((r) => r.planned).map((r) => r.name);
  const summary =
    `One blueprint is validated by @texuli/spec (spec ${doc.spec}) and painted by ` +
    `${live.join(' and ')}` +
    (planned.length > 0 ? `; ${planned.join(' and ')} are planned.` : '.') +
    ` In the blueprint below, ${painted} of ${components.length} components paint on Compose Desktop.`;
  return {
    headingId: 'native-blueprint-title',
    title: 'One blueprint, many renderers',
    lede: 'A blueprint is a JSON document that describes an interface as a tree of components from the closed catalog. @texuli/spec validates it, the Kotlin models are generated from the same contract, and each renderer paints the same tree.',
    specVersion: doc.spec,
    blueprintId: doc.id,
    json: JSON.stringify(doc, null, 2),
    renderers,
    components,
    summary,
    links: [
      {
        label: 'Open this blueprint on GitHub',
        href: `${REPOSITORY_URL}/blob/main/${BLUEPRINT_FIXTURE}`,
      },
      {
        label: 'See its conformance trace',
        href: `${REPOSITORY_URL}/blob/main/${BLUEPRINT_TRACE}`,
      },
    ],
  };
}
