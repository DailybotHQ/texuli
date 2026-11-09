import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { parseDocMarkdown } from '../../src/content/solution-docs/parse.ts';
import {
  loadWorkflowsDocs,
  WORKFLOWS_DOC_FILES,
} from '../../src/content/solution-docs/workflows/index.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const CONTENT = resolve(WEBSITE, 'src/content/solution-docs/workflows');
const PAGE = resolve(WEBSITE, 'src/pages/guides/solutions/workflows/index.astro');
const page = readFileSync(PAGE, 'utf8');
const workflows = getSolution('workflows');
const sections = loadWorkflowsDocs();
const corpus = sections.map((section) => section.source).join('\n');

describe('Workflows solution docs', () => {
  it('ships the seven Markdown files and the guides route page', () => {
    expect([...WORKFLOWS_DOC_FILES]).toEqual([
      'overview',
      'quickstart',
      'model',
      'integration',
      'a11y',
      'limits',
      'agents',
    ]);
    for (const id of WORKFLOWS_DOC_FILES) {
      expect(existsSync(join(CONTENT, `${id}.md`)), id).toBe(true);
    }
    expect(existsSync(PAGE)).toBe(true);
    expect(siteRouteExists('/guides/solutions/workflows/')).toBe(true);
    expect(workflows.docs).toBe('/guides/solutions/workflows/');
  });

  it('links both ways with the landing: docs back-link and registry docs href', () => {
    expect(workflows.route).toBe('/solutions/workflows/');
    expect(workflows.links.some((link) => link.href === workflows.docs)).toBe(true);
    expect(page).toContain('SolutionDocsPage');
    expect(page).toContain("getSolution('workflows')");
    expect(page).toContain('loadWorkflowsDocs');
  });

  it('loads real APIs, in-development status, kept JSON preview, and no HTML sink or plan name', () => {
    expect(corpus).toMatch(/in development/i);
    expect(corpus).toContain('createWorkflow');
    expect(corpus).toContain('applyWorkflowOps');
    expect(corpus).toContain('@texuli/workflows/model');
    expect(corpus).toContain('WorkflowEditor');
    expect(corpus).toContain('@texuli/workflows/editor');
    expect(corpus).toContain('layoutWorkflow');
    expect(corpus).toContain('workflow-graph');
    expect(corpus).toContain('/workflows-page/json/');
    expect(corpus).not.toMatch(/\/workflows-page\/(?!json\/)/);
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
