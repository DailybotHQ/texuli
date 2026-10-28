/**
 * /workflows-page/json/ — the JSON live preview. Every seed is checked
 * through `checkBlueprintText`, the function the island runs before it
 * paints; the default seed is painted by the real `<Player>` to prove its
 * spec 0.3.0 features (state, bindings, on-actions, drag as data, workflow
 * graph) paint today. Static checks keep the page sink-free.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { PLAYER_LOADERS, Player } from '@texuli/player';
import { describe, expect, it, vi } from 'vitest';
import JsonPreviewApp from '../src/components/workflows-site/json/JsonPreviewApp.svelte';
import {
  lineColumnAt,
  lineCount,
  parseJsonText,
  statusText,
  toJsonPath,
} from '../src/components/workflows-site/json/model.ts';
import { playerDiagnostics } from '../src/components/workflows-site/json/player-issues.ts';
import {
  DEFAULT_SEED_ID,
  JSON_SEEDS,
  seedById,
  seedText,
} from '../src/components/workflows-site/json/seeds.ts';
import { checkBlueprintText } from '../src/components/workflows-site/json/validate.ts';

const siteRoot = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(siteRoot, path), 'utf8');

describe('JSON live preview seeds', () => {
  it('validates every valid seed with zero diagnostics through the island check', () => {
    const valid = JSON_SEEDS.filter((seed) => seed.valid);
    expect(valid.length).toBeGreaterThanOrEqual(3);
    for (const seed of valid) {
      const check = checkBlueprintText(seedText(seed));
      expect({ id: seed.id, ok: check.ok, diagnostics: check.diagnostics }).toEqual({
        id: seed.id,
        ok: true,
        diagnostics: [],
      });
      expect(check.root).toBe('envelope');
    }
  });

  it('refuses the invalid seed with the expected codes at their JSON paths', () => {
    const broken = JSON_SEEDS.find((seed) => !seed.valid);
    if (!broken) throw new Error('no invalid seed');
    const check = checkBlueprintText(seedText(broken));
    expect(check.ok).toBe(false);
    const found = check.diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => `${d.code} ${d.path}`)
      .sort();
    expect(found).toEqual([
      'unknown-event $.tree.children[2].on.press',
      'unknown-id $.tree.children[0]',
      'unknown-state $.tree.children[1].props.title',
    ]);
    for (const d of check.diagnostics) expect(d.message.length).toBeGreaterThan(0);
  });

  it('has unique ids and labels, a default that exists and uses the 0.3.0 features', () => {
    expect(new Set(JSON_SEEDS.map((s) => s.id)).size).toBe(JSON_SEEDS.length);
    expect(new Set(JSON_SEEDS.map((s) => s.label)).size).toBe(JSON_SEEDS.length);
    const text = seedText(seedById(DEFAULT_SEED_ID) ?? JSON_SEEDS[0]!);
    for (const feature of [
      '"spec": "0.3.0"',
      '"type": "list"',
      '"$state": "priorities"',
      '"reorder"',
      '"on"',
      '"op": "setState"',
      '"sortable-list"',
      '"workflow-graph"',
      '"control-toggle"',
    ]) {
      expect(text).toContain(feature);
    }
    // Fictional data only: every URL is on example.com.
    for (const seed of JSON_SEEDS) {
      for (const url of seedText(seed).match(/https?:\/\/[^"\s]+/g) ?? []) {
        expect(new URL(url).hostname).toMatch(/(^|\.)example\.com$/);
      }
    }
  });
});

describe('JSON live preview model', () => {
  it('reports a parse error with its line and column at $, and never paints it', () => {
    const text = '{\n  "id": "layout-page",,\n}';
    const parsed = parseJsonText(text);
    expect(parsed.ok).toBe(false);
    const check = checkBlueprintText(text);
    expect(check.ok).toBe(false);
    expect(check.value).toBeUndefined();
    expect(check.diagnostics).toHaveLength(1);
    expect(check.diagnostics[0]).toMatchObject({ code: 'bad-json', path: '$', source: 'json' });
    expect(check.diagnostics[0]?.message).toMatch(/^Line 2, column 23: /);
    expect(checkBlueprintText('').diagnostics[0]?.code).toBe('bad-json');
  });

  it('maps validator and player paths to JSON paths for each root kind', () => {
    const cases: [string, Parameters<typeof toJsonPath>[1], string][] = [
      ['', 'envelope', '$'],
      ['$.status', 'envelope', '$.status'],
      ['state.tasks', 'envelope', '$.state.tasks'],
      ['0', 'envelope', '$.tree'],
      ['0.children.1.props.title', 'envelope', '$.tree.children[1].props.title'],
      ['0.children.2.on.move[0]', 'envelope', '$.tree.children[2].on.move[0]'],
      ['0.children.0.props.items.3', 'tree', '$.children[0].props.items[3]'],
      ['1.props.label', 'array', '$[1].props.label'],
    ];
    for (const [raw, root, expected] of cases) expect(toJsonPath(raw, root)).toBe(expected);
  });

  it('counts lines, locates offsets and words the status', () => {
    expect([lineCount(''), lineCount('a\nb'), lineCount('a\nb\n')]).toEqual([1, 2, 3]);
    expect(lineColumnAt('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
    expect(statusText({ kind: 'refused', errors: 1 })).toBe('Not rendered: 1 problem.');
    expect(statusText({ kind: 'refused', errors: 3 })).toBe('Not rendered: 3 problems.');
    expect(statusText({ kind: 'painted', warnings: 0 })).toMatch(/^Rendered/);
  });

  it('lists the player report as diagnostics with JSON paths', () => {
    const rows = playerDiagnostics(
      {
        status: 'invalid',
        surface: 'notice',
        error: 'invalid',
        diagnostics: [],
        receipt: null,
        stateIssues: [{ code: 'unknown-state', path: '0.children.1.props.title', message: 'x' }],
      },
      [{ code: 'no-loader', id: 'x', path: '0.children.0', phase: 'load' }],
      'envelope'
    );
    expect(rows.map((r) => `${r.source} ${r.code} ${r.path}`)).toEqual([
      'player unknown-state $.tree.children[1].props.title',
      'player no-loader $.tree.children[0]',
    ]);
  });
});

describe('the default seed paints through the player', () => {
  it('paints the sortable list, the workflow graph and runs on.change actions', async () => {
    const seed = seedById(DEFAULT_SEED_ID);
    if (!seed) throw new Error('no default seed');
    const onDiagnostics = vi.fn();
    const onNodeError = vi.fn();
    const onStateChange = vi.fn();
    const { container } = render(Player, {
      props: {
        blueprint: checkBlueprintText(seedText(seed)).value,
        tier: 'untrusted',
        invalidPolicy: 'refuse',
        label: 'JSON live preview (untrusted)',
        landmarks: false,
        loaders: PLAYER_LOADERS,
        onDiagnostics,
        onNodeError,
        onStateChange,
      },
    });
    expect(await screen.findByText('Faster search', {}, { timeout: 8000 })).toBeTruthy();
    expect(
      await screen.findByRole('figure', { name: 'Release pipeline' }, { timeout: 8000 })
    ).toBeTruthy();
    expect(screen.getByText('Priorities (not reviewed)')).toBeTruthy();
    expect(container.querySelector('[data-tx-player-error]')).toBeNull();
    expect(onNodeError).not.toHaveBeenCalled();
    const last = onDiagnostics.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ surface: 'tree', stateIssues: [] });

    // The toggle writes its variable, and its on.change runs the closed setState action.
    await fireEvent.click(screen.getByRole('switch', { name: 'Show the release pipeline' }));
    await waitFor(() =>
      expect(onStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ showPipeline: false, review: 'Priorities (pipeline checked)' })
      )
    );
    // The `when` condition hides the pipeline card once the toggle is off.
    await waitFor(() =>
      expect(screen.queryByRole('figure', { name: 'Release pipeline' })).toBeNull()
    );
  }, 20000);
});

describe('the island', () => {
  it('paints the default seed, clears on a parse error, and lists a seed error by path', async () => {
    const { container } = render(JsonPreviewApp);
    const status = () => container.querySelector('[data-json-preview-status]')?.textContent?.trim();
    await waitFor(() => expect(status()).toBe('Rendered: the blueprint passed validation.'), {
      timeout: 8000,
    });
    expect(await screen.findByText('Faster search', {}, { timeout: 8000 })).toBeTruthy();
    const editor = screen.getByLabelText('Blueprint JSON') as HTMLTextAreaElement;
    expect(container.querySelector('[data-json-preview-lines]')?.textContent?.trim()).toMatch(
      /^\d+ lines$/
    );

    // Bad JSON: after the debounce the preview is cleared and the status says why.
    await fireEvent.input(editor, { target: { value: '{ "id": ' } });
    await waitFor(() => expect(status()).toBe('Not rendered: 1 problem.'));
    expect(container.querySelector('[data-json-preview-cleared]')).toBeTruthy();
    expect(screen.queryByText('Faster search')).toBeNull();
    const rows = () => [...container.querySelectorAll('[data-json-preview-diagnostics] li')];
    expect(rows().map((li) => li.getAttribute('data-code'))).toEqual(['bad-json']);

    // The invalid seed: every error is listed with its JSON path, and nothing paints.
    const select = screen.getByLabelText('Example') as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: 'broken' } });
    await waitFor(() => expect(status()).toBe('Not rendered: 3 problems.'));
    expect(rows().map((li) => li.querySelector('.json-preview__path code')?.textContent)).toContain(
      '$.tree.children[0]'
    );
    expect(container.querySelector('.tx-player')).toBeNull();
  }, 20000);
});

describe('the /workflows-page/json/ page', () => {
  const page = read('src/pages/workflows-page/json/index.astro');
  const island = read('src/components/workflows-site/json/JsonPreviewApp.svelte');
  const preview = read('src/components/workflows-site/json/PreviewPlayer.svelte');

  it('uses BaseLayout, one h1, the eyebrow and a visible-mounted island', () => {
    expect(page).toContain('<BaseLayout');
    expect(page).toContain('title="JSON live preview"');
    expect(page.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(page).toContain('@texuli/player · spec 0.3.0');
    expect(page).toContain('<JsonPreviewApp client:visible />');
    const copy = page.replace(/\s+/g, ' ');
    expect(copy).toContain('<code>@texuli/workflows</code>');
    expect(copy).toContain('is in development and on npm as <code>0.4.0</code>');
    expect(copy).toContain("painter that uses it ships in the player's <code>0.4.0</code> release");
    expect(copy).not.toMatch(/workflows<\/code>.{0,120}not (?:yet )?on npm/);
  });

  it('has no HTML sinks, refuses invalid drafts, paints untrusted and loads the player lazily', () => {
    for (const source of [page, island, preview]) {
      expect(source).not.toMatch(/set:html|\{@html|innerHTML|eval\(|new Function/);
    }
    expect(preview).toContain('invalidPolicy="refuse"');
    expect(preview).toContain('tier={PREVIEW_TIER}');
    expect(read('src/components/workflows-site/json/validate.ts')).toContain(
      "PREVIEW_TIER = 'untrusted'"
    );
    // The island imports the validator and the player only dynamically.
    expect(island).not.toMatch(/^import (?!type)[^\n]*from '(@texuli\/player|\.\/validate\.ts)'/m);
    expect(island).toContain("import('./validate.ts')");
    expect(island).toContain("import('./PreviewPlayer.svelte')");
    // Accessible list and polite status.
    expect(island).toMatch(/role="status"\s+aria-live="polite"/);
    expect(island).toContain('<ul class="json-preview__list" aria-labelledby=');
    expect(island).toContain('<label for="json-preview-text">');
  });
});
