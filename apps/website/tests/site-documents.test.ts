/**
 * /documents-page/ (PLAN_010 T-site-070): honest status copy, fictional
 * data, no HTML sinks, lazy islands that import the large modules only
 * after hydration, sections that match the page, sample documents valid at
 * the untrusted tier, an agent `document` blueprint the player's checks
 * accept, a bounded patch with an exact inverse, a hostile patch refused,
 * and exports that write real Markdown, DOCX and PDF.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyEditOps } from '@texuli/catalog/edit';
import { validateDraft } from '@texuli/catalog/validate';
import { DOCUMENT_BLOCK_TYPES, EMBED_KINDS } from '@texuli/document/model';
import { validateDocument } from '@texuli/document/schema';
import { exportDocument } from '@texuli/pages/export';
import { checkDocumentDraft } from '@texuli/pages/host';
import { createPlayerCatalog } from '@texuli/player';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_BLUEPRINT,
  DOCUMENT_KEY,
  DOCUMENT_PATCH,
  DOCUMENT_SPEC,
  DOCUMENT_TREE,
  documentEnvelope,
  HOSTILE_PATCH,
  patchDocumentHost,
} from '../src/components/documents-site/blueprint.ts';
import {
  BLOCK_NOTES,
  EMBED_STATUSES,
  slashInventory,
} from '../src/components/documents-site/inventory.ts';
import {
  DOCUMENTS_DOCS,
  DOCUMENTS_RELEASE,
  DOCUMENTS_SECTIONS,
  DOCUMENTS_STATUS,
} from '../src/components/documents-site/page.ts';
import { HANDBOOK, NESTED_PAGES, REVIEW_DRAFT } from '../src/components/documents-site/sample.ts';

const read = (path: string) => readFileSync(resolve('apps/website/src', path), 'utf8');
const PAGE = read('pages/documents-page/index.astro');
const ISLANDS = [
  'components/documents-site/AgentDocumentDemo.svelte',
  'components/documents-site/CollabDemo.svelte',
  'components/documents-site/DocumentWorkbench.svelte',
];
const SOURCES = [
  ...ISLANDS,
  'components/documents-site/blueprint.ts',
  'components/documents-site/inventory.ts',
  'components/documents-site/page.ts',
  'components/documents-site/sample.ts',
  'pages/documents-page/index.astro',
].map((path) => [path, read(path)] as const);

const pkg = (dir: string) =>
  JSON.parse(readFileSync(resolve('packages', dir, 'package.json'), 'utf8')) as {
    version: string;
  };

const errorsOf = (blueprint: unknown) =>
  validateDraft(blueprint, {
    catalog: createPlayerCatalog(),
    tier: 'untrusted',
    checkDocument: checkDocumentDraft,
  }).diagnostics.filter((entry) => entry.severity === 'error');

describe('documents page: copy and safety', () => {
  it('says both packages are in development and on npm from 0.7.0, their first release', () => {
    // Both packages were first published in 0.7.0; the copy names that release.
    // Later releases move them on; the placeholder never comes back.
    expect(pkg('pages').version).not.toBe('0.0.0');
    expect(pkg('document').version).not.toBe('0.0.0');
    expect(DOCUMENTS_RELEASE).toBe('0.7.0');
    expect(DOCUMENTS_STATUS).toBe('In development, on npm from 0.7.0, a pre-1.0 release.');
    const copy = PAGE.replace(/\s+/g, ' ');
    expect(copy).toContain('in development · on npm from {DOCUMENTS_RELEASE}');
    expect(copy).toContain(
      'Both packages are in development and on npm from <code>{DOCUMENTS_RELEASE}</code>, a pre-1.0 release; <code>0.6.0</code> and earlier are without them.'
    );
    expect(copy).toContain('description="Texuli documents (in development)');
    expect(copy).toContain('in development · on npm from {DOCUMENTS_RELEASE}');
    expect(copy).not.toMatch(/repository only|planned (?:for|with) (?:the )?.?0\.7\.0/i);
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(
        /not (?:yet )?on npm|production[- ]ready|is released|available on npm|npm install @texuli\/(pages|document)/i
      );
    }
  });

  it('renders no HTML from data and uses only fictional example.com addresses', () => {
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(/\{@html|set:html|innerHTML/);
      for (const [url] of source.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
        expect(new URL(url).hostname, `${path}: ${url}`).toMatch(/(^|\.)example\.com$/);
      }
      for (const [email] of source.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) {
        expect(email, path).toMatch(/@example\.com$/);
      }
    }
  });

  it('mounts every island with client:visible, and the islands import the large modules only lazily', () => {
    const islands = [...PAGE.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
    expect(islands.map(([, name]) => name).sort()).toEqual([
      'AgentDocumentDemo',
      'CollabDemo',
      'DocumentWorkbench',
    ]);
    for (const [, name, directive] of islands) expect(`${name} ${directive}`).toMatch(/ visible$/);
    const heavy =
      /^import\s+(?!type\b)[^;]*from\s+'(@texuli\/pages(\/[a-z]+)?|@texuli\/player|@texuli\/document\/(sync|collab|docx|pdf))'/m;
    for (const path of ISLANDS) {
      const source = read(path);
      expect(source, path).not.toMatch(heavy);
      expect(source, path).toMatch(/import\('@texuli\/(pages|player)/);
    }
  });

  it('gives every section an anchor on the page and a unique id, with one h1', () => {
    const ids = DOCUMENTS_SECTIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(PAGE).toContain(`id="${id}"`);
    expect(PAGE.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it('points at docs that exist', () => {
    for (const doc of DOCUMENTS_DOCS) expect(existsSync(resolve(doc.path)), doc.path).toBe(true);
    expect(existsSync(resolve('apps/website/public/llms/components/document.md'))).toBe(true);
  });
});

describe('documents page: data', () => {
  it('ships sample documents that validate at the untrusted tier, without a level-1 heading', () => {
    for (const doc of [HANDBOOK, REVIEW_DRAFT, ...Object.values(NESTED_PAGES)]) {
      const result = validateDocument(doc, { trust: 'untrusted' });
      expect(
        result.issues.filter((issue) => issue.severity === 'error'),
        doc.meta.title
      ).toEqual([]);
      expect(result.ok, doc.meta.title).toBe(true);
      // The page keeps one h1 in every view (the paged view renders levels as written).
      expect(JSON.stringify(doc), doc.meta.title).not.toMatch(/"level":1\b/);
    }
    // Every page link the handbook holds resolves to a nested page.
    const refs = [...JSON.stringify(HANDBOOK).matchAll(/"ref":"([^"]+)"/g)].map(([, ref]) => ref);
    expect(refs.length).toBeGreaterThan(1);
    for (const ref of refs) expect(NESTED_PAGES).toHaveProperty([ref as string]);
    const kinds = new Set(HANDBOOK.blocks.map((block) => block.type));
    for (const kind of ['columns', 'page-link', 'embed', 'callout', 'toggle', 'quote'])
      expect(kinds, kind).toContain(kind);
  });

  it('writes an agent document blueprint (spec 0.7.0) the player accepts, and refuses it without a document host', () => {
    expect(DOCUMENT_SPEC).toBe('0.7.0');
    expect(DOCUMENT_BLUEPRINT.spec).toBe('0.7.0');
    expect(errorsOf(DOCUMENT_BLUEPRINT)).toEqual([]);
    const unchecked = validateDraft(DOCUMENT_BLUEPRINT, {
      catalog: createPlayerCatalog(),
      tier: 'untrusted',
    });
    expect(unchecked.diagnostics.map((entry) => entry.code)).toContain('document-unchecked');
  });

  it('applies the bounded patch by key, validates the result and restores it exactly with the inverse', () => {
    const patched = applyEditOps(DOCUMENT_TREE as never, [DOCUMENT_PATCH], {
      patchDocument: patchDocumentHost,
    });
    expect(patched.ok).toBe(true);
    if (!patched.ok) return;
    const tree = patched.tree as unknown as {
      key: string;
      props: { doc: { meta: { title: string } } };
    };
    expect(tree.key).toBe(DOCUMENT_KEY);
    expect(tree.props.doc.meta.title).toBe('Launch brief, revised');
    expect(JSON.stringify(tree)).toContain('Publish the pilot report');
    expect(errorsOf(documentEnvelope(patched.tree))).toEqual([]);
    const undone = applyEditOps(patched.tree, patched.inverse, {
      patchDocument: patchDocumentHost,
    });
    expect(undone.ok).toBe(true);
    if (undone.ok) expect(undone.tree).toEqual(DOCUMENT_TREE);
    // The guard holds: the same patch on the patched document fails its `test` and changes nothing.
    const twice = applyEditOps(patched.tree, [DOCUMENT_PATCH], {
      patchDocument: patchDocumentHost,
    });
    expect(twice.ok).toBe(false);
  });

  it('refuses the hostile patch and changes nothing', () => {
    const before = JSON.stringify(DOCUMENT_TREE);
    const result = applyEditOps(DOCUMENT_TREE as never, [HOSTILE_PATCH], {
      patchDocument: patchDocumentHost,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-value');
    expect(JSON.stringify(DOCUMENT_TREE)).toBe(before);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // Without the host's patcher the op is refused outright.
    const bare = applyEditOps(DOCUMENT_TREE as never, [DOCUMENT_PATCH]);
    expect(bare.ok).toBe(false);
  });

  it('exports the handbook as real Markdown, DOCX and PDF blobs', async () => {
    const markdown = await exportDocument(HANDBOOK, 'markdown');
    expect(markdown.filename).toMatch(/\.md$/);
    const text = await markdown.blob.text();
    expect(text).toContain('Harbor team handbook');
    expect(text).toContain('https://example.com/status');
    const docx = await exportDocument(HANDBOOK, 'docx');
    expect(docx.filename).toMatch(/\.docx$/);
    const zip = new Uint8Array(await docx.blob.arrayBuffer());
    expect([zip[0], zip[1]]).toEqual([0x50, 0x4b]); // "PK": a zip container
    const pdf = await exportDocument(HANDBOOK, 'pdf');
    expect(pdf.filename).toMatch(/\.pdf$/);
    expect(await pdf.blob.slice(0, 5).text()).toBe('%PDF-');
    expect(pdf.pageCount ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe('documents page: the whole vocabulary', () => {
  it('describes every block type and every embed kind, and marks unpainted embeds as planned', () => {
    expect(Object.keys(BLOCK_NOTES).sort()).toEqual([...DOCUMENT_BLOCK_TYPES].sort());
    expect(EMBED_STATUSES.map((row) => row.kind)).toEqual([...EMBED_KINDS]);
    for (const row of EMBED_STATUSES.filter(
      (entry) => entry.kind === 'sheet' || entry.kind === 'canvas'
    ))
      expect(row.paints, row.kind).toMatch(/typed reference.*planned/);
    expect(PAGE).toContain('id="blocks"');
  });

  it('lists every slash menu item, content blocks included, each inserting a real block type', async () => {
    const items = await slashInventory();
    expect(items.length).toBeGreaterThan(40);
    expect(new Set(items.map((item) => item.group))).toEqual(
      new Set(['text', 'layout', 'pages', 'embeds', 'blocks'])
    );
    for (const item of items)
      expect(DOCUMENT_BLOCK_TYPES as readonly string[], item.label).toContain(item.creates);
    // Every type a person can insert from the menu is reachable; media comes from files and agents.
    const inserted = new Set(items.map((item) => item.creates));
    for (const type of DOCUMENT_BLOCK_TYPES.filter((entry) => entry !== 'media'))
      expect(inserted, type).toContain(type);
  });
});
