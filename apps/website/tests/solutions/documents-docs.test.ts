import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import {
  DOCUMENTS_DOC_FILES,
  loadDocumentsDocs,
} from '../../src/content/solution-docs/documents/index.ts';
import { parseDocMarkdown } from '../../src/content/solution-docs/parse.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const CONTENT = resolve(WEBSITE, 'src/content/solution-docs/documents');
const PAGE = resolve(WEBSITE, 'src/pages/guides/solutions/documents/index.astro');
const page = readFileSync(PAGE, 'utf8');
const documents = getSolution('documents');
const sections = loadDocumentsDocs();
const corpus = sections.map((section) => section.source).join('\n');

describe('Documents solution docs', () => {
  it('ships the seven Markdown files and the guides route page', () => {
    expect([...DOCUMENTS_DOC_FILES]).toEqual([
      'overview',
      'quickstart',
      'model',
      'integration',
      'a11y',
      'limits',
      'agents',
    ]);
    for (const id of DOCUMENTS_DOC_FILES) {
      expect(existsSync(join(CONTENT, `${id}.md`)), id).toBe(true);
    }
    expect(existsSync(PAGE)).toBe(true);
    expect(siteRouteExists('/guides/solutions/documents/')).toBe(true);
    expect(documents.docs).toBe('/guides/solutions/documents/');
  });

  it('links both ways with the landing: docs back-link and registry docs href', () => {
    expect(documents.route).toBe('/solutions/documents/');
    expect(documents.links.some((link) => link.href === documents.docs)).toBe(true);
    expect(page).toContain('SolutionDocsPage');
    expect(page).toContain("getSolution('documents')");
    expect(page).toContain('loadDocumentsDocs');
    expect(page).toContain('../../../../components/');
    expect(corpus).not.toMatch(/documents-page/);
    expect(page).not.toMatch(/documents-page/);
  });

  it('loads real APIs, in-development status, and no HTML sink or plan name', () => {
    expect(corpus).toMatch(/in development/i);
    expect(corpus).toContain('createDocument');
    expect(corpus).toContain('@texuli/document/model');
    expect(corpus).toContain('applyOperations');
    expect(corpus).toContain('loadUntrustedDocument');
    expect(corpus).toContain('PageEditor');
    expect(corpus).toContain('@texuli/pages/editor');
    expect(corpus).toContain('RichTextEditor');
    expect(corpus).toContain('@texuli/editor/editor');
    expect(corpus).toContain('exportDocument');
    expect(corpus).toContain('document.run');
    expect(corpus).toContain('document.export');
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
