/**
 * Copy for the Workflows "How it works" section. Five steps follow a graph from data
 * to a view: model → layout → edit → inspect → view. Each step names the registry
 * package that does it. `WORKFLOWS_HOW_TRACE` records, per step, the subpath export
 * and the registry capability it rests on, so the test checks every claim against
 * `entries/workflows.ts` and the package manifests.
 *
 * Facts come from the workflows README: closed node types, validated operations,
 * cycle policy, deterministic layered layout, the editor (toolbar, palette, canvas,
 * history), the inspector, the accessible outline and the read-only viewer. The
 * canvas moves nodes through `@texuli/drag`, which the architecture diagram lists
 * as a foundation package. Texuli does not run automations. No counts are stated.
 */
import type { SolutionHowProps } from '../../shared/types.ts';

export const WORKFLOWS_HOW: Omit<SolutionHowProps, 'entry'> = {
  title: 'From typed graph to editable view.',
  art: { slot: 'solution-workflows-how', variant: 'band' },
  steps: [
    {
      title: 'Model',
      body: 'Define node types, then apply validated operations to build the graph.',
      package: '@texuli/workflows',
    },
    {
      title: 'Lay out',
      body: 'Place nodes deterministically, left to right or top to bottom.',
      package: '@texuli/workflows',
    },
    {
      title: 'Edit',
      body: 'Use the canvas or keyboard outline; wire undo and redo through workflow history.',
      package: '@texuli/workflows',
    },
    {
      title: 'Inspect',
      body: 'Edit the selected node’s typed props in the inspector.',
      package: '@texuli/workflows',
    },
    {
      title: 'View',
      body: 'Show the same graph as a read-only figure that lists where each node leads.',
      package: '@texuli/workflows',
    },
  ],
};

/** Per step (same order): the subpath export it uses and the capability it demonstrates. */
export const WORKFLOWS_HOW_TRACE: readonly Readonly<{ subpath: string; capability: string }>[] = [
  { subpath: './model', capability: 'graph-model' },
  { subpath: './layout', capability: 'layout' },
  { subpath: './editor', capability: 'author' },
  { subpath: './inspector', capability: 'author' },
  { subpath: './viewer', capability: 'view' },
];
