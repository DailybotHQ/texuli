/**
 * Copy for the Workflows landing hero. Facts come from the registry entry, the Workflows
 * audit and `packages/workflows/README.md`: typed nodes, ports and edges with validation
 * and cycles, a deterministic layered auto-layout, and an editor with a canvas and a
 * treegrid outline that edits the graph without the canvas. Texuli draws and edits the
 * graph; it is not a workflow runtime, so the lede says the app runs it. The status line
 * is printed by `SolutionHero` from `entry.status`. Calls to action point only at the
 * landing's own demo and quickstart sections.
 */

import { SOLUTION_SECTION_IDS } from '../../shared/subnav/sections.ts';
import type { SolutionHeroProps } from '../../shared/types.ts';

export const WORKFLOWS_HERO: Omit<SolutionHeroProps, 'entry'> = {
  eyebrow: 'Solution · Workflows',
  title: 'Workflow graphs you can draw, check and embed.',
  lede: 'Model approvals as typed nodes and edges, validate edits, and shape the graph with automatic layout, a canvas or a keyboard outline. Your app runs them.',
  ctas: [
    { kind: 'primary', label: 'Edit the approval flow', href: `#${SOLUTION_SECTION_IDS.demo}` },
    { kind: 'secondary', label: 'Start building', href: `#${SOLUTION_SECTION_IDS.quickstart}` },
  ],
};
