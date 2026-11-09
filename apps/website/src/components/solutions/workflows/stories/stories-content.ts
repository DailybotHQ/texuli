/**
 * The Workflows signature stories and the evidence behind every claim. Copy comes from the
 * `@texuli/workflows` README and the Workflows audit; each story names capability ids from
 * `entries/workflows.ts`, and each claim cites a repository file that contains the named
 * marker. The test checks that every cited file exists and contains its marker.
 */
import type { SolutionStoriesProps } from '../../shared/types.ts';

export const WORKFLOWS_STORIES: Omit<SolutionStoriesProps, 'entry'> = {
  title: 'What a workflow graph can do',
  stories: [
    {
      id: 'graph-model',
      title: 'Stop invalid changes before they land.',
      body: 'Node types are declared up front. Each operation checks ports, directions, data types and the cycle policy. A refused operation changes nothing, so people and agents can correct a graph before it is stored.',
      capabilities: ['graph-model'],
    },
    {
      id: 'layout',
      title: 'Place the graph predictably.',
      body: 'Deterministic layered layout places nodes left to right or top to bottom, including right-to-left writing. Apply its moves as ordinary operations.',
      capabilities: ['layout'],
    },
    {
      id: 'author',
      title: 'Edit visually. Keep control of history.',
      body: 'Build with a toolbar, palette, canvas, minimap, inspector and keyboard outline. Changes come back to your app; wire undo and redo through the history helper.',
      capabilities: ['author'],
    },
  ],
};

export interface StoryClaim {
  readonly claim: string;
  readonly source: string;
  readonly marker: string;
}

export const WORKFLOWS_STORY_EVIDENCE: Readonly<Record<string, readonly StoryClaim[]>> = {
  'graph-model': [
    {
      claim: 'Every operation checks ports, directions, data types and cycle policy',
      source: 'packages/workflows/README.md',
      marker:
        'every operation checks ports, directions, data types, cardinality, duplicates, the cycle policy',
    },
    {
      claim: 'A refused operation changes nothing',
      source: 'packages/workflows/README.md',
      marker: 'a refused operation changes nothing',
    },
    {
      claim: 'Operations are tested',
      source: 'packages/workflows/tests/model.test.ts',
      marker: 'applyWorkflowOps',
    },
    {
      claim: 'Texuli does not run workflows',
      source: 'apps/website/src/data/solutions/entries/workflows.ts',
      marker: 'it does not run workflows',
    },
  ],
  layout: [
    {
      claim: 'Deterministic layered auto-layout',
      source: 'packages/workflows/README.md',
      marker: 'deterministic layered auto-layout, left-to-right or top-to-bottom',
    },
    {
      claim: 'Layout is tested',
      source: 'packages/workflows/tests/layout.test.ts',
      marker: 'layoutWorkflow',
    },
  ],
  author: [
    {
      claim: 'The editor reports each change; undo and redo use history',
      source: 'packages/workflows/README.md',
      marker: 'undo and redo run on `createWorkflowHistory`',
    },
    {
      claim: 'The inspector edits typed props',
      source: 'packages/workflows/README.md',
      marker: "edits the selected node's typed props",
    },
    {
      claim: 'The editor is tested',
      source: 'packages/workflows/tests/editor.test.ts',
      marker: 'WorkflowEditor',
    },
    {
      claim: 'The landing demo uses a fictional expense-approval graph',
      source: 'apps/website/src/components/solutions/workflows/demo/fixtures/expense-approval.ts',
      marker: 'expense-approval',
    },
  ],
};
