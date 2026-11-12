import { SOLUTION_SECTION_IDS } from '../../shared/subnav/sections.ts';
import type { SolutionHeroProps } from '../../shared/types.ts';

export const AGENT_CHAT_HERO: Omit<SolutionHeroProps, 'entry'> = {
  eyebrow: 'Solution · Agent chat',
  title: 'A chat where agent replies become working interfaces.',
  lede: 'Stream replies people can stop, render their Markdown safely, autocomplete mentions and commands, and attach blueprints that are validated before the player paints them. The demo uses fixture replies, no live model.',
  ctas: [
    { kind: 'primary', label: 'Try the agent chat demo', href: `#${SOLUTION_SECTION_IDS.demo}` },
    {
      kind: 'secondary',
      label: 'Start with the thread',
      href: `#${SOLUTION_SECTION_IDS.quickstart}`,
    },
  ],
};
