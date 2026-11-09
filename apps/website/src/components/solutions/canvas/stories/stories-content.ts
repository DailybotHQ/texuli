/**
 * The Canvas signature stories and the evidence behind every claim. Copy comes from the
 * `@texuli/canvas` README and the Canvas audit; each story names capability ids from
 * `entries/canvas.ts`, and each claim cites a repository file that contains the named
 * marker. The test checks that every cited file exists and contains its marker.
 */
import type { SolutionStoriesProps } from '../../shared/types.ts';

export const CANVAS_STORIES: Omit<SolutionStoriesProps, 'entry'> = {
  title: 'What a canvas can do',
  stories: [
    {
      id: 'draw',
      title: 'Draw, group and connect',
      body: 'Place shapes, text, sticky notes, images, frames and groups. Connectors route straight, elbow or curved. Transforms snap, and every change is a typed operation with an inverse on one op log.',
      capabilities: ['draw'],
    },
    {
      id: 'keyboard',
      title: 'Move with the keyboard',
      body: 'The surface is one application region. Shapes take a roving tab stop in reading order, and a shape tree lists every shape and connector for screen readers. Changes are announced.',
      capabilities: ['keyboard'],
    },
    {
      id: 'sync',
      title: 'Keep replicas in step',
      body: 'Collaboration sits on the document sync core. Batches are validated, and the projection drops what fails the canvas schema the same way on every replica. The host supplies the transport.',
      capabilities: ['sync'],
    },
    {
      id: 'export',
      title: 'Take SVG or PNG',
      body: 'Export escaped SVG through the markup builders, or a PNG in the browser. Text paints as SVG text. There is no HTML sink.',
      capabilities: ['export'],
    },
  ],
};

export interface StoryClaim {
  readonly claim: string;
  readonly source: string;
  readonly marker: string;
}

export const CANVAS_STORY_EVIDENCE: Readonly<Record<string, readonly StoryClaim[]>> = {
  draw: [
    {
      claim: 'Shapes, stickies, frames, groups and connectors',
      source: 'packages/canvas/README.md',
      marker:
        'Shapes, text, sticky notes, images, frames and groups, connectors that route straight, elbow or curved',
    },
    {
      claim: 'Typed operations with inverses and an op log',
      source: 'packages/canvas/README.md',
      marker: 'typed operations with inverses, the op-log history',
    },
    {
      claim: 'The model is tested',
      source: 'packages/canvas/tests/model.test.ts',
      marker: 'applyCanvasOps',
    },
    {
      claim: 'The landing demo uses a fictional launch plan',
      source: 'apps/website/src/components/solutions/canvas/demo/fixtures/launch-plan.ts',
      marker: 'Launch plan',
    },
  ],
  keyboard: [
    {
      claim: 'Roving tab stop in reading order',
      source: 'packages/canvas/README.md',
      marker: 'Shapes take a roving tab stop in reading order',
    },
    {
      claim: 'A shape tree for screen readers',
      source: 'packages/canvas/README.md',
      marker: 'the shape tree beside it (`role="tree"`) lists every shape and connector',
    },
    {
      claim: 'The editor is tested',
      source: 'packages/canvas/tests/editor.test.ts',
      marker: 'CanvasEditor',
    },
  ],
  sync: [
    {
      claim: 'CRDT collaboration on document sync',
      source: 'packages/canvas/README.md',
      marker: 'CRDT collaboration on `@texuli/document/sync`',
    },
    {
      claim: 'Invalid projection is dropped the same way on every replica',
      source: 'packages/canvas/README.md',
      marker: 'the projection drops what fails the canvas schema, the same way on every replica',
    },
    {
      claim: 'Sync is tested',
      source: 'packages/canvas/tests/sync.test.ts',
      marker: 'createCanvasSync',
    },
    {
      claim: 'Collaboration is not a hosted service',
      source: 'apps/website/src/data/solutions/entries/canvas.ts',
      marker: 'not a hosted realtime service',
    },
  ],
  export: [
    {
      claim: 'SVG through escaped markup',
      source: 'packages/canvas/README.md',
      marker: 'escaped markup through `@texuli/core/markup`',
    },
    {
      claim: 'PNG in the browser',
      source: 'packages/canvas/README.md',
      marker: '`canvasToPng` (browser)',
    },
    {
      claim: 'No HTML sinks',
      source: 'packages/canvas/README.md',
      marker: 'with no HTML sinks',
    },
    {
      claim: 'Export is tested',
      source: 'packages/canvas/tests/output.test.ts',
      marker: 'canvasToSvg',
    },
  ],
};
