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
  title: 'From a board of shapes to a file.',
  steps: [
    {
      title: 'Model',
      body: 'Typed shapes, connectors, groups and frames, with operations and an op log.',
      package: '@texuli/canvas',
    },
    {
      title: 'Edit',
      body: 'The editor is the drawing surface: toolbar, pan, zoom, snapping and transforms.',
      package: '@texuli/canvas',
    },
    {
      title: 'View',
      body: 'The viewer is read-only and exposes the structure as text, with a shape tree.',
      package: '@texuli/canvas',
    },
    {
      title: 'Sync',
      body: 'Replicas stay in step through the document sync adapter. Your app supplies the transport.',
      package: '@texuli/canvas',
    },
    {
      title: 'Export',
      body: 'Write the board as SVG or PNG with escaped markup and the URL policy on images.',
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
