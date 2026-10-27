import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { buildCatalog } from '@texuli/catalog/build';
import { renderCatalogFromBuild } from '@texuli/catalog/render/renderer';
import { validateDraft } from '@texuli/catalog/validate';
import { validateBlueprint } from '@texuli/spec';
import { validateWorkflowGraph } from '@texuli/spec/workflow';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { legoBlueprint } from '../../examples/src/lego/blueprint.ts';
import Player from '../src/Player.svelte';
import { CATALOG_GROUPS } from './catalog-groups.ts';

/**
 * The lego golden: one JSON interface that composes texuli layouts, a data
 * board, charts, media, content blocks, a sortable palette and outline, and
 * a workflow editor. Every move between pieces goes through `reorder`,
 * bindings and closed actions only, and lands in the declared state.
 */

const SPEC = join(import.meta.dirname, '../../spec');
const read = (path: string): unknown => JSON.parse(readFileSync(join(SPEC, path), 'utf8'));
const lego = read('fixtures/golden/lego.json') as Record<string, unknown>;

type Snapshot = Record<string, unknown>;
type Item = { id: string; label?: string; title?: string; column?: string };

function mount() {
  const onAction = vi.fn((_intent: unknown) => 'confirmed' as const);
  const onStateChange = vi.fn((_snapshot: Snapshot) => undefined);
  const errors: string[] = [];
  const result = render(Player, {
    props: {
      blueprint: lego,
      label: 'Lego',
      onAction,
      onStateChange,
      onDiagnostics: (event: {
        diagnostics: readonly { code: string; severity: string; message: string }[];
        stateIssues: readonly { message: string }[];
      }) => {
        for (const d of event.diagnostics)
          if (d.severity === 'error') errors.push(`${d.code} ${d.message}`);
        for (const issue of event.stateIssues) errors.push(`state: ${issue.message}`);
      },
    },
  });
  const last = (name: string) =>
    ((onStateChange.mock.lastCall?.[0] ?? {}) as Record<string, unknown>)[name];
  const list = (name: string) => (last(name) as Item[] | undefined) ?? [];
  const intents = () => onAction.mock.calls.map((call) => (call[0] as { action: string }).action);
  return { ...result, errors, onAction, onStateChange, last, list, intents };
}

/**
 * Keys go to the focused element, as a person's would: a drag refocuses the
 * moved item's handle (the board after a tick), so each key waits for it.
 */
async function press(key: string): Promise<void> {
  await waitFor(() => expect(document.activeElement).not.toBe(document.body));
  await fireEvent.keyDown(document.activeElement as HTMLElement, { key });
  await tick();
}

async function keyboardDrag(handleName: string, keys: readonly string[]): Promise<void> {
  const handle = await screen.findByRole('button', { name: handleName }, { timeout: 5000 });
  handle.focus();
  await press(' ');
  for (const key of keys) await press(key);
  await press(' ');
}

describe('the lego golden', () => {
  it('is the blueprint the lego example paints', () => {
    expect(legoBlueprint).toEqual(lego);
  });

  it('validates on the spec and the catalog validators', async () => {
    const documents = {
      blueprintSchema: read('schemas/blueprint.schema.json'),
      catalog: read('catalog/components.json'),
      workflowSchema: read('schemas/workflow.schema.json'),
      validateWorkflowGraph,
    } as Parameters<typeof validateBlueprint>[1];
    expect(validateBlueprint(lego, documents).diagnostics).toEqual([]);
    const catalog = renderCatalogFromBuild((await buildCatalog(CATALOG_GROUPS)).catalog);
    const draft = validateDraft(lego, { catalog, tier: 'untrusted' });
    expect(draft.diagnostics).toEqual([]);
    expect(draft.ok).toBe(true);
  });

  it('paints every piece from the one tree', { timeout: 30_000 }, async () => {
    const { container, errors } = mount();
    expect(await screen.findByText('Acme Rentals', {}, { timeout: 10_000 })).toBeTruthy();
    await expect
      .poll(() => container.querySelector('[data-tx-player-skeleton]'), { timeout: 15_000 })
      .toBeNull();
    expect(errors).toEqual([]);
    expect(container.querySelector('[data-tx-player-error]')).toBeNull();
    expect(screen.queryByText(/could not be shown/)).toBeNull();
    // Layouts, board, charts, media, blocks, lists and the workflow editor.
    expect(screen.getByRole('heading', { name: 'Launch workspace' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Drag Acme Rentals' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /A product dashboard/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Introduction' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Heading' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hero image' })).toBeTruthy();
    expect(screen.getAllByText('Write launch copy').length).toBeGreaterThan(0);
    // One drag scope serves both sortable lists.
    expect(container.querySelectorAll('.tx-player-reorder-scope')).toHaveLength(1);
  });

  it('moves a board card between columns into the bound deals and emits deal-moved', {
    timeout: 30_000,
  }, async () => {
    const view = mount();
    await keyboardDrag('Drag Acme Rentals', ['ArrowRight']);
    await waitFor(() =>
      expect(view.list('deals').find((deal) => deal.id === 'd-acme')?.column).toBe('proposal')
    );
    expect(view.list('deals').find((deal) => deal.id === 'd-cedar')?.column).toBe('lead');
    await waitFor(() => expect(view.intents()).toContain('deal-moved'));
  });

  it('copies a palette block into the page outline across cards (pull clone)', {
    timeout: 30_000,
  }, async () => {
    const view = mount();
    // Image is the palette's last item: one step down leaves the palette for the outline.
    await keyboardDrag('Image', ['ArrowDown', 'ArrowDown']);
    await waitFor(() => expect(view.list('outline')).toHaveLength(4));
    expect(view.list('outline').map((item) => item.label)).toContain('Image');
    // The palette keeps its block; the copy has a fresh id.
    expect(view.list('palette').map((item) => item.id)).toEqual([
      'b-heading',
      'b-chart',
      'b-image',
    ]);
    const copy = view.list('outline').find((item) => item.label === 'Image');
    expect(copy?.id).not.toBe('b-image');
    expect(copy?.id).toMatch(/^b-image-\d+$/);
  });

  it('reorders the outline blocks and runs its on.move', { timeout: 30_000 }, async () => {
    const view = mount();
    await keyboardDrag('Introduction', ['ArrowDown']);
    await waitFor(() =>
      expect(view.list('outline').map((item) => item.id)).toEqual([
        'o-metrics',
        'o-intro',
        'o-hero',
      ])
    );
    expect(view.onAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'outline-changed', values: { page: 'launch' } })
    );
  });

  it('refuses what the group rules refuse: the outline never pours into the palette', {
    timeout: 30_000,
  }, async () => {
    const view = mount();
    await screen.findByRole('button', { name: 'Introduction' }, { timeout: 5000 });
    // Up past the outline's top edge would land in the palette, which accepts no group.
    await keyboardDrag('Introduction', ['ArrowUp']);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(view.onStateChange).not.toHaveBeenCalled();
    expect(view.intents()).toEqual([]);
  });

  it('adds a palette node type to the workflow canvas, into the bound workflow', {
    timeout: 30_000,
  }, async () => {
    const view = mount();
    const add = await screen.findByRole('button', { name: 'Add Task' }, { timeout: 10_000 });
    await fireEvent.click(add);
    await waitFor(() =>
      expect((view.last('launch') as { nodes: unknown[] } | undefined)?.nodes).toHaveLength(4)
    );
    const graph = view.last('launch') as { nodes: { type: string }[]; edges: unknown[] };
    expect(graph.nodes.filter((node) => node.type === 'task')).toHaveLength(2);
    expect(graph.edges).toHaveLength(2);
    expect(view.intents()).toContain('workflow-changed');
  });
});
