// @vitest-environment node
/**
 * Agent evals for the shipped Solutions: "build a slide deck / document / workflow / canvas
 * / sheet". Each scenario is what an agent that starts from texuli.com would do, scripted
 * with no model and no network:
 *
 * 1. read `/llms.txt` and follow its Solutions section to `/solutions/index.json`;
 * 2. find the Solution in the index (status, packages, docs URL);
 * 3. read the docs page through the remote MCP's `site.read` (`functions/mcp.ts` with a
 *    fake site built from the committed sources, see `solutions-site.ts`);
 * 4. build with the MCP operations that exist, on both doors (local stdio and the remote
 *    Function), and check the result with the server's own validators.
 *
 * Canvas and Sheets have no MCP validator: `blueprint.validate` refuses their nodes with a
 * stable code, and the scenario checks that the agent is pointed to the package that holds
 * the validator instead. That is the honest path today.
 *
 * Design systems (PLAN_017): `ds.generate` returns a draft from a brief (never saved or
 * approved), `ds.validate` accepts it, and `ds.validate` in full mode reports a prototype
 * blueprint that uses a component the locked allow set does not list. Its docs page is a
 * short reference page that does not name the packages yet, so for it the package names
 * come from the index only (`docsNamePackages: false`).
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REFUSED_BLUEPRINT,
  REPORT_BLUEPRINT,
} from '../../../apps/website/src/components/solutions/agent-chat/demo/blueprints.ts';
import { SOLUTIONS } from '../../../apps/website/src/data/solutions/index.ts';
import type { SolutionSlug } from '../../../apps/website/src/data/solutions/schema.ts';
import { onRequest } from '../../../functions/mcp.ts';
import { assertEdgeParity, type Json, runSession, type Session } from '../harness.ts';
import { DOCUMENTED, llmsSection, SITE, solutionsSite } from './solutions-site.ts';

const REPO = resolve(import.meta.dirname, '../../..');
const call = (name: string, args: Json) => ({ name, arguments: args });

/** Steps 1–3: llms.txt → index.json → the docs page over the remote MCP. */
async function discover(slug: SolutionSlug, options: { docsNamePackages?: boolean } = {}) {
  const site = solutionsSite();
  const get = async (url: string) => {
    expect(url.startsWith(`${SITE}/`), url).toBe(true);
    const response = await site.fetch(new Request(url));
    expect(response.status, url).toBe(200);
    return response.text();
  };

  // 1. llms.txt names the index and the Solution.
  const llms = await get(`${SITE}/llms.txt`);
  const links = llmsSection(llms, 'Solutions');
  const indexLink = links.find((link) => link.title === 'Solutions index (JSON)');
  expect(indexLink?.url).toBe(`${SITE}/solutions/index.json`);

  // 2. The index holds the Solution's facts.
  const index = JSON.parse(await get(indexLink?.url ?? '')) as Json;
  expect(index.format).toBe('texuli/solutions-index-v1');
  const entry = index.solutions.find((s: Json) => s.slug === slug);
  expect(entry, `${slug} in the index`).toBeDefined();
  expect(links.map((link) => link.url)).toContain(entry.url);
  expect(entry.docs).toBe(`${SITE}/guides/solutions/${slug}/`);
  // Honest status: native planned, or in development where the registry cites evidence
  // (design systems on Compose Desktop; the registry validator caps native statuses).
  expect(['available', 'in development', 'experimental', 'planned']).toContain(entry.status);
  const registry = SOLUTIONS.find((s) => s.slug === slug);
  for (const platform of entry.platforms) {
    if (platform.platform === 'web') continue;
    expect(['planned', 'in development'], `${slug} ${platform.platform}`).toContain(
      platform.status
    );
    if (platform.status === 'in development') {
      const cited = registry?.platforms.find((p) => p.platform === platform.platform)?.evidence;
      expect(cited?.length ?? 0, `${slug} ${platform.platform} evidence`).toBeGreaterThan(0);
    }
  }

  // 3. The docs page, read the way a remote agent reads it.
  const docsPath = new URL(entry.docs).pathname;
  const response = await onRequest({
    request: new Request(`${SITE}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'cf-connecting-ip': '203.0.113.200',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: call('site.read', { path: docsPath }),
      }),
    }),
    env: { ASSETS: site },
  });
  expect(response.status).toBe(200);
  const rpc = (await response.json()) as Json;
  expect(rpc.result.isError ?? false, JSON.stringify(rpc.result).slice(0, 300)).toBe(false);
  const docs = rpc.result.structuredContent;
  expect(docs.path).toBe(docsPath);
  // The docs name every package the index lists (where the docs page does).
  if (options.docsNamePackages !== false)
    for (const pkg of entry.packages) expect(docs.markdown, pkg.name).toContain(pkg.name);
  expect(site.requested).toEqual(
    expect.arrayContaining([
      '/llms.txt',
      '/solutions/index.json',
      `${docsPath.replace(/\/$/, '')}.md`,
    ])
  );
  return { entry, docs: docs.markdown as string };
}

/** Step 4 on both doors, with the edge results compared between them. */
async function build(session: Session) {
  const stdio = await runSession(session, 'stdio');
  const remote = await runSession(session, 'remote');
  const compared = assertEdgeParity(session.name, stdio, remote);
  expect(compared).toBeGreaterThan(0);
}

const DECK_MARKDOWN = `---
title: Example Co. quarterly review
---

# Quarterly review

What shipped and what is next for Example Co.

---

# Highlights

- Fictional launch on time
- Docs ready on day one
`;

const DOCUMENT_MARKDOWN = `# Example Co. launch brief

A fictional brief for the next release.

## Goals

- Ship the reader
- Keep the editor fast
`;

/** The workflow graph the spec ships as its golden example (fictional). */
const PIPELINE = JSON.parse(
  readFileSync(resolve(REPO, 'packages/spec/fixtures/workflow/golden/pipeline.json'), 'utf8')
) as Json;

describe('agent builds each shipped Solution from llms.txt → index → docs → MCP', () => {
  it('covers every Solution whose docs page ships', () => {
    // A Solution's docs page on disk must have its loader in DOCS (and an eval below).
    const shipped = SOLUTIONS.filter((s) =>
      existsSync(resolve(REPO, `apps/website/src/pages${s.docs}index.astro`))
    ).map((s) => s.slug);
    expect(DOCUMENTED.map((s) => s.slug).sort()).toEqual(shipped.sort());
    expect(shipped.sort()).toEqual(
      [
        'agent-chat',
        'canvas',
        'dashboards',
        'design-systems',
        'documents',
        'editor',
        'forms',
        'sheets',
        'slides',
        'workflows',
      ].sort()
    );
  });

  it('build a slide deck: deck.run from-markdown → lint → to-markdown', async () => {
    const { entry, docs } = await discover('slides');
    expect(entry.packages.map((p: Json) => p.name)).toEqual(['@texuli/deck', '@texuli/slides']);
    expect(docs).toMatch(/Markdown/);
    await build({
      name: 'slides deck',
      steps: [
        {
          label: 'convert',
          method: 'tools/call',
          params: call('deck.run', { command: 'from-markdown', markdown: DECK_MARKDOWN }),
          expect(result) {
            const out = result.structuredContent.result;
            expect(out.ok).toBe(true);
            expect(out.deck.formatVersion).toBe(2);
            expect(out.deck.slides.length).toBe(2);
          },
        },
        {
          label: 'lint',
          method: 'tools/call',
          params: (ctx) =>
            call('deck.run', { command: 'lint', deck: ctx.data('convert').result.deck }),
        },
        {
          label: 'back',
          method: 'tools/call',
          params: (ctx) =>
            call('deck.run', { command: 'to-markdown', deck: ctx.data('convert').result.deck }),
          expect(result) {
            expect(JSON.stringify(result.structuredContent)).toContain('Quarterly review');
          },
        },
      ],
      final(ctx) {
        expect(ctx.data('convert').result.issues).toEqual([]);
      },
    });
  });

  it('build a document: document.run from-markdown → validate', async () => {
    const { entry, docs } = await discover('documents');
    expect(entry.packages.map((p: Json) => p.name)).toContain('@texuli/document');
    expect(docs).toMatch(/document/i);
    await build({
      name: 'documents brief',
      steps: [
        {
          label: 'convert',
          method: 'tools/call',
          params: call('document.run', { command: 'from-markdown', markdown: DOCUMENT_MARKDOWN }),
          expect(result) {
            const out = result.structuredContent.result;
            expect(out.ok).toBe(true);
            expect(out.document.format).toBe('texuli-document');
            expect(out.document.blocks.length).toBeGreaterThan(2);
          },
        },
        {
          label: 'validate',
          method: 'tools/call',
          params: (ctx) =>
            call('document.run', {
              command: 'validate',
              document: ctx.data('convert').result.document,
            }),
        },
      ],
      final(ctx) {
        expect(ctx.data('validate').result.ok).toBe(true);
        expect(ctx.data('validate').result.issues).toEqual([]);
      },
    });
  });

  it('build a workflow: catalog.search → blueprint.validate a workflow-graph page', async () => {
    const { entry, docs } = await discover('workflows');
    expect(entry.packages.map((p: Json) => p.name)).toContain('@texuli/workflows');
    expect(docs).toMatch(/workflow/i);
    await build({
      name: 'workflows graph',
      steps: [
        {
          label: 'search',
          method: 'tools/call',
          params: call('catalog.search', { query: 'workflow graph' }),
          expect(result) {
            expect(JSON.stringify(result.structuredContent)).toContain('workflow-graph');
          },
        },
        {
          label: 'validate',
          method: 'tools/call',
          params: call('blueprint.validate', {
            draft: {
              id: 'layout-page',
              props: { title: 'Example Co. release pipeline' },
              children: [
                {
                  id: 'workflow-graph',
                  props: { label: 'Release pipeline', mode: 'view', graph: PIPELINE },
                },
              ],
            },
          }),
        },
      ],
      final(ctx) {
        expect(ctx.data('validate').valid).toBe(true);
        expect(ctx.data('validate').diagnostics).toEqual([]);
      },
    });
  });

  it('attach a blueprint in a chat reply: blueprint.validate accepts the report and refuses an unknown component', async () => {
    const { entry, docs } = await discover('agent-chat');
    expect(entry.packages.map((p: Json) => p.name)).toEqual([
      '@texuli/chat',
      '@texuli/player',
      '@texuli/catalog',
      '@texuli/core',
    ]);
    // The docs name the validator and the painter the attachment card is given.
    expect(docs).toContain('@texuli/catalog/validate');
    expect(docs).toContain('ChatAttachment');
    await build({
      name: 'agent chat attachments',
      steps: [
        {
          label: 'report',
          method: 'tools/call',
          params: call('blueprint.validate', { draft: REPORT_BLUEPRINT }),
        },
        {
          label: 'refused',
          method: 'tools/call',
          params: call('blueprint.validate', { draft: REFUSED_BLUEPRINT }),
        },
      ],
      final(ctx) {
        expect(ctx.data('report').valid).toBe(true);
        expect(ctx.data('refused').valid).toBe(false);
        expect(JSON.stringify(ctx.data('refused').diagnostics)).toContain('unknown-id');
      },
    });
  });

  it('send an editor note to chat: md.convert writes Slack, refuses the javascript: link and keeps @everyone inert', async () => {
    const { entry, docs } = await discover('editor');
    expect(entry.packages.map((p: Json) => p.name)).toEqual([
      '@texuli/editor',
      '@texuli/core',
      'texuli',
    ]);
    // The docs name the conversion an agent can run and the editor function that matches it.
    expect(docs).toContain('documentToDialect');
    expect(docs).toContain('md.convert');
    await build({
      name: 'editor note to chat',
      steps: [
        {
          label: 'slack',
          method: 'tools/call',
          params: call('md.convert', {
            source:
              '**Password reset**: open [the page](https://example.com/reset), not [this](javascript:alert(1)). @everyone',
            from: 'markdown',
            to: 'slack',
          }),
        },
      ],
      final(ctx) {
        const value = String(ctx.data('slack').value);
        expect(value).toContain('*Password reset*');
        expect(value).toContain('<https://example.com/reset|the page>');
        expect(value).not.toContain('javascript');
        expect(value).not.toMatch(/(?<!\u200b)@everyone/);
      },
    });
  });

  for (const [slug, id, code, pkg] of [
    ['canvas', 'canvas', 'canvas-unchecked', '@texuli/canvas'],
    ['sheets', 'spreadsheet', 'sheet-unchecked', '@texuli/sheets'],
  ] as const) {
    it(`build a ${slug === 'canvas' ? 'canvas' : 'sheet'}: blueprint.validate refuses the node (${code}), so the agent uses ${pkg}`, async () => {
      const { entry, docs } = await discover(slug);
      expect(entry.packages.map((p: Json) => p.name)).toContain(pkg);
      // The docs tell the agent where the model and its validator live.
      expect(docs).toContain(pkg);
      const prop = id === 'canvas' ? 'canvas' : 'sheet';
      await build({
        name: `${slug} refusal`,
        steps: [
          {
            label: 'validate',
            method: 'tools/call',
            params: call('blueprint.validate', {
              draft: {
                id: 'layout-page',
                props: { title: 'Example Co.' },
                children: [{ id, props: { label: 'Example', [prop]: {} } }],
              },
            }),
          },
        ],
        final(ctx) {
          const result = ctx.data('validate');
          expect(result.valid).toBe(false);
          expect(result.diagnostics.map((d: Json) => d.code)).toContain(code);
        },
      });
    });
  }
  it('build a design system: ds.generate a draft → ds.validate → a locked check of a prototype', async () => {
    const { entry, docs } = await discover('design-systems', { docsNamePackages: false });
    expect(entry.packages.map((p: Json) => p.name)).toEqual([
      '@texuli/spec',
      '@texuli/tokens',
      'texuli',
      '@texuli/tools',
    ]);
    expect(docs).toMatch(/closed JSON document/);
    expect(docs).toMatch(/allow set/);
    await build({
      name: 'design-systems draft',
      steps: [
        {
          label: 'generate',
          method: 'tools/call',
          params: call('ds.generate', {
            brief: 'name Harborline, brand #0e7490, rounded, calm, comfortable',
          }),
          expect(result) {
            const out = result.structuredContent;
            expect(out.ok).toBe(true);
            expect(out.document.name).toBe('Harborline');
            expect(out.report.guarantees.passed).toBe(true);
            // A draft: the generator never approves.
            expect(out.document.approval).toBeUndefined();
          },
        },
        {
          label: 'validate',
          method: 'tools/call',
          params: (ctx) => call('ds.validate', { document: ctx.data('generate').document }),
        },
        {
          label: 'locked',
          method: 'tools/call',
          params: (ctx) =>
            call('ds.validate', {
              document: {
                ...ctx.data('generate').document,
                allow: { card: {}, button: { variants: ['default', 'outline'] } },
              },
              full: true,
              report: true,
              prototype: {
                blueprints: {
                  'signup.json': {
                    tree: {
                      id: 'card',
                      children: [
                        { id: 'button', props: { variant: 'ghost' } },
                        { id: 'badge', props: {} },
                      ],
                    },
                  },
                },
              },
            }),
        },
      ],
      final(ctx) {
        expect(ctx.data('validate').valid).toBe(true);
        const codes = JSON.stringify(ctx.data('locked'));
        expect(codes).toContain('not-allowed');
        expect(codes).toContain('variant-not-allowed');
      },
    });
  });
});
