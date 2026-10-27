import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { buildCatalog } from '@texuli/catalog/build';
import { formulaConditions } from '@texuli/catalog/render/conditions';
import { renderCatalogFromBuild } from '@texuli/catalog/render/renderer';
import { validateDraft } from '@texuli/catalog/validate';
import { canonicalJson, sha256, validateBlueprint } from '@texuli/spec';
import { validateWorkflowGraph } from '@texuli/spec/workflow';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Player from '../src/Player.svelte';
import { CATALOG_GROUPS } from './catalog-groups.ts';

/**
 * The spec golden blueprints are complete JSON interfaces. Each one validates
 * on the spec validator and the catalog's untrusted-tier validator, hashes
 * stably, and paints in the Player (happy-dom) with no placeholder, no node
 * error and no diagnostic. The interactive goldens also run their closed
 * actions.
 */

const SPEC = join(import.meta.dirname, '../../spec');
const GOLDEN = join(SPEC, 'fixtures/golden');
const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const documents = {
  blueprintSchema: read(join(SPEC, 'schemas/blueprint.schema.json')),
  catalog: read(join(SPEC, 'catalog/components.json')),
  workflowSchema: read(join(SPEC, 'schemas/workflow.schema.json')),
  validateWorkflowGraph,
} as Parameters<typeof validateBlueprint>[1];
const catalog = renderCatalogFromBuild((await buildCatalog(CATALOG_GROUPS)).catalog);
const files = readdirSync(GOLDEN)
  .filter((file) => file.endsWith('.json'))
  .sort();
const golden = (name: string) => read(join(GOLDEN, `${name}.json`)) as Record<string, unknown>;

/** Paints a golden and collects every error diagnostic and state issue. */
function paint(blueprint: unknown, props: Record<string, unknown> = {}) {
  const errors: string[] = [];
  const result = render(Player, {
    props: {
      blueprint,
      label: 'Golden',
      onDiagnostics: (event: {
        diagnostics: readonly { code: string; severity: string; message: string }[];
        stateIssues: readonly { message: string }[];
      }) => {
        for (const d of event.diagnostics)
          if (d.severity === 'error') errors.push(`${d.code} ${d.message}`);
        for (const issue of event.stateIssues) errors.push(`state: ${issue.message}`);
      },
      ...props,
    },
  });
  return { ...result, errors };
}

/** The same value with every object's keys in reverse order. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, entry]) => [key, reverseKeys(entry)])
  );
}

async function painted(container: HTMLElement): Promise<void> {
  await expect
    .poll(() => container.querySelector('[data-tx-player-skeleton]'), { timeout: 15_000 })
    .toBeNull();
  expect(container.querySelector('[data-tx-player-error]')).toBeNull();
  expect(container.querySelector('[data-status="invalid"]')).toBeNull();
  expect(screen.queryByText(/could not be shown/)).toBeNull();
}

describe('the spec goldens', () => {
  it('include the PLAN_007 interfaces', () => {
    for (const name of ['app-dashboard', 'mobile-flow', 'sortable-board', 'workflow-builder'])
      expect(files).toContain(`${name}.json`);
  });

  for (const file of files) {
    describe(file, () => {
      const envelope = read(join(GOLDEN, file));

      it('validates on the spec and catalog validators and hashes stably', () => {
        expect(validateBlueprint(envelope, documents).diagnostics).toEqual([]);
        const draft = validateDraft(envelope, {
          catalog,
          tier: 'untrusted',
          conditions: formulaConditions,
          conditionInputs: { closed: 38, blocked: 2 },
        });
        expect(draft.ok).toBe(true);
        expect(draft.diagnostics).toEqual([]);
        const hash = sha256(canonicalJson(envelope));
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        // Key order and whitespace do not move the hash; content does.
        expect(sha256(canonicalJson(reverseKeys(envelope)))).toBe(hash);
        expect(sha256(canonicalJson(read(join(GOLDEN, file))))).toBe(hash);
        expect(sha256(canonicalJson({ ...(envelope as object), id: 'changed' }))).not.toBe(hash);
      });

      it('paints with no placeholder and no error', { timeout: 30_000 }, async () => {
        const { container, errors } = paint(envelope);
        await painted(container);
        expect(errors).toEqual([]);
      });
    });
  }
});

describe('the interactive goldens run their closed actions', () => {
  it('app-dashboard: the filters set state and emit one closed intent', {
    timeout: 30_000,
  }, async () => {
    const onAction = vi.fn((_intent: unknown) => 'confirmed' as const);
    const onStateChange = vi.fn();
    const { container } = paint(golden('app-dashboard'), { onAction, onStateChange });
    await painted(container);
    expect(screen.getByRole('heading', { name: 'Revenue operations, week 43' })).toBeTruthy();
    expect(screen.getByText('Acme Rentals')).toBeTruthy();
    await fireEvent.click(screen.getByRole('switch', { name: 'Renewals only' }));
    await waitFor(() => expect(onAction).toHaveBeenCalled());
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: 'filter-accounts',
      values: { region: 'all', search: '', renewalsOnly: true },
    });
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ renewalsOnly: true }));
  });

  it('mobile-flow: flow events walk the views and the form submits', {
    timeout: 30_000,
  }, async () => {
    const onAction = vi.fn((_intent: unknown) => 'confirmed' as const);
    const { container } = paint(golden('mobile-flow'), { onAction });
    await painted(container);
    await fireEvent.click(screen.getByRole('button', { name: 'Start sign-up' }));
    const name = await screen.findByLabelText(/Full name/, {}, { timeout: 5000 });
    await fireEvent.input(name, { target: { value: 'Ada Example' } });
    await fireEvent.input(screen.getByLabelText(/Email/), {
      target: { value: 'ada@example.com' },
    });
    // The details form proposes save-details; once confirmed, on.submit fires flowGo next.
    await fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    const reserve = await screen.findByRole('button', { name: 'Reserve seats' }, { timeout: 5000 });
    expect(screen.queryByRole('button', { name: 'Start sign-up' })).toBeNull();
    // The confirm view reads the same state: the fields keep their values.
    expect((screen.getByLabelText(/Email/) as HTMLInputElement).value).toBe('ada@example.com');
    await fireEvent.click(reserve);
    expect(await screen.findByText('Reserved', {}, { timeout: 5000 })).toBeTruthy();
    expect(onAction.mock.calls.map((call) => (call[0] as { action: string }).action)).toEqual([
      'save-details',
      'reserve-seats',
      'workshop-reserved',
    ]);
    expect(onAction.mock.calls[2]?.[0]).toMatchObject({
      values: { email: 'ada@example.com', seats: 1, reminders: true },
    });
  });

  it('sortable-board: keyboard drags cross lists through the shared scope, under the group rules', {
    timeout: 30_000,
  }, async () => {
    const onAction = vi.fn((_intent: unknown) => 'confirmed' as const);
    const onStateChange = vi.fn();
    const { container } = paint(golden('sortable-board'), { onAction, onStateChange });
    await painted(container);
    const ids = (name: string) =>
      ((onStateChange.mock.lastCall?.[0] ?? {}) as Record<string, { id: string }[]>)[name]?.map(
        (item) => item.id
      );
    // Keys go to the focused handle, as a person's would: the scope refocuses the
    // dragged item's handle when the in-place preview moves it to another list.
    const press = async (key: string) => {
      await waitFor(() => expect(document.activeElement).not.toBe(document.body));
      await fireEvent.keyDown(document.activeElement as HTMLElement, { key });
      await tick();
    };
    const drag = async (label: string, steps: number) => {
      const handle = await screen.findByRole('button', { name: label }, { timeout: 5000 });
      handle.focus();
      await press(' ');
      for (let i = 0; i < steps; i += 1) await press('ArrowDown');
      await press(' ');
    };

    // Templates (pull clone) → Backlog (accepts templates): a copy with a fresh id lands after
    // the locked card (locked items keep their index), and the template stays.
    await drag('Bug report', 2);
    await waitFor(() =>
      expect(ids('backlog')).toEqual(['t-legal', 'tpl-bug-2', 't-export', 't-search'])
    );
    expect(ids('templates')).toEqual(['tpl-bug', 'tpl-spike']);
    expect(onAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'card-moved',
        values: { board: 'sprint-44', list: 'Templates' },
      })
    );

    // Backlog → Doing (same group): the last backlog card moves past the edge into Doing.
    await drag('Search across projects', 1);
    await waitFor(() => expect(ids('doing')).toEqual(['t-search', 't-sso']));
    expect(ids('backlog')).toEqual(['t-legal', 'tpl-bug-2', 't-export']);
    expect(await screen.findByRole('button', { name: 'Search across projects' })).toBeTruthy();

    // A locked card never leaves, so nothing changes and no intent is emitted.
    const calls = onStateChange.mock.calls.length;
    await drag('Legal review of terms', 3);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onStateChange.mock.calls.length).toBe(calls);
    expect(ids('backlog')).toContain('t-legal');
  });

  it('workflow-builder: the editor and the bound preview paint one graph', {
    timeout: 30_000,
  }, async () => {
    const { container } = paint(golden('workflow-builder'));
    await painted(container);
    expect(screen.getByRole('figure', { name: 'Expense approval preview' })).toBeTruthy();
    expect(screen.getAllByText('Manager approval').length).toBeGreaterThanOrEqual(2);
  });
});
