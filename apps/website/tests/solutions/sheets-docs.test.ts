import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { parseDocMarkdown } from '../../src/content/solution-docs/parse.ts';
import { loadSheetsDocs, SHEETS_DOC_FILES } from '../../src/content/solution-docs/sheets/index.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const CONTENT = resolve(WEBSITE, 'src/content/solution-docs/sheets');
const PAGE = resolve(WEBSITE, 'src/pages/guides/solutions/sheets/index.astro');
const page = readFileSync(PAGE, 'utf8');
const sheets = getSolution('sheets');
const sections = loadSheetsDocs();
const corpus = sections.map((section) => section.source).join('\n');

describe('Sheets solution docs', () => {
  it('ships the seven Markdown files and the guides route page', () => {
    expect([...SHEETS_DOC_FILES]).toEqual([
      'overview',
      'quickstart',
      'model',
      'integration',
      'a11y',
      'limits',
      'agents',
    ]);
    for (const id of SHEETS_DOC_FILES) {
      expect(existsSync(join(CONTENT, `${id}.md`)), id).toBe(true);
    }
    expect(existsSync(PAGE)).toBe(true);
    expect(siteRouteExists('/guides/solutions/sheets/')).toBe(true);
    expect(sheets.docs).toBe('/guides/solutions/sheets/');
  });

  it('links both ways with the landing: docs back-link and registry docs href', () => {
    expect(sheets.route).toBe('/solutions/sheets/');
    expect(sheets.links.some((link) => link.href === sheets.docs)).toBe(true);
    expect(page).toContain('SolutionDocsPage');
    expect(page).toContain("getSolution('sheets')");
    expect(page).toContain('loadSheetsDocs');
    expect(page).toContain('../../../../components/');
    expect(corpus).not.toMatch(/sheets-page/);
    expect(page).not.toMatch(/sheets-page/);
  });

  it('loads real APIs, owned formulas, in-development status, and no HTML sink or plan name', () => {
    expect(corpus).toMatch(/in development/i);
    expect(corpus).toContain('loadUntrustedSheet');
    expect(corpus).toContain('@texuli/sheets/model');
    expect(corpus).toContain('createWorkbook');
    expect(corpus).toContain('SheetView');
    expect(corpus).toContain('@texuli/sheets/view');
    expect(corpus).toContain('parseFormula');
    expect(corpus).toContain('@texuli/sheets/formula');
    expect(corpus).toContain('checkSheetDraft');
    expect(corpus).toContain('spreadsheet');
    expect(page).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(page).not.toMatch(/client:[a-z]+/);
    expect(`${page}\n${corpus}`).not.toMatch(/PLAN_015/);
    const heading = parseDocMarkdown('## Hello world\n\nA `code` word.\n').find(
      (block) => block.type === 'h2'
    );
    expect(heading).toMatchObject({ type: 'h2', id: 'hello-world', text: 'Hello world' });
    expect(sections.every((section) => section.blocks.some((block) => block.type === 'h2'))).toBe(
      true
    );
  });
});
