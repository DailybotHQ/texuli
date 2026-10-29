import type { CanvasDocument } from '@texuli/canvas/model';

/** A fictional launch retro: a frame of sticky notes, a decision flow and an image ref. */
export function retroBoard(): CanvasDocument {
  return {
    format: 'texuli-canvas',
    formatVersion: 1,
    meta: { title: 'Launch retro', locale: 'en' },
    grid: 8,
    shapes: [
      {
        id: 'went-well',
        type: 'frame',
        title: 'Went well',
        x: 0,
        y: 0,
        width: 400,
        height: 248,
        children: [
          {
            id: 'note-beta',
            type: 'sticky',
            x: 24,
            y: 48,
            width: 160,
            height: 160,
            text: 'Beta shipped on time',
            color: 'green',
          },
          {
            id: 'note-docs',
            type: 'sticky',
            x: 208,
            y: 48,
            width: 160,
            height: 160,
            text: 'Docs were ready',
            color: 'blue',
          },
        ],
      },
      { id: 'start', type: 'ellipse', x: 480, y: 16, width: 144, height: 72, text: 'Feedback' },
      { id: 'triage', type: 'diamond', x: 488, y: 136, width: 128, height: 112, text: 'Urgent?' },
      {
        id: 'fix',
        type: 'rect',
        x: 704,
        y: 152,
        width: 152,
        height: 80,
        radius: 8,
        text: 'Fix this week',
        paint: { fill: 'orange' },
      },
      {
        id: 'backlog',
        type: 'rect',
        x: 480,
        y: 312,
        width: 144,
        height: 72,
        radius: 8,
        text: 'Backlog',
      },
      {
        id: 'owner',
        type: 'text',
        x: 0,
        y: 288,
        width: 320,
        height: 32,
        text: 'Facilitator: Ada Example',
        fontSize: 's',
      },
    ],
    connectors: [
      { id: 'to-triage', from: { shape: 'start' }, to: { shape: 'triage' }, routing: 'elbow' },
      {
        id: 'urgent',
        from: { shape: 'triage', anchor: 'right' },
        to: { shape: 'fix', anchor: 'left' },
        routing: 'curved',
        text: 'yes',
      },
      {
        id: 'later',
        from: { shape: 'triage', anchor: 'bottom' },
        to: { shape: 'backlog', anchor: 'top' },
        text: 'no',
      },
    ],
  };
}
