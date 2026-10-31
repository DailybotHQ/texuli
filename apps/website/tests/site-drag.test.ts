// @vitest-environment happy-dom
/**
 * /drag-page/ and /workflows-page/ (PLAN_007 T-site-workbench): honest copy,
 * fictional data, sections that match the page, a valid sample pipeline, and
 * the hero workbench driven from the keyboard with its visible log.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { findCycleEdge, parseWorkflow, stringifyWorkflow } from '@texuli/workflows/model';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import DragWorkbench from '../src/components/drag-site/DragWorkbench.svelte';
import { DRAG_INSTRUCTIONS, LABELS, labelOf } from '../src/components/drag-site/data.ts';
import { DRAG_PIECES, DRAG_SECTIONS } from '../src/components/drag-site/page.ts';
import { WORKFLOW_FEATURES } from '../src/components/workflows-site/page.ts';
import { PIPELINE_REGISTRY, pipelineGraph } from '../src/components/workflows-site/pipeline.ts';

const read = (path: string) => readFileSync(resolve('apps/website/src', path), 'utf8');
const DRAG_PAGE = read('pages/drag-page/index.astro');
const WORKFLOWS_PAGE = read('pages/workflows-page/index.astro');
const SOURCES = [
  'components/drag-site/DragWorkbench.svelte',
  'components/drag-site/SortableKinds.svelte',
  'components/drag-site/GroupsDemo.svelte',
  'components/drag-site/SpatialDemo.svelte',
  'components/drag-site/GridColumnsDemo.svelte',
  'components/drag-site/FileDropDemo.svelte',
  'components/drag-site/data.ts',
  'components/drag-site/page.ts',
  'components/workflows-site/WorkflowsEditorDemo.svelte',
  'components/workflows-site/WorkflowsViewerDemo.svelte',
  'components/workflows-site/pipeline.ts',
  'components/workflows-site/page.ts',
  'pages/drag-page/index.astro',
  'pages/workflows-page/index.astro',
].map((path) => [path, read(path)] as const);

afterEach(() => cleanup());

describe('drag and workflows pages: copy and safety', () => {
  it('say "in development" for both packages and name the published 0.11.0 pre-release', () => {
    for (const [page, name] of [
      [DRAG_PAGE, 'drag'],
      [WORKFLOWS_PAGE, 'workflows'],
    ] as const) {
      const copy = page.replace(/\s+/g, ' ');
      expect(copy).toContain(`@texuli/${name} · in development`);
      expect(copy).toContain(
        `<code>@texuli/${name}</code> is in development and on npm as <code>0.11.0</code>, a pre-1.0 release.`
      );
      expect(copy).not.toMatch(/not (?:yet )?on npm/);
    }
  });

  it('render no HTML from data and use only fictional example.com addresses', () => {
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(/\{@html|set:html|innerHTML/);
      for (const [url] of source.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
        expect(new URL(url).hostname, `${path}: ${url}`).toMatch(/(^|\.)example\.com$/);
      }
    }
  });

  it('mount every island lazily with client:visible', () => {
    for (const page of [DRAG_PAGE, WORKFLOWS_PAGE]) {
      const islands = [...page.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
      expect(islands.length).toBeGreaterThan(0);
      for (const [, name, directive] of islands)
        expect(`${name} ${directive}`).toMatch(/ visible$/);
    }
  });

  it('give every drag section an anchor on the page and a unique id', () => {
    const ids = DRAG_SECTIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(DRAG_PAGE).toContain(`id="${id}"`);
    expect(DRAG_SECTIONS.find((entry) => entry.id === 'file-drop')?.summary).toMatch(
      /not @texuli\/drag/
    );
    expect(DRAG_PIECES.map((piece) => piece.name)).toEqual([
      'session',
      'sortable',
      'collision',
      'modifiers',
      'gesture',
      'auto-scroll',
      'spatial',
      'graph',
      'messages',
    ]);
  });

  it('label every demo item, including clones', () => {
    expect(labelOf('text-copy-2')).toBe(LABELS.text);
    expect(labelOf('unknown-id')).toBe('unknown-id');
    expect(DRAG_INSTRUCTIONS).toMatch(/Space or Enter to pick up/);
  });
});

describe('the sample pipeline', () => {
  it('is a valid, acyclic graph on the closed registry, laid out in both directions', () => {
    for (const direction of ['LR', 'TB'] as const) {
      const graph = pipelineGraph(direction);
      expect(graph.nodes).toHaveLength(6);
      expect(graph.edges).toHaveLength(6);
      // A JSON round trip through the strict parser, against the closed registry.
      const result = parseWorkflow(JSON.parse(stringifyWorkflow(graph)), {
        registry: PIPELINE_REGISTRY,
      });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(
        findCycleEdge(
          graph.nodes.map((node) => node.id),
          graph.edges
        )
      ).toBeUndefined();
      const positions = new Set(graph.nodes.map((node) => `${node.position.x},${node.position.y}`));
      expect(positions.size).toBe(6);
    }
    expect(pipelineGraph('LR')).toEqual(pipelineGraph('LR'));
    expect(WORKFLOW_FEATURES.length).toBeGreaterThanOrEqual(4);
  });
});

describe('the hero workbench', () => {
  it('moves a list item from the keyboard and shows the announcements in the log', async () => {
    render(DragWorkbench, { props: {} });
    const list = screen.getByRole('list', { name: LABELS.priorities });
    const handle = within(list).getByRole('button', { name: LABELS['launch-notes'] });
    expect(handle.getAttribute('aria-roledescription')).toBe('draggable item');
    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await fireEvent.keyDown(handle, { key: ' ' });
    await tick();
    const items = within(list)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(items.slice(0, 2)).toEqual([LABELS['pricing-page'], LABELS['launch-notes']]);
    const log = screen.getByRole('list', { name: 'Announcements' });
    expect(log.textContent).toMatch(/Write launch notes dropped at position 2 of 4/);
    expect(log.textContent).toMatch(/picked up/);
  });

  it('mirrors the surfaces and shows the keyboard instructions from its toggles', async () => {
    const { container } = render(DragWorkbench, { props: {} });
    expect(container.querySelector('[data-drag-keys]')?.textContent).toBe(DRAG_INSTRUCTIONS);
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Right to left' }));
    expect(container.querySelector('[data-drag-dir]')?.getAttribute('dir')).toBe('rtl');
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Keyboard instructions' }));
    expect(container.querySelector('[data-drag-keys]')).toBeNull();
  });
});
