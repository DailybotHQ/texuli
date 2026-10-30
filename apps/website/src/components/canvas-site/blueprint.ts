/**
 * Canvases as agent data on /canvas-page/ (spec 0.8.0): a blueprint whose
 * `canvas` node carries a whole board, and a hostile copy whose sticky
 * note asks for a raw CSS paint (styles are a closed token palette), which
 * the canvas validator refuses before anything paints. Fictional data only
 * (Harbor, example.com). Checked by apps/website/tests/site-canvas.test.ts.
 */

/** The spec version that admits `canvas` nodes. */
export const CANVAS_SPEC = '0.8.0';

const CATALOG_PIN = '0'.repeat(64);

export const AGENT_CANVAS = {
  format: 'texuli-canvas',
  formatVersion: 1,
  meta: { title: 'Support flow', locale: 'en' },
  grid: 8,
  shapes: [
    { id: 'ticket', type: 'ellipse', x: 0, y: 24, width: 152, height: 72, text: 'New ticket' },
    { id: 'known', type: 'diamond', x: 216, y: 8, width: 136, height: 104, text: 'Known issue?' },
    {
      id: 'reply',
      type: 'rect',
      x: 432,
      y: 0,
      width: 152,
      height: 64,
      radius: 8,
      text: 'Send the saved reply',
      paint: { fill: 'green' },
    },
    {
      id: 'escalate',
      type: 'rect',
      x: 432,
      y: 104,
      width: 152,
      height: 64,
      radius: 8,
      text: 'Escalate to Tier 2',
      paint: { fill: 'orange' },
    },
    {
      id: 'tip',
      type: 'sticky',
      x: 0,
      y: 152,
      width: 200,
      height: 112,
      text: 'Reply within one business day',
      color: 'yellow',
    },
  ],
  connectors: [
    { id: 'c1', from: { shape: 'ticket' }, to: { shape: 'known' } },
    { id: 'c2', from: { shape: 'known' }, to: { shape: 'reply' }, routing: 'elbow', text: 'yes' },
    { id: 'c3', from: { shape: 'known' }, to: { shape: 'escalate' }, routing: 'elbow', text: 'no' },
  ],
};

/** The same board with one sticky asking for a raw CSS paint. */
export const HOSTILE_CANVAS = {
  ...AGENT_CANVAS,
  shapes: [
    ...AGENT_CANVAS.shapes.slice(0, 4),
    {
      id: 'tip',
      type: 'sticky',
      x: 0,
      y: 152,
      width: 200,
      height: 112,
      text: 'Reply within one business day',
      color: 'url(https://tracker.example.com/pixel)',
    },
  ],
};

export function canvasEnvelope(canvas: unknown): Record<string, unknown> {
  return {
    format: 'texuli-blueprint',
    version: 1,
    spec: CANVAS_SPEC,
    id: 'support-flow',
    catalog: CATALOG_PIN,
    status: 'draft',
    createdAt: '2026-10-29T09:00:00Z',
    updatedAt: '2026-10-29T09:00:00Z',
    generator: { kind: 'agent', name: 'Harbor assistant', model: 'example-model' },
    tier: 'untrusted',
    profile: 'web',
    tree: { id: 'canvas', key: 'support-flow', props: { label: 'Support flow board', canvas } },
  };
}

export const AGENT_CANVAS_BLUEPRINT = canvasEnvelope(AGENT_CANVAS);
export const HOSTILE_CANVAS_BLUEPRINT = canvasEnvelope(HOSTILE_CANVAS);
export const AGENT_CANVAS_JSON = JSON.stringify(AGENT_CANVAS_BLUEPRINT, null, 2);
export const HOSTILE_STICKY_JSON = JSON.stringify(HOSTILE_CANVAS.shapes[4], null, 2);
