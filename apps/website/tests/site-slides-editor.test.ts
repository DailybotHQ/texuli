// @vitest-environment happy-dom
/**
 * /slides-page/ live editors (JSON and deck Markdown). The seeds and checks
 * run through the same functions the island uses; the island itself is
 * rendered to prove it paints valid decks on the embedded stage, clears the
 * preview on invalid input with diagnostics (code, JSON path, line and
 * column), converts between the formats, never touches the page hash, and
 * stays sink-free.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkDeckJson,
  checkDeckMarkdown,
  deckAsJson,
  deckAsMarkdown,
  jsonLocator,
} from '../src/components/slides-site/editor/check.ts';
import DeckEditorApp from '../src/components/slides-site/editor/DeckEditorApp.svelte';
import {
  lineCount,
  offsetOf,
  phaseOf,
  positionText,
  statusText,
  toEditorDiagnostics,
} from '../src/components/slides-site/editor/model.ts';
import {
  BROKEN_JSON_ID,
  BROKEN_MARKDOWN_ID,
  DEFAULT_SEED_ID,
  EDITOR_SEEDS,
  seedById,
  seedText,
} from '../src/components/slides-site/editor/seeds.ts';

const editorDir = join(import.meta.dirname, '..', 'src', 'components', 'slides-site', 'editor');

function mockPreferences(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }) as unknown as MediaQueryList
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deck editor model', () => {
  it('maps engine issues to rows, keeping or locating their position', () => {
    const rows = toEditorDiagnostics(
      [
        {
          code: 'json-syntax',
          severity: 'error',
          message: 'Bad',
          jsonPath: '$',
          source: { line: 3, column: 7 },
        },
        {
          code: 'unknown-layout',
          severity: 'error',
          message: 'No',
          jsonPath: '$.slides[0].layout',
        },
        { code: 'w', severity: 'warning', message: 'Hm', jsonPath: '', fix: 'Do this.' },
      ],
      (path) => (path === '$.slides[0].layout' ? { line: 5, column: 34 } : undefined)
    );
    expect(rows.map((row) => [row.code, row.jsonPath, row.line, row.column])).toEqual([
      ['json-syntax', '$', 3, 7],
      ['unknown-layout', '$.slides[0].layout', 5, 34],
      ['w', '$', undefined, undefined],
    ]);
    expect(rows[2]?.fix).toBe('Do this.');
    expect(new Set(rows.map((row) => row.key)).size).toBe(3);
  });

  it('derives the phase and the status text', () => {
    expect(phaseOf(null)).toEqual({ kind: 'checking' });
    expect(phaseOf({ ok: true, deck: {}, diagnostics: [] })).toEqual({
      kind: 'painted',
      warnings: 0,
    });
    expect(phaseOf({ ok: false, diagnostics: [] })).toEqual({ kind: 'refused', errors: 1 });
    expect(statusText({ kind: 'refused', errors: 2 }, 'markdown')).toBe(
      'The Markdown deck has 2 errors: nothing is painted.'
    );
    expect(statusText({ kind: 'painted', warnings: 1 }, 'json')).toMatch(/with 1 warning\.$/);
    expect(statusText({ kind: 'failed' }, 'json')).toMatch(/could not be loaded/);
  });

  it('counts lines and finds offsets for "Go to"', () => {
    expect(lineCount('')).toBe(1);
    expect(lineCount('a\nb\nc')).toBe(3);
    expect(offsetOf('ab\ncd\nef', 3, 2)).toBe(7);
    expect(offsetOf('ab', 9, 1)).toBe(2);
    expect(positionText({ line: 2, column: 4 })).toBe('line 2, column 4');
    expect(positionText({})).toBe('');
  });
});

describe('deck editor seeds and checks', () => {
  const valid = EDITOR_SEEDS.filter((seed) => seed.valid);

  it('offers every starter template plus the broken examples', () => {
    expect(valid.length).toBeGreaterThanOrEqual(9);
    expect(seedById(DEFAULT_SEED_ID)?.valid).toBe(true);
    expect(seedById(BROKEN_JSON_ID)?.valid).toBe(false);
    expect(seedById(BROKEN_MARKDOWN_ID)?.valid).toBe(false);
  });

  it.each(valid.map((seed) => seed.id))(
    '%s checks clean as JSON and as Markdown, to the same deck',
    (id) => {
      const seed = seedById(id);
      if (!seed) throw new Error(id);
      const json = checkDeckJson(seedText(seed, 'json'));
      const markdown = checkDeckMarkdown(seedText(seed, 'markdown'));
      expect(json.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(markdown.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(json.ok && markdown.ok).toBe(true);
      expect(markdown.deck).toEqual(json.deck);
    }
  );

  it('reports JSON syntax errors with line and column', () => {
    const seed = seedById(BROKEN_JSON_ID);
    if (!seed) throw new Error('seed');
    const check = checkDeckJson(seedText(seed, 'json'));
    expect(check.ok).toBe(false);
    expect(check.diagnostics[0]).toMatchObject({ severity: 'error', line: 8 });
    expect(check.diagnostics[0]?.column).toBeGreaterThan(0);
  });

  it('locates model issues in the JSON text by their path', () => {
    const text = [
      '{',
      '  "formatVersion": 2,',
      '  "meta": { "title": "T" },',
      '  "slides": [',
      '    { "id": "cover", "layout": "mosaic", "props": {} },',
      '    { "id": "cover", "layout": "free", "blocks": [{ "type": "text", "markdown": "x" }] }',
      '  ]',
      '}',
    ].join('\n');
    const check = checkDeckJson(text);
    expect(check.ok).toBe(false);
    const layout = check.diagnostics.find((d) => d.jsonPath === '$.slides[0].layout');
    expect(layout).toMatchObject({ line: 5, column: 32 });
    const duplicate = check.diagnostics.find((d) => d.code === 'duplicate-id');
    expect(duplicate).toMatchObject({ jsonPath: '$.slides[1].id', line: 6 });
    expect(jsonLocator('{ "a": [1, { "b": 2 }] }')('$.a[1].b.c')).toEqual({ line: 1, column: 19 });
    expect(jsonLocator('{ broken')('$.a')).toBeUndefined();
  });

  it('reports Markdown refusals with their source line and column', () => {
    const seed = seedById(BROKEN_MARKDOWN_ID);
    if (!seed) throw new Error('seed');
    const check = checkDeckMarkdown(seedText(seed, 'markdown'));
    expect(check.ok).toBe(false);
    const codes = check.diagnostics.map((d) => [d.code, d.line]);
    expect(codes).toEqual(
      expect.arrayContaining([
        ['md-html-refused', 7],
        ['md-iframe-refused', 11],
      ])
    );
  });

  it('converts a valid deck both ways through the engine', () => {
    const seed = seedById(DEFAULT_SEED_ID);
    if (!seed) throw new Error('seed');
    const json = checkDeckJson(seedText(seed, 'json'));
    const markdown = deckAsMarkdown(json.deck);
    expect(markdown.warnings).toEqual([]);
    const back = checkDeckMarkdown(markdown.markdown);
    expect(back.ok).toBe(true);
    expect(back.deck).toEqual(json.deck);
    expect(checkDeckJson(deckAsJson(back.deck)).deck).toEqual(json.deck);
  });

  it('refuses hostile input without painting it', () => {
    for (const text of [
      '{"formatVersion":2,"meta":{"title":"x"},"slides":[{"id":"a","layout":"free","blocks":[{"type":"image","src":"javascript:alert(1)","alt":"x"}]}]}',
      '{"__proto__":{"polluted":true}}',
      `${'['.repeat(5_000)}`,
    ]) {
      expect(checkDeckJson(text).ok).toBe(false);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(checkDeckMarkdown('# x\n\n<script>alert(1)</script>').ok).toBe(false);
  });
});

describe('deck editor island', () => {
  it('paints, clears on invalid input, switches tabs by keyboard, converts, and never touches the hash', async () => {
    mockPreferences();
    window.history.replaceState(null, '', '/slides-page/#editor');
    const { container } = render(DeckEditorApp, { props: {} });
    const root = container.querySelector('[data-deck-editor]');
    expect(root).toBeTruthy();
    const status = () => container.querySelector<HTMLElement>('[data-deck-editor-status]');
    const preview = () => container.querySelector<HTMLElement>('[data-deck-editor-preview]');

    await waitFor(() => expect(status()?.dataset.phase).toBe('painted'), { timeout: 15_000 });
    await waitFor(
      () => expect(preview()?.querySelector('[aria-roledescription="slide"]')).toBeTruthy(),
      {
        timeout: 15_000,
      }
    );

    // Invalid JSON clears the preview and lists the syntax error with its position.
    const json = container.querySelector<HTMLTextAreaElement>('[data-deck-editor-input="json"]');
    if (!json) throw new Error('json textarea');
    await fireEvent.input(json, { target: { value: '{ "formatVersion": 2, ' } });
    await waitFor(() => expect(status()?.dataset.phase).toBe('refused'), { timeout: 5_000 });
    expect(container.querySelector('[data-deck-editor-cleared]')).toBeTruthy();
    expect(preview()?.querySelector('[aria-roledescription="slide"]')).toBeNull();
    const item = container.querySelector<HTMLElement>('[data-deck-editor-diagnostics] li');
    expect(item?.dataset.code).toBeTruthy();
    expect(item?.dataset.line).toBe('1');
    expect(item?.dataset.jsonPath).toBe('$');
    // "Go to" moves the caret to the problem.
    const goto = item?.querySelector<HTMLButtonElement>('button');
    await fireEvent.click(goto as HTMLButtonElement);
    expect(document.activeElement).toBe(json);
    // Convert is off while the deck is invalid.
    expect(container.querySelector<HTMLButtonElement>('[data-deck-editor-convert]')?.disabled).toBe(
      true
    );

    // Arrow keys move to the Markdown tab, whose seed text paints.
    const jsonTab = container.querySelector<HTMLButtonElement>('[data-deck-editor-tab="json"]');
    await fireEvent.keyDown(jsonTab as HTMLButtonElement, { key: 'ArrowRight' });
    const markdownTab = container.querySelector<HTMLButtonElement>(
      '[data-deck-editor-tab="markdown"]'
    );
    expect(markdownTab?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(markdownTab);
    await waitFor(() => expect(status()?.dataset.phase).toBe('painted'), { timeout: 15_000 });

    // Convert writes the deck as JSON and switches back.
    const convert = container.querySelector<HTMLButtonElement>('[data-deck-editor-convert]');
    expect(convert?.disabled).toBe(false);
    await fireEvent.click(convert as HTMLButtonElement);
    expect(jsonTab?.getAttribute('aria-selected')).toBe('true');
    expect(json.value).toMatch(/^\{\n {2}"formatVersion": 2,/);
    await waitFor(() => expect(status()?.dataset.phase).toBe('painted'), { timeout: 15_000 });
    expect(container.querySelector('[data-deck-editor-convert-note]')?.textContent).toBe(
      'Converted to JSON.'
    );

    // A broken example selects its tab and refuses.
    const seed = container.querySelector<HTMLSelectElement>('[data-deck-editor-seed]');
    await fireEvent.change(seed as HTMLSelectElement, { target: { value: BROKEN_MARKDOWN_ID } });
    await waitFor(() => expect(status()?.dataset.phase).toBe('refused'), { timeout: 5_000 });
    expect(markdownTab?.getAttribute('aria-selected')).toBe('true');
    const codes = [
      ...container.querySelectorAll<HTMLElement>('[data-deck-editor-diagnostics] li'),
    ].map((row) => row.dataset.code);
    expect(codes).toContain('md-html-refused');

    expect(window.location.hash).toBe('#editor');
  });

  it('stays sink-free and CSP-safe', () => {
    for (const file of readdirSync(editorDir)) {
      const source = readFileSync(join(editorDir, file), 'utf8');
      expect(source, file).not.toMatch(
        /\{@html|innerHTML|outerHTML|insertAdjacentHTML|new Function|\beval\(/
      );
      expect(source, file).not.toMatch(/\son[a-z]+="/);
      expect(source, file).not.toMatch(/https?:\/\/(?!example\.com)[a-z]/);
    }
  });
});
