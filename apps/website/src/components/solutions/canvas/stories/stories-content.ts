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
      title: 'Turn scattered ideas into a clear board',
      body: 'Arrange shapes, notes, images, frames and groups, then connect them with straight, elbow or curved lines. Snapping transforms and reversible operations keep each edit in the board history.',
      capabilities: ['draw'],
      art: { slot: 'solution-canvas-story-1', variant: 'plate' },
    },
    {
      id: 'keyboard',
      title: 'Keep every shape within keyboard reach',
      body: 'Move through shapes in reading order, or use the shape tree to find a shape or connector. Focus and edits stay visible and are announced as you work.',
      capabilities: ['keyboard'],
      art: { slot: 'solution-canvas-story-2', variant: 'plate' },
    },
    {
      id: 'sync',
      title: 'Keep shared boards in step',
      body: 'The document sync adapter validates each batch and applies the same canvas rules on every replica. Your app supplies the transport; Texuli does not host a realtime service.',
      capabilities: ['sync'],
      art: { slot: 'solution-canvas-story-3', variant: 'plate' },
    },
    {
      id: 'export',
      title: 'Carry the board into SVG or PNG',
      body: 'Export escaped SVG or render a PNG in the browser. Text stays text in the SVG output, and image URLs follow the URL policy.',
      capabilities: ['export'],
      // Three story plates exist; the fourth story shows the Canvas page banner (like Slides).
      art: { slot: 'page-canvas', variant: 'banner' },
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
