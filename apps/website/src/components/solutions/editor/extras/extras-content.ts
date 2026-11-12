import type {
  SolutionAgentsProps,
  SolutionNextStepsProps,
  SolutionPlatformsProps,
  SolutionRecipesProps,
} from '../../shared/types.ts';

export const EDITOR_RECIPES: Omit<SolutionRecipesProps, 'entry'> = {
  title: 'Keep building',
  recipes: [
    {
      title: 'Build with the editor',
      summary: 'Markdown in and out, safe paste, the block menu, emoji and the export to chat.',
      href: '/guides/solutions/editor/',
    },
    {
      title: 'See the editor examples',
      summary: 'The package examples: toolbar and links, long documents, paste and export.',
      href: '/examples/editor-toolbar/',
    },
    {
      title: 'Editor capability page',
      summary: 'The reference page for every editor capability, as before.',
      href: '/editor-page/',
    },
  ],
};

export const EDITOR_AGENTS: Omit<SolutionAgentsProps, 'entry'> = {
  title: 'For agents',
  body: 'An agent writes Markdown; the editor reads it at the untrusted tier, so raw HTML stays text and refused links keep only their text. The same text converts to a chat dialect, or renders to safe HTML, through the md.convert and md.render MCP operations. This demo uses fixture documents and sends nothing.',
  surfaces: [
    {
      label: '@texuli/editor',
      detail: 'Editor surface, toolbar, controller, Markdown codec and paste; published on npm.',
      status: 'in development',
    },
    {
      label:
        'HTML paste through @texuli/core/html, Paste as Markdown, block menu, emoji and chat export',
      detail: 'Added after 0.17.4; in this branch, not in a published release yet.',
      status: 'planned',
    },
  ],
};

export const EDITOR_PLATFORMS: Omit<SolutionPlatformsProps, 'entry'> = {
  title: 'Platforms',
};

export const EDITOR_NEXT: Omit<SolutionNextStepsProps, 'entry'> = {
  links: [
    { label: 'Build with the editor', href: '/guides/solutions/editor/' },
    { label: 'Editor capability page', href: '/editor-page/' },
    { label: '@texuli/editor on npm', href: 'https://www.npmjs.com/package/@texuli/editor' },
  ],
};
