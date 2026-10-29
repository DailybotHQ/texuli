/**
 * /canvas-page/ (PLAN_010 T-site-features): honest status copy (in
 * development, coming in 0.8.0, not on npm), fictional data, no HTML sinks,
 * lazy islands, sections that match the page, a board that holds every
 * shape type, routing and cap and validates at the untrusted tier, the
 * vocabulary tables keyed to the package's own lists, two replicas that
 * converge through the in-memory hub, an SVG export that escapes text, and
 * the agent blueprint accepted while the hostile paint is refused.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANVAS_TOOLS, TOOL_KEYS } from '@texuli/canvas/editor';
import { canvasToSvg } from '@texuli/canvas/export';
import { checkCanvasDraft } from '@texuli/canvas/host';
import {
  CANVAS_CAPS,
  CANVAS_ROUTINGS,
  type CanvasDocument,
  type CanvasShape,
  moveOps,
  SHAPE_TYPES,
  validateCanvas,
} from '@texuli/canvas/model';
import { createCanvasSync } from '@texuli/canvas/sync';
import { validateDraft } from '@texuli/catalog/validate';
import { createMemorySyncHub } from '@texuli/document/sync';
import { createPlayerCatalog } from '@texuli/player';
import { describe, expect, it } from 'vitest';
import {
  AGENT_CANVAS_BLUEPRINT,
  CANVAS_SPEC,
  HOSTILE_CANVAS_BLUEPRINT,
} from '../src/components/canvas-site/blueprint.ts';
import { launchBoard, SHAPE_NOTES, SHARED_BOARD } from '../src/components/canvas-site/board.ts';
import {
  CANVAS_DOCS,
  CANVAS_RELEASE,
  CANVAS_SECTIONS,
  CANVAS_STATUS,
  TOOL_NAMES,
} from '../src/components/canvas-site/page.ts';

const read = (path: string) => readFileSync(resolve('apps/website/src', path), 'utf8');
const PAGE = read('pages/canvas-page/index.astro');
const ISLANDS = ['AgentCanvasDemo', 'CanvasWorkbench', 'CollabCanvas'];
const SOURCES = [
  ...ISLANDS.map((name) => `components/canvas-site/${name}.svelte`),
  'components/canvas-site/blueprint.ts',
  'components/canvas-site/board.ts',
  'components/canvas-site/download.ts',
  'components/canvas-site/page.ts',
  'pages/canvas-page/index.astro',
].map((path) => [path, read(path)] as const);

function walk(shapes: readonly CanvasShape[]): CanvasShape[] {
  return shapes.flatMap((shape) =>
    'children' in shape ? [shape, ...walk(shape.children)] : [shape]
  );
}

const errorsOf = (blueprint: unknown) =>
  validateDraft(blueprint, {
    catalog: createPlayerCatalog(),
    tier: 'untrusted',
    checkCanvas: checkCanvasDraft,
  }).diagnostics.filter((entry) => entry.severity === 'error');

describe('canvas page: copy and safety', () => {
  it('says @texuli/canvas is in development and coming in 0.8.0, and never that it is on npm', () => {
    const pkg = JSON.parse(readFileSync(resolve('packages/canvas/package.json'), 'utf8')) as {
      version: string;
      private?: boolean;
    };
    expect(pkg.version).toBe('0.0.0');
    expect(pkg.private).toBe(true);
    expect(CANVAS_RELEASE).toBe('0.8.0');
    expect(CANVAS_STATUS).toBe('In development, coming in 0.8.0: not published to npm yet.');
    const copy = PAGE.replace(/\s+/g, ' ');
    expect(copy).toMatch(
      /eyebrow=\{`@texuli\/canvas · in development · coming in \$\{CANVAS_RELEASE\}`\}/
    );
    expect(copy).toContain('it is not published to npm yet');
    // Planned work is labelled as planned.
    expect(copy).toContain('The editor does not paint other people’s cursors yet');
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(
        /on npm from|production[- ]ready|is released|available on npm|npm install @texuli\/canvas/i
      );
      expect(source, path).not.toMatch(/\{@html|set:html|innerHTML/);
      for (const [url] of source.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
        expect(new URL(url).hostname, `${path}: ${url}`).toMatch(/(^|\.)example\.com$/);
      }
    }
  });

  it('mounts every island with client:visible and loads the editor, sync and player lazily', () => {
    const islands = [...PAGE.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
    expect(islands.map(([, name]) => name).sort()).toEqual(ISLANDS);
    for (const [, name, directive] of islands) expect(`${name} ${directive}`).toMatch(/ visible$/);
    const heavy =
      /^import\s+(?!type\b)[^;]*from\s+'@texuli\/(canvas\/(editor|sync|host|export)|player|document\/sync)'/m;
    for (const name of ISLANDS) {
      expect(read(`components/canvas-site/${name}.svelte`), name).not.toMatch(heavy);
    }
  });

  it('gives every section an anchor and a unique id, and points at docs that exist', () => {
    const ids = CANVAS_SECTIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(PAGE).toContain(`id="${id}"`);
    expect(PAGE).not.toMatch(/<h1[\s>]/);
    for (const doc of CANVAS_DOCS) expect(existsSync(resolve(doc.path)), doc.path).toBe(true);
  });
});

describe('canvas page: data', () => {
  it('holds one shape of every type, every routing and every cap, valid at the untrusted tier', () => {
    const board = launchBoard();
    const result = validateCanvas(board, { trust: 'untrusted' } as never);
    expect(result.ok).toBe(true);
    const types = new Set(walk(board.shapes).map((shape) => shape.type));
    for (const type of SHAPE_TYPES) expect(types, type).toContain(type);
    const routings = new Set((board.connectors ?? []).map((c) => c.routing ?? 'straight'));
    for (const routing of CANVAS_ROUTINGS) expect(routings, routing).toContain(routing);
    const caps = new Set(
      (board.connectors ?? []).flatMap((c) => [c.startCap ?? 'none', c.endCap ?? 'arrow'])
    );
    for (const cap of CANVAS_CAPS) expect(caps, cap).toContain(cap);
    expect(validateCanvas(SHARED_BOARD).ok).toBe(true);
  });

  it('describes every shape type and names every tool, each with its key', () => {
    expect(Object.keys(SHAPE_NOTES).sort()).toEqual([...SHAPE_TYPES].sort());
    expect(Object.keys(TOOL_NAMES).sort()).toEqual([...CANVAS_TOOLS].sort());
    for (const tool of CANVAS_TOOLS) expect(Object.values(TOOL_KEYS), tool).toContain(tool);
  });

  it('converges two replicas through the in-memory hub', async () => {
    const hub = createMemorySyncHub();
    const ada = createCanvasSync({ replica: 'ada-test', canvas: SHARED_BOARD });
    const lin = createCanvasSync({ replica: 'lin-test', canvas: SHARED_BOARD });
    const a = ada.connect(hub.adapter(), { name: 'Ada', color: 1 });
    const l = lin.connect(hub.adapter(), { name: 'Lin', color: 4 });
    ada.apply(moveOps(ada.canvas, ['went-well'], { x: 16, y: 8 }));
    // The hub delivers on a microtask, like a real transport delivers later.
    await new Promise((done) => setTimeout(done, 0));
    const moved = (doc: CanvasDocument) => doc.shapes.find((shape) => shape.id === 'went-well');
    expect(moved(lin.canvas)).toMatchObject({ x: 16, y: 8 });
    expect(lin.canvas).toEqual(ada.canvas);
    expect(lin.peers().map((peer) => peer.name)).toContain('Ada');
    a.close();
    l.close();
    ada.destroy();
    lin.destroy();
  });

  it('exports the board as SVG with its text escaped', () => {
    const svg = canvasToSvg(launchBoard());
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Kickoff');
    expect(svg).toContain('Build the beta');
    expect(svg).not.toMatch(/<script|javascript:/i);
  });

  it('writes an agent canvas blueprint (spec 0.8.0) the player accepts, and refuses the raw paint', () => {
    expect(CANVAS_SPEC).toBe('0.8.0');
    expect(errorsOf(AGENT_CANVAS_BLUEPRINT)).toEqual([]);
    const hostile = errorsOf(HOSTILE_CANVAS_BLUEPRINT);
    expect(hostile.length).toBeGreaterThan(0);
  });
});
