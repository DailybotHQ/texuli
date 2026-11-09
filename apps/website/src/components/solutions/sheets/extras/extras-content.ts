/**
 * Closing copy for the Sheets landing: recipes, agents, platforms and next steps.
 * Agent surfaces exist in this repository: the `spreadsheet` catalog id
 * (`packages/catalog/src/manifests/sheets/index.ts`), the catalog's `validateDraft` with
 * its `checkSheet` hook (`packages/catalog/src/validate/draft.ts`), and the blueprints
 * skill stage J. The remote MCP refuses spreadsheet nodes (it has no sheet validator), so
 * the copy says agents check them in the host app. Recipe links are only pages or package
 * pages that exist. Next steps lead with the Sheets docs (`entry.docs`).
 */
import type {
  SolutionAgentsProps,
  SolutionNextStepsProps,
  SolutionPlatformsProps,
  SolutionRecipesProps,
} from '../../shared/types.ts';

export const SHEETS_RECIPES: Omit<SolutionRecipesProps, 'entry'> = {
  title: 'Recipes',
  recipes: [
    {
      title: 'Drop a grid into your app',
      summary:
        'Load a workbook, evaluate formulas, and show the grid, step by step in the Sheets docs.',
      href: '/guides/solutions/sheets/',
    },
    {
      title: 'Install the package',
      summary: 'Add @texuli/sheets from npm (pre-1.0, in development).',
      href: 'https://www.npmjs.com/package/@texuli/sheets',
    },
  ],
};

export const SHEETS_AGENTS: Omit<SolutionAgentsProps, 'entry'> = {
  title: 'For agents',
  body: 'Agents emit a spreadsheet as data through the spreadsheet catalog id. The host app checks it with validateDraft and the sheet check before painting; the remote MCP server refuses spreadsheet nodes. The packages are in development.',
  surfaces: [
    {
      label: 'spreadsheet',
      detail: 'Catalog component that carries a whole sheet in its sheet prop.',
      status: 'in development',
    },
    {
      label: 'validateDraft',
      detail:
        'Catalog check; spreadsheet nodes pass only with the checkSheet hook from the sheets model.',
      status: 'in development',
    },
    {
      label: 'skills/texuli/blueprints/SKILL.md',
      detail: 'Skill stage J: forms, canvases, sheets and data sources as agent data.',
      status: 'in development',
    },
  ],
};

export const SHEETS_PLATFORMS: Omit<SolutionPlatformsProps, 'entry'> = {
  title: 'Platforms',
};

export const SHEETS_NEXT: Omit<SolutionNextStepsProps, 'entry'> = {
  links: [
    { label: 'Read the Sheets docs', href: '/guides/solutions/sheets/' },
    { label: 'Install @texuli/sheets', href: 'https://www.npmjs.com/package/@texuli/sheets' },
  ],
};
