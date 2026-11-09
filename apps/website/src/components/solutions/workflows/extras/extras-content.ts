/**
 * Closing copy for the Workflows landing: recipes, agents, platforms and next steps.
 * Agent surfaces exist in this repository: the `workflow-graph` catalog id
 * (`packages/catalog/src/manifests/workflows/index.ts`), `catalog.validate` and
 * `blueprint.validate` (`packages/tools/src/ops`), and the build-ui skill recipe.
 * There is no MCP operation that runs a workflow. Recipe links are only pages or
 * package pages that exist; `/workflows-page/` is never linked (it redirects to this
 * landing once the landing ships). `/workflows-page/json/` is a distinct tool URL and
 * may be linked. Next steps lead with the Workflows docs (`entry.docs`).
 */
import type {
  SolutionAgentsProps,
  SolutionNextStepsProps,
  SolutionPlatformsProps,
  SolutionRecipesProps,
} from '../../shared/types.ts';

export const WORKFLOWS_RECIPES: Omit<SolutionRecipesProps, 'entry'> = {
  title: 'Recipes',
  recipes: [
    {
      title: 'Edit a workflow graph',
      summary:
        'Declare node types, apply operations, lay the graph out and mount the editor, step by step in the Workflows docs.',
      href: '/guides/solutions/workflows/',
    },
    {
      title: 'Preview a JSON blueprint',
      summary: 'Paste a workflow-graph JSON document and read the validator diagnostics.',
      href: '/workflows-page/json/',
    },
    {
      title: 'Install the package',
      summary: 'Add @texuli/workflows from npm (pre-1.0, in development).',
      href: 'https://www.npmjs.com/package/@texuli/workflows',
    },
  ],
};

export const WORKFLOWS_AGENTS: Omit<SolutionAgentsProps, 'entry'> = {
  title: 'For agents',
  body: 'Agents emit a workflow-graph catalog node. Check it with catalog.validate or blueprint.validate. There is no MCP operation that runs a workflow. The packages are in development.',
  surfaces: [
    {
      label: 'workflow-graph',
      detail: 'Catalog component for a typed graph, view or edit, painted by @texuli/workflows.',
      status: 'in development',
    },
    {
      label: 'catalog.validate',
      detail: 'MCP operation: validate a catalog tree, including a workflow-graph node.',
      status: 'in development',
    },
    {
      label: 'blueprint.validate',
      detail: 'MCP operation: the same check on a blueprint envelope.',
      status: 'in development',
    },
    {
      label: 'skills/texuli/build-ui/references/recipes.md',
      detail: 'Skill recipe for the workflow editor, viewer, inspector, model and layout.',
      status: 'in development',
    },
  ],
};

export const WORKFLOWS_PLATFORMS: Omit<SolutionPlatformsProps, 'entry'> = {
  title: 'Platforms',
};

export const WORKFLOWS_NEXT: Omit<SolutionNextStepsProps, 'entry'> = {
  links: [
    { label: 'Build your first workflow graph', href: '/guides/solutions/workflows/' },
    { label: '@texuli/workflows on npm', href: 'https://www.npmjs.com/package/@texuli/workflows' },
  ],
};
