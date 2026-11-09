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
  title: 'From a typed graph to a laid-out editor.',
  steps: [
    {
      title: 'Model',
      body: 'Declare closed node types, then add nodes and edges as operations. Every operation is checked against ports and cycle policy.',
      package: '@texuli/workflows',
    },
    {
      title: 'Lay out',
      body: 'A deterministic layered layout places the graph, left to right or top to bottom.',
      package: '@texuli/workflows',
    },
    {
      title: 'Edit',
      body: 'The editor adds a toolbar, a palette, a canvas and history. The canvas moves nodes with the drag engine.',
      package: '@texuli/workflows',
    },
    {
      title: 'Inspect',
      body: 'The inspector shows the selected node so you can edit its fields without the canvas.',
      package: '@texuli/workflows',
    },
    {
      title: 'View',
      body: 'The viewer is read-only, with an accessible outline of the same graph.',
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
