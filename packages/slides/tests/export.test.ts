import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  DECK_PRINT_PAGE_SIZES,
  deckExportFilename,
  planDeckPrint,
  requestDeckPdf,
} from '../src/export/index.ts';
import { parseDeck } from '../src/model/index.ts';

function makeDeck(aspect = '16:9') {
  const parsed = parseDeck({
    meta: { title: 'Quarterly update', aspect },
    slides: [
      { id: 'opening', title: 'Opening', notes: 'Welcome.', blocks: [] },
      { id: 'numbers', blocks: [] },
    ],
  });
  if (!parsed.success) throw new Error(parsed.issues[0]?.message);
  return parsed.deck;
}

describe('deck print plan', () => {
  it('prints one page per slide by default with a page size from the aspect', () => {
    const deck = makeDeck('4:3');
    const before = JSON.stringify(deck);
    const plan = planDeckPrint(deck);
    expect(plan.filename).toBe('Quarterly update.pdf');
    expect(plan.notes).toBe('none');
    expect(plan.pageSize).toEqual(DECK_PRINT_PAGE_SIZES['4:3']);
    expect(plan.pageSize.pageName).toBe('tx-deck-4-3');
    expect(plan.pages).toEqual([
      { kind: 'slide', index: 0, slideId: 'opening', label: 'Opening' },
      { kind: 'slide', index: 1, slideId: 'numbers', label: 'Slide 2' },
    ]);
    expect(JSON.stringify(deck)).toBe(before);
  });

  it('adds a notes appendix after the slides, or prints a notes-only handout', () => {
    const appendix = planDeckPrint(makeDeck(), { notes: 'appendix' });
    expect(appendix.pages.map((page) => `${page.kind}:${page.slideId}`)).toEqual([
      'slide:opening',
      'slide:numbers',
      'notes:opening',
      'notes:numbers',
    ]);
    expect(appendix.pages[2]).toMatchObject({ kind: 'notes', notes: 'Welcome.' });
    expect(appendix.pages[3]).toMatchObject({ kind: 'notes', notes: null });

    const handout = planDeckPrint(makeDeck(), { notes: 'handout' });
    expect(handout.pages.every((page) => page.kind === 'notes')).toBe(true);
    expect(() => planDeckPrint(makeDeck(), { notes: 'everything' as unknown as 'none' })).toThrow(
      TypeError
    );
  });

  it('keeps the stylesheet named pages in sync with the page size table', () => {
    const css = readFileSync('packages/slides/src/styles.css', 'utf8');
    for (const size of Object.values(DECK_PRINT_PAGE_SIZES)) {
      expect(css).toContain(
        `@page ${size.pageName} {\n  size: ${size.inlineSize} ${size.blockSize};\n  margin: 0;`
      );
      expect(css).toContain(
        `.tx-deck-print__slide[data-aspect="${size.aspect}"] {\n    page: ${size.pageName};`
      );
    }
    expect(css).toMatch(/@media print \{[\s\S]*\.tx-deck-stage__toolbar/);
  });

  it('sanitizes export filenames', () => {
    expect(deckExportFilename('Q3 / Q4: plan?')).toBe('Q3 - Q4- plan.pdf');
    expect(deckExportFilename('../../etc/passwd')).toBe('etc-passwd.pdf');
    expect(deckExportFilename('Report.pdf')).toBe('Report.pdf');
    expect(deckExportFilename('')).toBe('presentation.pdf');
    expect(deckExportFilename(42)).toBe('presentation.pdf');
    expect(deckExportFilename('x'.repeat(200)).length).toBe(84);
    expect(deckExportFilename('Deck', 'png')).toBe('Deck.png');
    expect(deckExportFilename('Deck', '../sh')).toBe('Deck.pdf');
  });
});

describe('PDF request seam', () => {
  it('uses browser print when no exporter is supplied', async () => {
    const print = vi.fn();
    const result = await requestDeckPdf(planDeckPrint(makeDeck()), { print });
    expect(print).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ method: 'browser-print', filename: 'Quarterly update.pdf' });
  });

  it('fails clearly without print or exporter', async () => {
    const original = globalThis.print;
    // @ts-expect-error simulate a host without window.print
    delete globalThis.print;
    try {
      await expect(requestDeckPdf(planDeckPrint(makeDeck()))).rejects.toThrow(
        /supply a PDF exporter/
      );
    } finally {
      if (original) globalThis.print = original;
    }
  });

  it('passes the plan to a host exporter and checks the returned PDF blob', async () => {
    const plan = planDeckPrint(makeDeck(), { notes: 'appendix' });
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    const exporter = vi.fn(async () => pdf);
    const print = vi.fn();
    const result = await requestDeckPdf(plan, { exporter, print });
    expect(exporter).toHaveBeenCalledWith(plan);
    expect(print).not.toHaveBeenCalled();
    expect(result).toEqual({ method: 'exporter', filename: plan.filename, blob: pdf });

    for (const bad of [
      new Blob(['<html>'], { type: 'text/html' }),
      new Blob([], { type: 'application/pdf' }),
      'not a blob' as unknown as Blob,
    ]) {
      await expect(requestDeckPdf(plan, { exporter: async () => bad })).rejects.toThrow(
        /application\/pdf/
      );
    }
  });
});
