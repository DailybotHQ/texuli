/**
 * Closing copy for the Documents landing: recipes, agents, platforms and next steps.
 * Agent surfaces are MCP operations, catalog ids and skill files that exist in this
 * repository: `document.run` (served by the remote and local MCP), `document.export`
 * (needs Node, so the local MCP only), the `document` catalog component and the
 * blueprints skill reference for documents. Recipe links are only routes or package
 * pages that exist today; `/documents-page/` is never linked (it redirects to this landing
 * once the landing ships, ADR-028). Facts: `packages/document/README.md`, the ops in
 * `packages/tools/src/ops/document.ts` and the registry entry.
 */
import type {
  SolutionAgentsProps,
  SolutionNextStepsProps,
  SolutionPlatformsProps,
  SolutionRecipesProps,
} from '../../shared/types.ts';

export const DOCUMENTS_RECIPES: Omit<SolutionRecipesProps, 'entry'> = {
  title: 'Recipes',
  recipes: [
    {
      title: 'Edit and read a document',
      summary:
        'Mount the editor and the reader on one document, step by step in the Documents docs.',
      href: '/guides/solutions/documents/',
    },
    {
      title: 'Model, Markdown, DOCX and PDF without a UI',
      summary:
        'Use @texuli/document on its own: operations with undo, Markdown in and out, and the owned DOCX and PDF writers.',
      href: 'https://www.npmjs.com/package/@texuli/document',
    },
    {
      title: 'Install the editor and reader',
      summary: 'Add @texuli/pages from npm (pre-1.0, in development).',
      href: 'https://www.npmjs.com/package/@texuli/pages',
    },
  ],
};

export const DOCUMENTS_AGENTS: Omit<SolutionAgentsProps, 'entry'> = {
  title: 'For agents',
  body: 'Agents write a document as data, edit it with bounded patches, and convert it to and from Markdown. The packages are in development.',
  surfaces: [
    {
      label: 'document.run',
      detail:
        'MCP operation: validate, inspect, patch and convert a document, from Markdown and to Markdown.',
      status: 'in development',
    },
    {
      label: 'document.export',
      detail: 'MCP operation on the local server: write a document as PDF or DOCX bytes.',
      status: 'in development',
    },
    {
      label: 'document',
      detail: 'Catalog component that carries a whole document inside a blueprint.',
      status: 'in development',
    },
    {
      label: 'skills/texuli/blueprints/references/documents.md',
      detail: 'Skill reference for documents as data and their patches.',
      status: 'in development',
    },
  ],
};

export const DOCUMENTS_PLATFORMS: Omit<SolutionPlatformsProps, 'entry'> = {
  title: 'Platforms',
};

export const DOCUMENTS_NEXT: Omit<SolutionNextStepsProps, 'entry'> = {
  links: [
    { label: 'Read the docs', href: '/guides/solutions/documents/' },
    { label: '@texuli/pages on npm', href: 'https://www.npmjs.com/package/@texuli/pages' },
  ],
};
