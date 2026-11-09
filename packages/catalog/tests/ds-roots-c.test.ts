import { cleanup, render } from '@testing-library/svelte';
import { CodeBlockView } from '@texuli/blocks/code/renderers';
import { CodeField } from '@texuli/blocks/code-field';
import { DataBlockView } from '@texuli/blocks/data/renderers';
import DiagramFamily from '@texuli/blocks/diagram/renderers';
import { EmbedBlockView } from '@texuli/blocks/embed/renderers';
import { InteractiveBlockView } from '@texuli/blocks/interactive/renderers';
import { MapBlockView } from '@texuli/blocks/map/renderers';
import { MediaBlockView } from '@texuli/blocks/media/renderers';
import { StructureFamily } from '@texuli/blocks/structure/renderers';
import { TextBlockView } from '@texuli/blocks/text/renderers';
import { DS_COMPONENT_ATTRIBUTE, DS_DENSITY_ATTRIBUTE } from '@texuli/spec/design-system';
import { afterEach, describe, expect, it } from 'vitest';
import { CanvasViewer } from '../../canvas/src/viewer/index.ts';
import { SchemaForm, validateFormSchema } from '../../forms/src/index.ts';
import { SheetView } from '../../sheets/src/view/index.ts';
import { defineNodeTypes, type WorkflowGraph } from '../../workflows/src/model/index.ts';
import { WorkflowViewer } from '../../workflows/src/viewer/index.ts';
import { buildCatalog } from '../src/build/build.ts';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';
import { renderCatalogFromBuild, renderCatalogTree } from '../src/render/renderer/index.ts';

/**
 * Group C catalog ids (T-audit-roots): blocks, forms, canvas, sheets, workflows.
 * `@texuli/editor` has no catalog id in the 170.
 */
const GROUP_C = [
  'blocks-code',
  'blocks-data',
  'blocks-diagram',
  'blocks-embed',
  'blocks-interactive',
  'blocks-map',
  'blocks-media',
  'blocks-structure',
  'blocks-text',
  'canvas',
  'code-field',
  'schema-form',
  'spreadsheet',
  'workflow-graph',
] as const;

const C_PACKAGES = new Set([
  '@texuli/blocks',
  '@texuli/forms',
  '@texuli/editor',
  '@texuli/canvas',
  '@texuli/sheets',
  '@texuli/workflows',
]);

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const PROPS: Record<(typeof GROUP_C)[number], Record<string, unknown>> = {
  'blocks-text': { block: { type: 'heading', level: 2, text: 'Harbor notes' } },
  'blocks-data': {
    block: {
      type: 'table',
      caption: 'Scores',
      columns: [
        { id: 'team', label: 'Team' },
        { id: 'score', label: 'Score' },
      ],
      rows: [{ team: 'Design', score: 92 }],
    },
  },
  'blocks-diagram': {
    block: {
      type: 'flow',
      nodes: [
        { id: 'start', label: 'Collect brief' },
        { id: 'ship', label: 'Ship prototype' },
      ],
    },
  },
  'blocks-embed': {
    block: { type: 'link-preview', href: 'https://example.com/guide', title: 'Guide' },
  },
  'blocks-interactive': {
    block: {
      type: 'poll',
      id: 'q1',
      question: 'Which fictional harbor is busiest?',
      options: [
        { id: 'north', label: 'North Pier' },
        { id: 'south', label: 'South Basin' },
      ],
    },
  },
  'blocks-map': {
    block: {
      type: 'map',
      id: 'harbor-route',
      label: 'Delivery route across Port Meridian',
      title: 'Morning delivery route',
      basemap: 'port-meridian',
      points: [
        { id: 'depot', label: 'North Pier depot', lng: -18.6, lat: -30.4 },
        { id: 'market', label: 'Meridian Center market', lng: -19.1, lat: -30.72 },
      ],
    },
  },
  'blocks-media': {
    block: { type: 'image', src: PNG, alt: 'Red pixel', width: 1, height: 1 },
  },
  'blocks-structure': {
    block: {
      type: 'columns',
      columns: [
        [{ type: 'heading', level: 3, text: 'Plan' }],
        [{ type: 'heading', level: 3, text: 'Ship' }],
      ],
    },
  },
  'blocks-code': { block: { type: 'code', lang: 'ts', code: 'const n = 1;' } },
  canvas: {
    canvas: {
      format: 'texuli-canvas',
      formatVersion: 1,
      meta: { title: 'Launch plan' },
      shapes: [{ id: 'start', type: 'ellipse', x: 0, y: 0, width: 120, height: 80, text: 'Start' }],
      connectors: [],
    },
  },
  'code-field': { value: 'const n = 1;', language: 'ts', 'aria-label': 'Snippet' },
  'schema-form': { action: 'save', schema: { title: 'Note', fields: [] } },
  spreadsheet: {
    sheet: {
      format: 'texuli-sheet',
      formatVersion: 1,
      meta: { title: 'Office budget' },
      sheets: [{ id: 'costs', name: 'Costs', rows: 2, columns: 2, cells: { A1: 'Desk', B1: 120 } }],
    },
  },
  'workflow-graph': {
    label: 'Expense approval',
    graph: {
      version: '0.1',
      cycles: 'forbid',
      groups: [],
      nodes: [{ id: 'ask', type: 'request', label: 'Expense request', position: { x: 0, y: 0 } }],
      edges: [],
    },
  },
};

const registry = defineNodeTypes([
  {
    type: 'request',
    label: 'Request',
    ports: [{ id: 'out', direction: 'out', dataType: 'any', label: 'Submitted' }],
  },
]);

const workflowGraph = PROPS['workflow-graph'].graph as WorkflowGraph;

const form = (() => {
  const result = validateFormSchema(
    { title: 'Note', fields: [{ name: 'title', type: 'text', label: 'Title' }] },
    { tier: 'developer' }
  );
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.form;
})();

afterEach(cleanup);

const build = await buildCatalog(ALL_MANIFEST_GROUPS);
const catalog = renderCatalogFromBuild(build.catalog, { developer: 'all' });

function rootOf(id: string, container: HTMLElement): HTMLElement {
  const node = container.querySelector(`[${DS_COMPONENT_ATTRIBUTE}="${id}"]`);
  expect(node, id).toBeInstanceOf(HTMLElement);
  return node as HTMLElement;
}

describe('design-system root attributes (group C)', () => {
  it('covers every catalog id in blocks, forms, editor, canvas, sheets and workflows', () => {
    const ids = build.catalog.entries
      .filter((entry) => C_PACKAGES.has(entry.package))
      .map((entry) => entry.id)
      .sort();
    expect(ids).toEqual([...GROUP_C].sort());
  });

  it('the catalog renderer accepts a minimal tree for each group C id', () => {
    for (const id of GROUP_C) {
      const { roots, diagnostics } = renderCatalogTree(
        { id, props: PROPS[id] },
        { catalog, tier: 'developer' }
      );
      expect(
        diagnostics.filter((d) => d.severity === 'error'),
        id
      ).toEqual([]);
      expect(roots[0], id).toMatchObject({ kind: 'component', id });
    }
  });

  it('paints data-tx-component on every group C root', () => {
    const { container: text } = render(TextBlockView, { props: PROPS['blocks-text'] });
    expect(rootOf('blocks-text', text).tagName).toBe('HGROUP');

    const { container: data } = render(DataBlockView, { props: PROPS['blocks-data'] });
    expect(rootOf('blocks-data', data).getAttribute('data-tx-block')).toBe('table');

    const { container: diagram } = render(DiagramFamily, { props: PROPS['blocks-diagram'] });
    expect(rootOf('blocks-diagram', diagram).getAttribute('data-tx-diagram')).toBe('flow');

    const { container: embed } = render(EmbedBlockView, { props: PROPS['blocks-embed'] });
    expect(rootOf('blocks-embed', embed).tagName).toBe('ARTICLE');

    const { container: interactive } = render(InteractiveBlockView, {
      props: PROPS['blocks-interactive'],
    });
    expect(rootOf('blocks-interactive', interactive).getAttribute('data-tx-block')).toBe('poll');

    const { container: map } = render(MapBlockView, { props: PROPS['blocks-map'] });
    expect(rootOf('blocks-map', map).getAttribute('data-tx-block')).toBe('map');

    const { container: media } = render(MediaBlockView, { props: PROPS['blocks-media'] });
    expect(rootOf('blocks-media', media).tagName).toBe('FIGURE');

    const { container: structure } = render(StructureFamily, { props: PROPS['blocks-structure'] });
    expect(rootOf('blocks-structure', structure).getAttribute('data-tx-block')).toBe('columns');

    const { container: code } = render(CodeBlockView, { props: PROPS['blocks-code'] });
    expect(rootOf('blocks-code', code).tagName).toBe('FIGURE');

    const { container: canvas } = render(CanvasViewer, { props: PROPS.canvas });
    expect(rootOf('canvas', canvas).tagName).toBe('FIGURE');

    const { container: field } = render(CodeField, { props: PROPS['code-field'] });
    expect(rootOf('code-field', field).getAttribute('data-tx-code-field')).toBe('');

    const { container: schema } = render(SchemaForm, { props: { form } });
    expect(rootOf('schema-form', schema).tagName).toBe('FORM');

    const { container: sheet } = render(SheetView, { props: PROPS.spreadsheet });
    const sheetRoot = rootOf('spreadsheet', sheet);
    expect(sheetRoot.getAttribute(DS_DENSITY_ATTRIBUTE)).toBe('compact');

    const { container: dense } = render(SheetView, {
      props: { ...PROPS.spreadsheet, density: 'comfortable' },
    });
    expect(rootOf('spreadsheet', dense).getAttribute(DS_DENSITY_ATTRIBUTE)).toBe('comfortable');

    const { container: workflow } = render(WorkflowViewer, {
      props: { graph: workflowGraph, registry, label: 'Expense approval' },
    });
    expect(rootOf('workflow-graph', workflow).tagName).toBe('FIGURE');
  });
});
