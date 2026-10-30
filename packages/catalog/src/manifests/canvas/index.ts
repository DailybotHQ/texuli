/**
 * Catalog manifest for canvases as data (spec 0.8.0, ADR-012): one `canvas`
 * id whose `canvas` prop carries a Texuli canvas (the `@texuli/canvas`
 * format: shapes, sticky notes, frames, groups and connectors).
 * `validateDraft` refuses a `canvas` node unless the host supplies the
 * canvas validator (`checkCanvas`), so canvases never pass on structure
 * alone. `@texuli/player` hands a validated canvas to its `canvasHost`
 * (`@texuli/canvas/host` provides one around the viewer). Build-time only;
 * a subpath group the catalog root does not re-export.
 */
import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import type { GrammarComponentMeta } from '../../render/grammar/types.ts';

/** The catalog id of a canvas (spec 0.8.0). */
export const CANVAS_CATALOG_ID = 'canvas' as const;

export const canvasManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: CANVAS_CATALOG_ID,
  package: '@texuli/canvas',
  label: 'Canvas',
  summary:
    'A whiteboard or diagram as data: shapes, sticky notes, text, frames, groups and connectors on an infinite canvas.',
  tier: 'content',
  agentEmittable: true,
  useWhen: [
    'Sketch a flow, a map of ideas, a retro board or an architecture diagram people can keep editing',
    'Lay out sticky notes in frames and connect shapes with arrows',
  ],
  dontUseWhen: [
    'A workflow with typed ports that runs: use workflow-graph',
    'A chart of data: use a chart family',
    'Prose: use document',
  ],
  a11y: [
    'Painted as an image named by the canvas title, with every shape and connector listed as text in reading order',
    'Text is data, never HTML; image refs pass the URL policy at the host tier',
    'Styles are a closed palette of theme tokens, never raw CSS',
  ],
  props: [
    {
      name: 'canvas',
      kind: 'object',
      required: true,
      description:
        'A Texuli canvas: { format: "texuli-canvas", formatVersion: 1, meta: { title }, shapes, connectors }. Shapes: rect, ellipse, diamond, line, arrow, path (points), text, sticky, image ({ ref, alt }), frame ({ title, children }) and group ({ children }), each with an id and x, y, width, height. Connectors: { id, from: { shape }, to: { shape }, routing: straight | elbow | curved, text }.',
      schema: { $ref: '#/$defs/canvas' },
    },
    {
      name: 'label',
      kind: 'string',
      trust: 'untrusted',
      description: 'Accessible name; defaults to the canvas title.',
    },
  ],
  examples: [
    {
      id: 'decision',
      title: 'Decision flow',
      props: {
        canvas: {
          format: 'texuli-canvas',
          formatVersion: 1,
          meta: { title: 'Release decision' },
          shapes: [
            {
              id: 'ask',
              type: 'ellipse',
              x: 0,
              y: 0,
              width: 160,
              height: 72,
              text: 'Ready to ship?',
            },
            {
              id: 'ship',
              type: 'rect',
              x: 240,
              y: 0,
              width: 160,
              height: 72,
              text: 'Ship on example.com',
            },
            {
              id: 'idea',
              type: 'sticky',
              x: 0,
              y: 120,
              width: 160,
              height: 120,
              text: 'Ask the beta testers',
              color: 'yellow',
            },
          ],
          connectors: [
            {
              id: 'yes',
              from: { shape: 'ask' },
              to: { shape: 'ship' },
              routing: 'curved',
              text: 'yes',
            },
          ],
        },
      },
    },
  ],
  related: ['document', 'workflow-graph'],
});

export const CANVAS_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  canvasManifest,
]);

/** A canvas is a static figure; its shapes stay inside it. */
export const CANVAS_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = /* @__PURE__ */ Object.freeze([
  { id: CANVAS_CATALOG_ID, role: 'static' },
]);
