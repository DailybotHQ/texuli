/**
 * Copy for the Canvas "How it works" section. Five steps follow a board from data
 * to a file: model → edit → view → sync → export. Each step names the registry
 * package that does it. `CANVAS_HOW_TRACE` records, per step, the subpath export
 * and the registry capability it rests on, so the test checks every claim against
 * `entries/canvas.ts` and the package manifests.
 *
 * Facts come from the canvas README: a framework-free model of shapes, connectors,
 * groups and frames with operations and an op log; the editor (toolbar, pan, zoom,
 * snapping, transforms, keyboard and shape tree); the read-only viewer; CRDT
 * collaboration on the document sync adapter (the host supplies transport); SVG
 * and PNG export with no HTML sinks. Persistence and image hosting belong to the
 * host. No counts are stated.
 */
import type { SolutionHowProps } from '../../shared/types.ts';

export const CANVAS_HOW: Omit<SolutionHowProps, 'entry'> = {
  title: 'From shape model to SVG or PNG.',
  art: { slot: 'solution-canvas-how', variant: 'band' },
  steps: [
    {
      title: 'Model',
      body: 'Define shapes and connectors as validated data with reversible operations.',
      package: '@texuli/canvas',
    },
    {
      title: 'Edit',
      body: 'Edit on a canvas with pan, zoom, snapping and transforms.',
      package: '@texuli/canvas',
    },
    {
      title: 'View',
      body: 'Show a read-only canvas with its structure as text and a shape tree.',
      package: '@texuli/canvas',
    },
    {
      title: 'Sync',
      body: 'Sync replicas through the document adapter; your app supplies transport.',
      package: '@texuli/canvas',
    },
    {
      title: 'Export',
      body: 'Export SVG or browser-rendered PNG; image URLs follow the URL policy.',
      package: '@texuli/canvas',
    },
  ],
};

/** Per step (same order): the subpath export it uses and the capability it demonstrates. */
export const CANVAS_HOW_TRACE: readonly Readonly<{ subpath: string; capability: string }>[] = [
  { subpath: './model', capability: 'draw' },
  { subpath: './editor', capability: 'draw' },
  { subpath: './viewer', capability: 'keyboard' },
  { subpath: './sync', capability: 'sync' },
  { subpath: './export', capability: 'export' },
];
