import { DECK_LAYOUTS, type DeckCatalogLayoutId, type LayoutPacing } from '../model/index.ts';

export interface LayoutRequest {
  id: string;
  role: string;
  pacing?: LayoutPacing | string;
  purpose?: string;
  layout?: string;
  blockTypes?: readonly string[];
}

export interface LayoutChoice {
  id: string;
  layout: DeckCatalogLayoutId | 'free';
  rationale: string;
  override: boolean;
}

const roleLayouts: Readonly<Record<string, readonly string[]>> = Object.freeze({
  title: ['title-hero'],
  agenda: ['section-divider', 'process-steps'],
  close: ['closing-cta'],
  ask: ['closing-cta'],
  section: ['section-divider'],
  hook: ['title-hero', 'big-stat', 'quote'],
  problem: ['two-column-split', 'image-left'],
  solution: ['three-column-cards', 'process-steps'],
  metrics: ['big-stat', 'chart'],
  chart: ['chart', 'big-stat'],
  comparison: ['comparison-table'],
  team: ['team-avatars'],
  quote: ['quote'],
  steps: ['process-steps'],
  timeline: ['timeline'],
  roadmap: ['timeline', 'process-steps'],
  code: ['code-with-callout'],
  demo: ['image-centered', 'video-centered'],
  findings: ['three-column-cards', 'chart'],
  risks: ['two-column-split'],
  recommendations: ['process-steps'],
});
const blockLayouts: Readonly<Record<string, readonly string[]>> = Object.freeze({
  chart: ['chart'],
  table: ['comparison-table'],
  steps: ['process-steps'],
  timeline: ['timeline'],
  quote: ['quote'],
  code: ['code-with-callout'],
  image: ['image-centered', 'image-left'],
  video: ['video-centered', 'video-left'],
  stat: ['big-stat'],
});
const pacingLayouts: Readonly<Record<LayoutPacing, readonly string[]>> = Object.freeze({
  punch: ['big-stat', 'quote', 'section-divider', 'free'],
  idea: ['two-column-split', 'three-column-cards', 'process-steps', 'free'],
  diagram: ['process-steps', 'timeline', 'chart', 'comparison-table', 'free'],
  story: ['timeline', 'process-steps', 'quote', 'image-full-bleed', 'free'],
});

/** Deterministic role/block/pacing selection; author overrides always win. */
export function selectDeckLayouts(
  requests: readonly LayoutRequest[],
  options: { aspect?: string } = {}
): LayoutChoice[] {
  const choices: LayoutChoice[] = [];
  const previous: string[] = [];
  for (const request of requests) {
    const override = request.layout?.trim();
    if (override && (override === 'free' || Object.hasOwn(DECK_LAYOUTS, override))) {
      choices.push({
        id: request.id,
        layout: override as LayoutChoice['layout'],
        rationale: `Author override: layout "${override}".`,
        override: true,
      });
      previous.push(override);
      continue;
    }
    const pacing = normalizePacing(request.pacing);
    const role = roleLayouts[request.role.trim().toLowerCase()] ?? [];
    const block = (request.blockTypes ?? []).flatMap((type) => blockLayouts[type] ?? []);
    const candidates = unique([...block, ...role, ...pacingLayouts[pacing], 'free']).filter(
      (id) =>
        id === 'free' ||
        DECK_LAYOUTS[id as DeckCatalogLayoutId].pacing.includes(pacing) ||
        role.includes(id) ||
        block.includes(id)
    );
    let chosen = candidates[0] ?? 'free';
    let avoidedRepeat = false;
    if (previous.length >= 2 && previous.at(-1) === previous.at(-2) && previous.at(-1) === chosen) {
      const alternate = candidates.find((candidate) => candidate !== chosen);
      if (alternate) {
        chosen = alternate;
        avoidedRepeat = true;
      }
    }
    const label =
      chosen === 'free' ? 'Free slide' : DECK_LAYOUTS[chosen as DeckCatalogLayoutId].label;
    choices.push({
      id: request.id,
      layout: chosen as LayoutChoice['layout'],
      rationale: `Role "${request.role}" with pacing "${pacing}"; fits catalog "${chosen}" (${label})${avoidedRepeat ? '; avoided a third identical layout in a row' : ''}${options.aspect && options.aspect !== '16:9' ? `; aspect ${options.aspect}` : ''}.`,
      override: false,
    });
    previous.push(chosen);
  }
  return choices;
}

function normalizePacing(value: string | undefined): LayoutPacing {
  return value === 'punch' || value === 'diagram' || value === 'story' ? value : 'idea';
}
function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
