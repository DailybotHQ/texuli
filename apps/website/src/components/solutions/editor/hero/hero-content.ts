import { SOLUTION_SECTION_IDS } from '../../shared/subnav/sections.ts';
import type { SolutionHeroProps } from '../../shared/types.ts';

export const EDITOR_HERO: Omit<SolutionHeroProps, 'entry'> = {
  eyebrow: 'Solution · Rich text editor',
  title: 'Rich text that reads and writes Markdown, and travels to any chat.',
  lede: 'An owned editor with a closed vocabulary: load and save Markdown, paste HTML from any page without its scripts or unsafe links, set block types from a menu, add emoji, and export the result for Slack, Discord, Teams and five more formats with every loss listed. The demo runs on fixture documents; nothing is saved or sent.',
  ctas: [
    { kind: 'primary', label: 'Try the editor demo', href: `#${SOLUTION_SECTION_IDS.demo}` },
    {
      kind: 'secondary',
      label: 'Start with the editor',
      href: `#${SOLUTION_SECTION_IDS.quickstart}`,
    },
  ],
};
