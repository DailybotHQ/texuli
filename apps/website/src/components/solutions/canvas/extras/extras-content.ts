/**
 * Closing copy for the Canvas landing: recipes, agents, platforms and next steps.
 * Agent surfaces exist in this repository: the `canvas` catalog id
 * (`packages/catalog/src/manifests/canvas/index.ts`), the catalog's `validateDraft` with
 * its `checkCanvas` hook (`packages/catalog/src/validate/draft.ts`), and the blueprints
 * skill stage J. The remote MCP refuses canvas nodes (it has no canvas validator), so the
 * copy says agents check them in the host app. Recipe links are only pages or package
 * pages that exist. Next steps lead with the Canvas docs (`entry.docs`).
 */
import type {
  SolutionAgentsProps,
  SolutionNextStepsProps,
  SolutionPlatformsProps,
  SolutionRecipesProps,
} from '../../shared/types.ts';

export const CANVAS_RECIPES: Omit<SolutionRecipesProps, 'entry'> = {
  title: 'Recipes',
  recipes: [
    {
      title: 'Embed the canvas editor',
      summary:
        'Mount the editor on a canvas document, then export it, step by step in the Canvas docs.',
      href: '/guides/solutions/canvas/',
    },
    {
      title: 'Install the package',
      summary: 'Add @texuli/canvas from npm (pre-1.0, in development).',
      href: 'https://www.npmjs.com/package/@texuli/canvas',
    },
  ],
};

export const CANVAS_AGENTS: Omit<SolutionAgentsProps, 'entry'> = {
  title: 'For agents',
  body: 'Agents emit a canvas as data through the canvas catalog id. The host app checks it with validateDraft and the canvas check before painting; the remote MCP server refuses canvas nodes. The packages are in development.',
  surfaces: [
    {
      label: 'canvas',
      detail: 'Catalog component that carries a whole canvas in its canvas prop.',
      status: 'in development',
    },
    {
      label: 'validateDraft',
      detail:
        'Catalog check; canvas nodes pass only with the checkCanvas hook from the canvas host.',
      status: 'in development',
    },
    {
      label: 'skills/texuli/blueprints/SKILL.md',
      detail: 'Skill stage J: forms, canvases, sheets and data sources as agent data.',
      status: 'in development',
    },
  ],
};

export const CANVAS_PLATFORMS: Omit<SolutionPlatformsProps, 'entry'> = {
  title: 'Platforms',
};

export const CANVAS_NEXT: Omit<SolutionNextStepsProps, 'entry'> = {
  links: [
    { label: 'Build with the Canvas API', href: '/guides/solutions/canvas/' },
    { label: '@texuli/canvas on npm', href: 'https://www.npmjs.com/package/@texuli/canvas' },
  ],
};
