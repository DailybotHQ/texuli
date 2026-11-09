/**
 * Prop contracts for the shared Solution landing blocks (ADR-027, ADR-030). Every Solution
 * lane builds its sections against these types; `SolutionLayout` composes them in order:
 * hero → demo → stories → how → quickstart → recipes → agents → platforms → next steps.
 *
 * Facts (name, status, packages, platforms, docs route) come from the registry entry, so
 * blocks receive the entry rather than copies of its fields.
 */
import type {
  SolutionArtSlot,
  SolutionEntry,
  SolutionLink,
  SolutionStatus,
} from '../../../data/solutions/schema.ts';

export interface SolutionCta extends SolutionLink {
  readonly kind: 'primary' | 'secondary';
}

export interface SolutionHeroProps {
  readonly entry: SolutionEntry;
  /** Short label above the title, for example "Solution · Slides". */
  readonly eyebrow: string;
  readonly title: string;
  readonly lede: string;
  /** One or two calls to action; the first is primary. */
  readonly ctas: readonly SolutionCta[];
  /** Defaults to `entry.art.hero`. */
  readonly art?: SolutionArtSlot;
}

export interface SolutionDemoFrameProps {
  readonly entry: SolutionEntry;
  /** Visible heading of the demo section. */
  readonly title: string;
  /** What the visitor can try, one short line per action. */
  readonly tryThis: readonly string[];
  /** Accessible name of the demo region. */
  readonly label: string;
}

export interface SolutionStory {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** Capability ids from the entry this story demonstrates. */
  readonly capabilities: readonly string[];
  /** Defaults to the reserved `solution-<slug>-story-<n>` slot; unregistered paints the mosaic. */
  readonly art?: SolutionArtSlot;
  readonly status?: SolutionStatus;
}

export interface SolutionStoriesProps {
  readonly entry: SolutionEntry;
  readonly title: string;
  readonly stories: readonly SolutionStory[];
}

export interface SolutionHowStep {
  readonly title: string;
  readonly body: string;
  /** Package name from `entry.packages` that does this step. */
  readonly package?: string;
}

export interface SolutionHowProps {
  readonly entry: SolutionEntry;
  readonly title: string;
  readonly steps: readonly SolutionHowStep[];
  /**
   * Full-width band under the steps. Defaults to the reserved `solution-<slug>-how` slot;
   * nothing renders until `illustrations.json` registers it (see `art/art-slots.ts`).
   */
  readonly art?: SolutionArtSlot;
}

export interface SolutionCodeSample {
  readonly label: string;
  readonly language: 'bash' | 'ts' | 'svelte' | 'json' | 'md';
  /** Plain text rendered as code; never HTML. Must compile or run as documented. */
  readonly code: string;
}

export interface SolutionQuickstartProps {
  readonly entry: SolutionEntry;
  readonly title: string;
  readonly install: SolutionCodeSample;
  readonly samples: readonly SolutionCodeSample[];
  /** The test or command that verifies the samples, cited in the docs. */
  readonly verifiedBy: string;
}

export interface SolutionRecipe {
  readonly title: string;
  readonly summary: string;
  readonly href: string;
}

export interface SolutionRecipesProps {
  readonly entry: SolutionEntry;
  readonly title: string;
  readonly recipes: readonly SolutionRecipe[];
}

export interface SolutionAgentsProps {
  readonly entry: SolutionEntry;
  readonly title: string;
  readonly body: string;
  /** MCP tool names, catalog component ids or skill paths this Solution exposes. */
  readonly surfaces: readonly Readonly<{ label: string; detail: string; status: SolutionStatus }>[];
}

export interface SolutionPlatformsProps {
  readonly entry: SolutionEntry;
  readonly title: string;
}

export interface SolutionNextStepsProps {
  readonly entry: SolutionEntry;
  readonly links: readonly SolutionLink[];
}

/** Everything a landing page passes to `SolutionLayout`. */
export interface SolutionLandingContent {
  readonly hero: Omit<SolutionHeroProps, 'entry'>;
  readonly demo: Omit<SolutionDemoFrameProps, 'entry'>;
  readonly stories: Omit<SolutionStoriesProps, 'entry'>;
  readonly how: Omit<SolutionHowProps, 'entry'>;
  readonly quickstart: Omit<SolutionQuickstartProps, 'entry'>;
  readonly recipes?: Omit<SolutionRecipesProps, 'entry'>;
  readonly agents: Omit<SolutionAgentsProps, 'entry'>;
  readonly platforms: Omit<SolutionPlatformsProps, 'entry'>;
  readonly next: Omit<SolutionNextStepsProps, 'entry'>;
}

/** Checks a landing's content against its entry; an empty array means it is consistent. */
export function checkLandingContent(
  entry: SolutionEntry,
  content: SolutionLandingContent
): string[] {
  const issues: string[] = [];
  const caps = new Set(entry.capabilities.map((c) => c.id));
  const pkgs = new Set(entry.packages.map((p) => p.name));
  const ctas = content.hero.ctas;
  if (ctas.length < 1 || ctas.length > 2) issues.push('hero needs one or two calls to action');
  if (ctas[0] && ctas[0].kind !== 'primary')
    issues.push('the first hero call to action must be primary');
  if (content.demo.tryThis.length === 0) issues.push('demo needs at least one "try this" line');
  for (const story of content.stories.stories) {
    for (const id of story.capabilities) {
      if (!caps.has(id)) issues.push(`story "${story.id}" names unknown capability "${id}"`);
    }
  }
  for (const step of content.how.steps) {
    if (step.package && !pkgs.has(step.package))
      issues.push(`how step "${step.title}" names a package outside the entry`);
  }
  if (!isText(content.quickstart.verifiedBy)) issues.push('quickstart must name what verifies it');
  if (!content.next.links.some((l) => l.href === entry.docs))
    issues.push('next steps must link the docs route');
  return issues;
}

function isText(value: string): boolean {
  return value.trim().length > 0;
}
