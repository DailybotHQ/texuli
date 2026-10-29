/**
 * The canvases of /canvas-page/, plain `@texuli/canvas` data validated
 * before anything paints:
 *
 * - `launchBoard()`: one shape of every `SHAPE_TYPES` entry (a frame of
 *   stickies, a group, a line, an arrow, a freehand path, text and an
 *   image ref), connectors with every routing and cap, and token colors;
 * - `SHARED_BOARD`: a small board two local peers edit together;
 * - `SHAPE_NOTES`, keyed by `CanvasShapeType` (so a new shape type fails
 *   the type check until the page describes it).
 *
 * Fictional data only. Checked by apps/website/tests/site-canvas.test.ts.
 */
import type { CanvasDocument, CanvasShapeType } from '@texuli/canvas/model';

export const SHAPE_NOTES: Readonly<Record<CanvasShapeType, string>> = {
  rect: 'A box with optional rounded corners and text',
  ellipse: 'An ellipse with text',
  diamond: 'A decision diamond with text',
  line: 'A polyline of at least two points',
  arrow: 'A polyline with an arrowhead at its end',
  path: 'A freehand stroke, simplified as you draw',
  text: 'Free text in four sizes and three alignments',
  sticky: 'A sticky note in a token color',
  image: 'An image the host resolves from a ref; its alt text paints if refused',
  frame: 'A titled region that holds and clips shapes',
  group: 'Shapes that move, resize and order as one',
};

export function launchBoard(): CanvasDocument {
  return {
    format: 'texuli-canvas',
    formatVersion: 1,
    meta: { title: 'Launch plan', locale: 'en' },
    grid: 8,
    shapes: [
      {
        id: 'discover',
        type: 'frame',
        title: 'Discover',
        x: 0,
        y: 0,
        width: 416,
        height: 248,
        children: [
          {
            id: 'note-interviews',
            type: 'sticky',
            x: 24,
            y: 48,
            width: 168,
            height: 168,
            text: 'Twelve customer interviews',
            color: 'yellow',
          },
          {
            id: 'note-pricing',
            type: 'sticky',
            x: 216,
            y: 48,
            width: 168,
            height: 168,
            text: 'Pricing survey ready',
            color: 'pink',
          },
        ],
      },
      { id: 'kickoff', type: 'ellipse', x: 488, y: 16, width: 152, height: 72, text: 'Kickoff' },
      { id: 'ready', type: 'diamond', x: 504, y: 136, width: 120, height: 104, text: 'Ready?' },
      {
        id: 'build',
        type: 'rect',
        x: 712,
        y: 152,
        width: 152,
        height: 72,
        radius: 8,
        text: 'Build the beta',
        paint: { fill: 'teal' },
      },
      {
        id: 'polish',
        type: 'rect',
        x: 496,
        y: 304,
        width: 136,
        height: 64,
        radius: 8,
        text: 'Polish',
        paint: { fill: 'orange', dash: 'dashed' },
      },
      {
        id: 'release',
        type: 'group',
        children: [
          {
            id: 'docs',
            type: 'rect',
            x: 712,
            y: 296,
            width: 112,
            height: 56,
            radius: 4,
            text: 'Docs',
            paint: { fill: 'blue' },
          },
          {
            id: 'qa',
            type: 'ellipse',
            x: 848,
            y: 296,
            width: 112,
            height: 56,
            text: 'QA',
            paint: { fill: 'purple' },
          },
        ],
      },
      {
        id: 'owner',
        type: 'text',
        x: 0,
        y: 272,
        width: 320,
        height: 32,
        text: 'Facilitator: Ada Example',
        fontSize: 'm',
      },
      {
        id: 'timeline',
        type: 'line',
        x: 0,
        y: 336,
        width: 416,
        height: 8,
        points: [
          [0, 4],
          [416, 4],
        ],
        paint: { stroke: 'gray', dash: 'dotted', strokeWidth: 2 },
      },
      {
        id: 'momentum',
        type: 'arrow',
        x: 0,
        y: 368,
        width: 200,
        height: 40,
        points: [
          [0, 32],
          [96, 8],
          [200, 20],
        ],
        paint: { stroke: 'green', strokeWidth: 3 },
      },
      {
        id: 'scribble',
        type: 'path',
        x: 232,
        y: 360,
        width: 168,
        height: 56,
        points: [
          [0, 40],
          [32, 8],
          [64, 48],
          [96, 8],
          [128, 44],
          [168, 16],
        ],
        paint: { stroke: 'red', strokeWidth: 2 },
      },
      {
        id: 'cover',
        type: 'image',
        x: 904,
        y: 16,
        width: 176,
        height: 120,
        ref: 'launch-cover',
        alt: 'Launch cover sketch',
      },
    ],
    connectors: [
      { id: 'c-kickoff', from: { shape: 'kickoff' }, to: { shape: 'ready' }, routing: 'elbow' },
      {
        id: 'c-yes',
        from: { shape: 'ready', anchor: 'right' },
        to: { shape: 'build', anchor: 'left' },
        routing: 'curved',
        text: 'yes',
      },
      {
        id: 'c-no',
        from: { shape: 'ready', anchor: 'bottom' },
        to: { shape: 'polish', anchor: 'top' },
        routing: 'straight',
        text: 'no',
        paint: { dash: 'dashed' },
      },
      {
        id: 'c-docs',
        from: { shape: 'build', anchor: 'bottom' },
        to: { shape: 'docs', anchor: 'top' },
        routing: 'elbow',
        startCap: 'dot',
        endCap: 'arrow',
      },
      {
        id: 'c-qa',
        from: { shape: 'docs', anchor: 'right' },
        to: { shape: 'qa', anchor: 'left' },
        startCap: 'none',
        endCap: 'none',
      },
    ],
  };
}

/** The board Ada and Lin edit together. */
export const SHARED_BOARD: CanvasDocument = {
  format: 'texuli-canvas',
  formatVersion: 1,
  meta: { title: 'Retro', locale: 'en' },
  grid: 8,
  shapes: [
    {
      id: 'went-well',
      type: 'sticky',
      x: 0,
      y: 0,
      width: 160,
      height: 120,
      text: 'Went well',
      color: 'green',
    },
    {
      id: 'to-improve',
      type: 'sticky',
      x: 192,
      y: 0,
      width: 160,
      height: 120,
      text: 'To improve',
      color: 'orange',
    },
    {
      id: 'action',
      type: 'rect',
      x: 96,
      y: 176,
      width: 168,
      height: 64,
      radius: 8,
      text: 'Action items',
    },
  ],
  connectors: [
    { id: 'c-left', from: { shape: 'went-well' }, to: { shape: 'action' }, routing: 'curved' },
    { id: 'c-right', from: { shape: 'to-improve' }, to: { shape: 'action' }, routing: 'curved' },
  ],
};
