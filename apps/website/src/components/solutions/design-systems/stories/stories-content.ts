/**
 * The Design systems loop in five steps (PLAN_017 story.md §2): create, review, approve,
 * lock, share. Each story is one band with its reserved art slot
 * (`solution-design-systems-story-<n>`, slots 02–06) and names capability ids from
 * `entries/design-systems.ts`. `DESIGN_SYSTEMS_STORY_EVIDENCE` cites, per claim, a
 * repository file and a marker it contains; the site spec and the docs check keep them
 * honest. Only Texuli 0.16.1 features appear here; the CLI cannot prove who approved.
 */
import type { SolutionStoriesProps } from '../../shared/types.ts';

export const DESIGN_SYSTEMS_STORIES: Omit<SolutionStoriesProps, 'entry'> = {
  title: 'From brand inputs to locked prototypes.',
  stories: [
    {
      id: 'create',
      title: 'Create: start from a brief, tokens, CSS or a logo.',
      body: 'texuli ds generate merges a short brief, a token file, your site CSS, sampled logo colors or a library theme into one design-system draft. Its report lists every value an importer dropped or a later source overwrote, and every color the contrast solver moved, with the reason. A repair is a brand color that changed: read it before you go on. Agents call ds.generate, which returns a draft and never saves or approves.',
      capabilities: ['import-and-generate', 'brand-document'],
    },
    {
      id: 'review',
      title: 'Review: see every component it allows, in light and dark.',
      body: 'The texuli/ds-kit page renders the design system in one place: foundations, voice, every allowed component in each allowed variant, size and state, the brand’s own components and the approval record with its hash check. Disallowed values are marked, never rendered. The compiler holds every text pair to AA instead of only reporting it.',
      capabilities: ['compile-and-apply'],
    },
    {
      id: 'approve',
      title: 'Approve: a person, a commit, CODEOWNERS.',
      body: 'A reviewer runs texuli ds approve --by <name>. It validates first, then stamps the approval and a content hash. The CLI cannot prove who approved: the guarantee is the reviewed commit, with your design-systems folder owned by your design reviewer in CODEOWNERS. Agents never approve, and texuli ds hash exits 1 when an approved file changed.',
      capabilities: ['brand-document'],
    },
    {
      id: 'lock',
      title: 'Lock: prototypes use what the brand allows.',
      body: 'The allow section names the catalog components, variants, sizes, tones, densities, category colors and states the brand permits. Every catalog component root carries data-tx-component and its axes, so a check maps a painted page back to the catalog. texuli ds validate --locked --prototype reads your sources and blueprints without running them; --render adds the render check and --report lists findings without failing while you migrate. Your own components join as namespaced catalog extensions with --extensions.',
      capabilities: ['locked-allow'],
    },
    {
      id: 'share',
      title: 'Share: hand it over as one versioned bundle.',
      body: 'texuli ds pack packs the document with its library sources and release history. Consumers pin an exact version and move it on purpose; texuli ds diff shows what changed, and a narrower allowed set is a breaking change. The bundle, the allow manifest and the check report each have a published contract type, so other tools can read them.',
      capabilities: ['brand-document'],
    },
  ],
};

export interface StoryClaim {
  readonly claim: string;
  readonly source: string;
  readonly marker: string;
}

export const DESIGN_SYSTEMS_STORY_EVIDENCE: Readonly<Record<string, readonly StoryClaim[]>> = {
  create: [
    {
      claim: 'ds generate takes a brief, tokens, CSS, a logo or a theme',
      source: 'packages/tools/src/cli/ds.ts',
      marker: 'texuli ds generate [--brief <text>] [--from-tokens <file>] [--from-css <file>]',
    },
    {
      claim: 'The generate command is tested',
      source: 'packages/tools/tests/ds-generate-cli.test.ts',
      marker: 'from-tokens',
    },
  ],
  review: [
    {
      claim: 'The kit page renders the design system',
      source: 'apps/website/src/pages/design-systems/kit/index.astro',
      marker: 'DesignSystemKit',
    },
  ],
  approve: [
    {
      claim: 'ds approve needs --by and cannot prove who approved',
      source: 'packages/tools/src/cli/ds.ts',
      marker: 'The check cannot prove who approved a document.',
    },
    {
      claim: 'Approval is tested',
      source: 'packages/tools/tests/ds-create-cli.test.ts',
      marker: "'approve'",
    },
  ],
  lock: [
    {
      claim: 'Locked validation of prototypes, render checks, reports and extensions',
      source: 'packages/tools/src/cli/ds.ts',
      marker: '[--locked] [--prototype <dir> [--scan-workspace]]',
    },
    {
      claim: 'Extensions on the CLI are tested',
      source: 'packages/tools/tests/ds-extensions-cli.test.ts',
      marker: '--extensions',
    },
  ],
  share: [
    {
      claim: 'ds pack writes a bundle',
      source: 'packages/tools/src/cli/ds.ts',
      marker: 'texuli ds pack <file> --out <bundle.json>',
    },
    {
      claim: 'Bundles are tested',
      source: 'packages/tools/tests/ds-bundle-cli.test.ts',
      marker: "'pack'",
    },
  ],
};
