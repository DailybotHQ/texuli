/**
 * Closing copy for the Design systems landing (PLAN_017 story.md §5–§7): recipes (the kit,
 * the Studio, the reference hub, the locked-check docs), agent surfaces (MCP `ds.*`
 * operations that exist in `packages/tools/src/ops`), platforms, the Protoyard band, the
 * FAQ and next steps. Protoyard: no numbers without a public source (lead decision,
 * 2026-11-10); the band links Protoyard's own site and its Built with page. Every answer
 * describes behavior on npm since Texuli 0.16.1 and unchanged in 0.17.0; the CLI cannot prove who approved.
 */
import { PROTOYARD_SITE } from '../../../built-with/protoyard/protoyard-content.ts';
import type {
  SolutionAgentsProps,
  SolutionNextStepsProps,
  SolutionPlatformsProps,
  SolutionRecipesProps,
} from '../../shared/types.ts';

export const DESIGN_SYSTEMS_GUIDE_SOURCE =
  'https://github.com/DailybotHQ/texuli/blob/main/docs/DESIGN_SYSTEMS.md';
export const DESIGN_SYSTEMS_CHECK_DOCS =
  'https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/ds-check.md';

export const DESIGN_SYSTEMS_RECIPES: Omit<SolutionRecipesProps, 'entry'> = {
  title: 'Recipes',
  recipes: [
    {
      title: 'Review a brand in the kit',
      summary:
        'Every allowed component of a fictional brand, Ledgerline, in each variant, size and state, in light and dark.',
      href: '/design-systems/kit/',
    },
    {
      title: 'Edit a draft in the Studio',
      summary:
        'Tune colors, type and the allowed set in the browser, then export a draft to review.',
      href: '/theme-studio/',
    },
    {
      title: 'Browse the reference',
      summary: 'Example brands, the conformance sheet and every texuli ds command.',
      href: '/design-systems/',
    },
    {
      title: 'Wire the locked check into CI',
      summary: 'Flags, findings and exit codes of texuli ds validate --locked and texuli ds check.',
      href: DESIGN_SYSTEMS_CHECK_DOCS,
    },
  ],
};

export const DESIGN_SYSTEMS_AGENTS: Omit<SolutionAgentsProps, 'entry'> = {
  title: 'For agents',
  body: 'Agents call the same operations through the MCP server, locally with npx -y @texuli/mcp or at texuli.com/mcp. They generate and validate drafts. Approval stays with a person.',
  surfaces: [
    {
      label: 'ds.generate',
      detail: 'Draft a design system from a brief, tokens, CSS or logo colors, with its report.',
      status: 'available',
    },
    {
      label: 'ds.validate',
      detail: 'Validate a document, or a prototype against its locked allowed set.',
      status: 'available',
    },
    {
      label: 'ds.allow',
      detail: 'Read or narrow the allowed components, variants, sizes, tones and states.',
      status: 'available',
    },
    {
      label: 'ds.save',
      detail: 'Save a draft; it refuses an approved document (approval-human-only).',
      status: 'available',
    },
    {
      label: 'ds.bundle',
      detail: 'Pack a document with its library sources and release history.',
      status: 'available',
    },
  ],
};

export const DESIGN_SYSTEMS_PLATFORMS: Omit<SolutionPlatformsProps, 'entry'> = {
  title: 'Platforms',
};

export const DESIGN_SYSTEMS_PROTOYARD = {
  id: 'built-with',
  title: 'Built on it: Protoyard.',
  body: 'Protoyard, open-source local prototyping, builds locked prototypes on Texuli. See how it uses Texuli, or visit Protoyard’s own site.',
  art: 'solution-design-systems-protoyard',
  links: [
    { label: 'Visit protoyard.app', href: PROTOYARD_SITE },
    { label: 'How Protoyard uses Texuli', href: '/built-with/protoyard/' },
  ],
} as const;

export interface DesignSystemsFaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export const DESIGN_SYSTEMS_FAQ = {
  id: 'faq',
  title: 'Questions',
  items: [
    {
      id: 'css',
      question: 'Do I need to write CSS?',
      answer:
        'No. The document is data only. The compiler emits the --tx-* variables and the CSS for light and dark.',
    },
    {
      id: 'agent-approve',
      question: 'Can an agent approve a design system?',
      answer:
        'No. Agents generate and validate drafts, and ds.save refuses an approved document. Approval is texuli ds approve plus a reviewed commit.',
    },
    {
      id: 'who-approved',
      question: 'Does “approved” prove who approved?',
      answer:
        'No. approvedBy is what the reviewer typed. The proof is your review process: the commit and CODEOWNERS.',
    },
    {
      id: 'what-is-read',
      question: 'What does the locked check read?',
      answer:
        'Your sources, blueprints and CSS, as text, bounded and never executed. --render checks the bundled conformance sheet, or a page you serve and pass with --url; Texuli never starts your app.',
    },
    {
      id: 'own-components',
      question: 'We have our own components. Do they fail the check?',
      answer:
        'Not if you publish them as catalog extensions (<namespace>:<id>) and pass --extensions. The allowed set is then checked against Texuli’s catalog plus yours.',
    },
    {
      id: 'tokens',
      question: 'Can I start from tokens we already have?',
      answer:
        'Yes. texuli ds generate reads a DTCG token file, your CSS and a brief, and its report lists what was dropped or repaired. texuli ds import converts a single DTCG or Tokens Studio file.',
    },
    {
      id: 'stable',
      question: 'Is it stable?',
      answer:
        'It is pre-1.0. Under 0.x a new minor may break, so pin an exact version. On native, Compose Desktop support is in development and Android and iOS are planned.',
    },
  ] satisfies readonly DesignSystemsFaqItem[],
};

export const DESIGN_SYSTEMS_NEXT: Omit<SolutionNextStepsProps, 'entry'> = {
  links: [
    { label: 'Read the guide', href: '/guides/solutions/design-systems/' },
    { label: 'See the kit', href: '/design-systems/kit/' },
    { label: 'Open the Studio', href: '/theme-studio/' },
    { label: 'Design systems reference', href: '/design-systems/' },
    { label: 'Full guide on GitHub', href: DESIGN_SYSTEMS_GUIDE_SOURCE },
  ],
};
