import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { documentToMarkdown } from '@texuli/document/markdown';
import { createDocument, paragraphBlock } from '@texuli/document/model';
import { applyOperations } from '@texuli/document/ops';
import { loadUntrustedDocument } from '@texuli/document/schema';
import { PageEditor } from '@texuli/pages/editor';
import { compile as compileSvelte } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENTS_CREATE_SAMPLE,
  DOCUMENTS_EDITOR_SAMPLE,
  DOCUMENTS_INSTALL,
  DOCUMENTS_JSON,
  DOCUMENTS_LOAD_SAMPLE,
  DOCUMENTS_QUICKSTART_VERIFIED_BY,
  documentsQuickstart,
} from '../../src/components/solutions/documents/quickstart/samples.ts';
import type { SolutionCodeSample } from '../../src/components/solutions/shared/types.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');

function compileSample(sample: SolutionCodeSample): void {
  switch (sample.language) {
    case 'bash':
      execFileSync('bash', ['-n'], { input: sample.code, encoding: 'utf8' });
      return;
    case 'ts': {
      const result = ts.transpileModule(sample.code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          strict: true,
        },
        reportDiagnostics: true,
      });
      expect(result.diagnostics ?? []).toEqual([]);
      expect(result.outputText.trim()).not.toBe('');
      return;
    }
    case 'svelte': {
      const result = compileSvelte(sample.code, {
        filename: 'documents-quickstart.svelte',
        generate: 'client',
      });
      expect(result.warnings).toEqual([]);
      expect(result.js.code.trim()).not.toBe('');
      return;
    }
    default:
      throw new Error(`unexpected language ${sample.language}`);
  }
}

describe('Documents quickstart', () => {
  it('feeds the shared Quickstart block with real document, pages and editor exports', () => {
    const entry = getSolution('documents');
    const props = documentsQuickstart(entry);
    expect(props.entry.slug).toBe('documents');
    expect(props.install.code).toBe(DOCUMENTS_INSTALL);
    expect(props.verifiedBy).toBe(DOCUMENTS_QUICKSTART_VERIFIED_BY);
    expect(props.samples.map((sample) => sample.language)).toEqual(['ts', 'ts', 'svelte']);
    const layout = read('src/components/solutions/documents/quickstart/DocumentsQuickstart.astro');
    expect(layout).toContain('Quickstart.astro');
    expect(layout).toContain('documentsQuickstart');
    expect(layout).not.toMatch(/PLAN_015|\/documents-page\//);
  });

  it('compiles every sample and runs the same calls against workspace packages', () => {
    const props = documentsQuickstart(getSolution('documents'));
    for (const sample of [props.install, ...props.samples]) {
      expect(() => compileSample(sample), sample.label).not.toThrow();
    }

    expect(DOCUMENTS_CREATE_SAMPLE).toContain("from '@texuli/document/model'");
    expect(DOCUMENTS_CREATE_SAMPLE).toContain("from '@texuli/document/ops'");
    expect(DOCUMENTS_LOAD_SAMPLE).toContain("from '@texuli/document/schema'");
    expect(DOCUMENTS_EDITOR_SAMPLE).toContain("from '@texuli/pages/editor'");

    const created = createDocument({
      meta: { title: 'Release notes' },
      blocks: [paragraphBlock('p1', 'Shipped the new editor.')],
    });
    const edit = applyOperations(created, [
      { op: 'insert-text', id: 'p1', offset: 0, text: 'Today: ' },
    ]);
    expect(edit.ok).toBe(true);
    if (edit.ok) expect(documentToMarkdown(edit.document)).toContain('Today:');

    const loaded = loadUntrustedDocument(DOCUMENTS_JSON);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.document.blocks.map((block) => block.id)).toEqual(['p1']);

    expect(typeof PageEditor).toBe('function');
  });
});
