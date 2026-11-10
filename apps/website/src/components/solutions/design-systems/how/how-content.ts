/**
 * Copy for the Design systems "How it works" band (PLAN_017 story.md §4): one document,
 * every surface. Each step names the registry package that does it; the agent step names
 * none, because `@texuli/mcp` is not one of the entry's packages (it serves the same `ds.*`
 * operations `@texuli/tools` defines). The band art is the reserved
 * `solution-design-systems-how` slot (07).
 */
import type { SolutionHowProps } from '../../shared/types.ts';

export const DESIGN_SYSTEMS_HOW: Omit<SolutionHowProps, 'entry'> = {
  title: 'One document, every surface.',
  art: { slot: 'solution-design-systems-how', variant: 'band' },
  steps: [
    {
      title: 'Describe',
      body: 'The spec defines the design-system document, the allow manifest and the catalog extension format.',
      package: '@texuli/spec',
    },
    {
      title: 'Compile',
      body: 'The compiler turns the document into --tx-* variables for light and dark, with contrast, focus and target size enforced.',
      package: '@texuli/tokens',
    },
    {
      title: 'Paint',
      body: 'Texuli components read those variables; the provider scopes a brand to a page or one element.',
      package: 'texuli',
    },
    {
      title: 'Check',
      body: 'texuli ds generates, approves, packs and runs the locked checks on your prototypes.',
      package: '@texuli/tools',
    },
    {
      title: 'Hand to agents',
      body: 'The MCP server gives agents the same ds operations, locally or at texuli.com/mcp. Agents draft and validate; they never approve.',
    },
  ],
};
