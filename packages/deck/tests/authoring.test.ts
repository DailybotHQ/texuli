// @vitest-environment node
/// <reference types="node" />
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyDeckPatch,
  DECK_LINT_MAX_ISSUES,
  DECK_OUTLINE_IDS,
  DECK_OUTLINES,
  type DeckLintIssue,
  deck,
  generateDeckFromBrief,
  lintDeck,
  selectDeckLayouts,
  slide,
} from '../src/authoring/index.ts';
import { deckToMarkdown, parseDeckMarkdown } from '../src/markdown/index.ts';
import { parseDeck } from '../src/model/index.ts';
import { createDeckTemplate, DECK_TEMPLATES } from '../src/templates/index.ts';

const decksPath = resolve(import.meta.dirname, '../decks');

describe('typed builders and deterministic brief outlines', () => {
  it('builds a validated catalog slide and refuses invalid model data', () => {
    const built = deck({ title: 'A fictional pitch', locale: 'en' })
      .slide(
        slide.titleHero(
          { title: 'A clear opening' },
          { id: 'opening', notes: 'A unique note with enough detail for a presenter.' }
        )
      )
      .build();
    expect(built.ok).toBe(true);
    if (built.ok)
      expect(built.deck.slides[0]).toMatchObject({ id: 'opening', layout: 'title-hero' });

    const invalid = deck({ title: '' })
      .slide(slide.free({ id: 'bad', blocks: [] }))
      .build();
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.diagnostics.length).toBeGreaterThan(0);

    const freeAndComponent = deck({ title: 'Mixed slide kinds' })
      .slide(
        slide.free({ id: 'free-content', blocks: [{ type: 'text', markdown: 'Draft copy.' }] })
      )
      .slide(slide.component('chart', { title: 'Quarterly measure' }, { id: 'chart-component' }))
      .build();
    expect(freeAndComponent.ok).toBe(true);
  });

  it('includes all eight outline IDs and generates byte-stable decks without invented evidence', () => {
    expect(DECK_OUTLINES.map((item) => item.id)).toEqual(DECK_OUTLINE_IDS);
    for (const outline of DECK_OUTLINE_IDS) {
      const first = generateDeckFromBrief({
        outline,
        brief: 'A fictional project brief with no sourced metrics.',
      });
      const again = generateDeckFromBrief({
        outline,
        brief: 'A fictional project brief with no sourced metrics.',
      });
      expect(JSON.stringify(first.deck)).toBe(JSON.stringify(again.deck));
      expect(parseDeck(first.deck).ok).toBe(true);
      expect(
        first.deck.slides.every((item) => Boolean(item.notes?.includes('Draft guidance:')))
      ).toBe(true);
    }
  });

  it('honors explicit layout overrides and avoids a third repeated automatic layout', () => {
    const selected = selectDeckLayouts([
      { id: 'a', role: 'metrics', pacing: 'punch' },
      { id: 'b', role: 'metrics', pacing: 'punch' },
      { id: 'c', role: 'metrics', pacing: 'punch' },
      { id: 'd', role: 'anything', pacing: 'idea', layout: 'quote' },
    ]);
    expect(selected[2]?.layout).not.toBe(selected[1]?.layout);
    expect(selected[3]).toMatchObject({ layout: 'quote', override: true });
  });

  it('creates the report, pitch, review, and outline templates as validated decks', () => {
    expect(DECK_TEMPLATES.map(({ id }) => id)).toContain('review');
    for (const template of DECK_TEMPLATES)
      expect(parseDeck(createDeckTemplate(template.id)).ok).toBe(true);
  });
});

describe('static quality lint', () => {
  it('reports structural, image, note, and step findings with actionable paths', () => {
    const report = lintDeck({
      formatVersion: 2,
      meta: { title: 'Lint fixture' },
      slides: [
        { id: 'one', layout: 'missing-layout', props: {} },
        {
          id: 'two',
          layout: 'image-centered',
          props: {
            title: 'Image',
            image: { src: 'https://example.com/a.webp', width: 500, height: 400 },
          },
          steps: ['unused'],
        },
      ],
    });
    expect(report.ok).toBe(false);
    expect(report.issues.map(({ rule }) => rule)).toEqual(
      expect.arrayContaining(['unknown-layout', 'image-alt', 'empty-steps', 'notes-missing'])
    );
    expect(
      report.issues.every(
        ({ jsonPath, pointer }) => jsonPath.startsWith('$') && pointer.startsWith('/')
      )
    ).toBe(true);
  });

  it('covers quality warnings and step ordering across free and custom slides', () => {
    const repeatedNotes =
      'Presenter guidance: explain the evidence and invite questions from the audience.';
    const report = lintDeck({
      formatVersion: 2,
      meta: { title: 'Quality fixture' },
      slides: [
        {
          id: 'one',
          layout: 'free',
          background: 'not-a-preset',
          notes: repeatedNotes,
          steps: ['unused'],
          blocks: [
            { type: 'image', src: 'https://example.com/chart.webp' },
            { type: 'chart', title: 'A chart block' },
          ],
        },
        {
          id: 'two',
          layout: 'free',
          notes: repeatedNotes,
          blocks: [
            { type: 'text', markdown: 'First item.', step: 2 },
            { type: 'text', markdown: 'Second item.', step: 1 },
          ],
        },
        {
          id: 'three',
          layout: 'free',
          notes: 'Do not read the slide',
          blocks: [{ type: 'text', markdown: `${'word '.repeat(70)}` }],
        },
        { id: 'custom', layout: 'custom', props: { component: 'host-widget' } },
      ],
    });
    const rules = report.issues.map(({ rule }) => rule);
    expect(rules).toEqual(
      expect.arrayContaining([
        'unknown-background',
        'image-alt',
        'image-size',
        'step-order',
        'empty-steps',
        'notes-missing',
        'notes-duplicate',
        'notes-boilerplate',
        'layout-repetition',
        'too-many-words',
        'prefer-layout',
        'custom-slide',
      ])
    );
  });

  const LONG_NOTES = 'Walk through the evidence, then invite questions from the room.';
  const lintOne = (slide: Record<string, unknown>) =>
    lintDeck({
      formatVersion: 2,
      meta: { title: 'Rules' },
      slides: [{ notes: LONG_NOTES, ...slide }],
    }).issues;
  const finding = (issues: DeckLintIssue[], rule: string) =>
    issues.filter((issue) => issue.rule === rule).map((issue) => [issue.jsonPath, issue.message]);

  it('too-many-words counts human text only and points at the wordiest free block', () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
    // Settings never count: chart kinds and series labels as data, ids, widths, URLs, code.
    const settings = lintOne({
      id: 'settings',
      layout: 'free',
      blocks: [
        { type: 'heading', level: 2, text: 'Revenue' },
        {
          type: 'chart',
          kind: 'stacked-bar-horizontal',
          title: 'Quarterly',
          description: 'Fictional data.',
          series: Array.from({ length: 12 }, (_, i) => ({
            id: `series-${i}`,
            points: Array.from({ length: 6 }, (__, j) => ({ x: `quarter-${j}`, y: j })),
          })),
        },
        { type: 'code', lang: 'ts', code: words(80) },
        { type: 'text', markdown: `See [docs](https://example.com/${'a/'.repeat(40)}).` },
      ],
    });
    expect(finding(settings, 'too-many-words')).toEqual([]);
    // Human text: titles, body strings, list items and table cells; notes never count.
    const wordy = lintOne({
      id: 'wordy',
      layout: 'free',
      notes: `${LONG_NOTES} ${words(200)}`,
      blocks: [
        { type: 'heading', level: 2, text: words(5) },
        { type: 'list', items: [{ text: words(20) }, { text: words(20) }] },
        {
          type: 'table',
          columns: [{ id: 'a', label: 'Plan' }],
          rows: [{ a: words(12) }],
        },
      ],
    });
    expect(finding(wordy, 'too-many-words')).toEqual([
      [
        '$.slides[0].blocks[1]',
        'The slide "wordy" has 58 words of text; the suggested limit is 55. blocks[1] (list) holds the most (40).',
      ],
    ]);
    // Layout slides name the field and stay at props.
    const layout = lintOne({
      id: 'split',
      layout: 'two-column-split',
      props: { left: { heading: 'Left', body: words(40) }, right: { body: words(20) } },
    });
    expect(finding(layout, 'too-many-words')).toEqual([
      [
        '$.slides[0].props',
        'The slide "split" has 61 words of text; the suggested limit is 55. props.left holds the most (41).',
      ],
    ]);
  });

  it('notes-boilerplate finds boilerplate phrases inside notes, in any case', () => {
    for (const notes of [
      'Do not read the slide.',
      '  DON’T READ THE SLIDE — tell the story of the launch instead, with numbers.',
      'Opening: no leer la diapositiva, contar la historia.',
    ]) {
      const issues = lintOne({ id: 'intro', layout: 'quote', props: { quote: 'Q' }, notes });
      expect(finding(issues, 'notes-boilerplate'), notes).toEqual([
        [
          '$.slides[0].notes',
          expect.stringMatching(/^The slide "intro" "notes" contain the boilerplate phrase "/),
        ],
      ]);
    }
    const clean = lintOne({
      id: 'intro',
      layout: 'quote',
      props: { quote: 'Q' },
      notes: 'Read the slide title aloud, then do not dwell on the numbers for long.',
    });
    expect(finding(clean, 'notes-boilerplate')).toEqual([]);
  });

  it('empty-steps points at each empty label and skips custom slides', () => {
    const issues = lintOne({
      id: 'reveal',
      layout: 'free',
      steps: ['Problem', 'Answer', 'Extra'],
      blocks: [
        { type: 'text', markdown: 'Problem', step: 1 },
        { type: 'text', markdown: 'Answer', step: 2 },
      ],
    });
    expect(finding(issues, 'empty-steps')).toEqual([
      [
        '$.slides[0].steps[2]',
        'The slide "reveal" labels step 3 ("Extra") in "steps", but nothing reveals on it.',
      ],
    ]);
    const custom = lintOne({
      id: 'widget',
      layout: 'custom',
      steps: ['One', 'Two'],
      props: { component: 'host-widget' },
    });
    expect(finding(custom, 'empty-steps')).toEqual([]);
  });

  it('stays bounded on hostile decks: 16,000 slides, deep props, a capped and deduplicated list', () => {
    const textSlide = (index: number) => ({
      id: `s${index}`,
      layout: 'free',
      blocks: [{ type: 'text', markdown: 'x' }],
    });
    // Over the slide cap: the model issue only, no quality pass over 16,000 slides.
    const started = performance.now();
    const huge = lintDeck({
      formatVersion: 2,
      meta: { title: 'Huge' },
      slides: Array.from({ length: 16_000 }, (_, index) => textSlide(index)),
    });
    expect(performance.now() - started).toBeLessThan(5_000);
    expect(huge.ok).toBe(false);
    expect(huge.issues.map((issue) => issue.code)).toEqual(['too-many']);
    expect(huge.issues.length).toBeLessThanOrEqual(DECK_LINT_MAX_ISSUES);

    // 5,000 and 50,000 levels of props: no stack overflow, no throw.
    for (const depth of [5_000, 50_000]) {
      let nested: unknown = 'x';
      for (let level = 0; level < depth; level++) nested = { a: nested };
      const deep = () =>
        lintDeck({
          formatVersion: 2,
          meta: { title: 'Deep' },
          slides: [{ id: 'a', layout: 'title-hero', props: { title: 'x', extra: nested } }],
        });
      expect(deep, String(depth)).not.toThrow();
      expect(deep().ok).toBe(false);
    }

    // At the slide cap (200), every slide warns: the list stops at the cap, the counts do not.
    const capped = lintDeck({
      formatVersion: 2,
      meta: { title: 'Capped' },
      slides: Array.from({ length: 200 }, (_, index) => textSlide(index)),
    });
    expect(capped.issues).toHaveLength(DECK_LINT_MAX_ISSUES);
    expect(capped.truncated).toBe(true);
    expect(capped.warnings).toBeGreaterThan(DECK_LINT_MAX_ISSUES);
    const keys = capped.issues.map((issue) => JSON.stringify([issue.rule, issue.path]));
    expect(new Set(keys).size).toBe(keys.length);
    expect(lintDeck({ formatVersion: 2, meta: { title: 'Small' }, slides: [] }).truncated).toBe(
      false
    );
  });
});

describe('bounded RFC 6902 deck patch', () => {
  it('supports add, remove, replace, move, copy, and test without changing the input', () => {
    const original = { slides: [{ id: 'a' }, { id: 'b' }], meta: { title: 'Draft' } };
    const result = applyDeckPatch(original, [
      { op: 'add', path: '/slides/1', value: { id: 'x' } },
      { op: 'replace', path: '/meta/title', value: 'Ready' },
      { op: 'copy', from: '/slides/0', path: '/slides/-' },
      { op: 'move', from: '/slides/1', path: '/slides/0' },
      { op: 'test', path: '/meta/title', value: 'Ready' },
      { op: 'remove', path: '/slides/2' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value).toEqual({
        slides: [{ id: 'x' }, { id: 'a' }, { id: 'a' }],
        meta: { title: 'Ready' },
      });
    expect(original).toEqual({ slides: [{ id: 'a' }, { id: 'b' }], meta: { title: 'Draft' } });
  });

  it('refuses prototype paths, failed tests, and patches above the operation cap', () => {
    expect(applyDeckPatch({}, [{ op: 'add', path: '/__proto__/polluted', value: true }]).ok).toBe(
      false
    );
    expect(applyDeckPatch({ a: 1 }, [{ op: 'test', path: '/a', value: 2 }]).ok).toBe(false);
    expect(
      applyDeckPatch(
        {},
        Array.from({ length: 1_001 }, () => ({ op: 'remove', path: '/x' }))
      ).ok
    ).toBe(false);
  });
});

describe('paired starter decks', () => {
  it('validates and lints every JSON/Markdown pair, round-tripping to the same v2 deck', async () => {
    const files = (await readdir(decksPath)).filter((name) => name.endsWith('.json')).sort();
    expect(files).toHaveLength(7);
    for (const file of files) {
      const name = file.slice(0, -5);
      const source = JSON.parse(await readFile(resolve(decksPath, file), 'utf8')) as unknown;
      const markdown = await readFile(resolve(decksPath, `${name}.md`), 'utf8');
      const jsonResult = parseDeck(source);
      const markdownResult = parseDeckMarkdown(markdown);
      expect(jsonResult.ok, file).toBe(true);
      expect(markdownResult.ok, `${name}.md`).toBe(true);
      expect(markdownResult.deck).toEqual(jsonResult.deck);
      expect(parseDeckMarkdown(deckToMarkdown(jsonResult.deck!)).deck).toEqual(jsonResult.deck);
      expect(lintDeck(source), file).toMatchObject({ ok: true, errors: 0, warnings: 0 });
    }
    const flagship = JSON.parse(
      await readFile(resolve(decksPath, 'texuli-create-anything.json'), 'utf8')
    ) as { slides: unknown[] };
    expect(flagship.slides).toHaveLength(25);
  });
});
