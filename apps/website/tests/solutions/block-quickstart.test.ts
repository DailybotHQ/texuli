import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorkflow } from '@texuli/workflows/model';
import { compile as compileSvelte } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { copyQuickstartSample } from '../../src/components/solutions/shared/quickstart/copy.ts';
import type {
  SolutionCodeSample,
  SolutionQuickstartProps,
} from '../../src/components/solutions/shared/types.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');
const testPath = 'apps/website/tests/solutions/block-quickstart.test.ts';

const quickstart: SolutionQuickstartProps = {
  entry: getSolution('workflows'),
  title: 'Start with a workflow graph',
  install: {
    label: 'Install',
    language: 'bash',
    code: 'pnpm add @texuli/workflows',
  },
  samples: [
    {
      label: 'Create a graph',
      language: 'ts',
      code: `import { createWorkflow } from '@texuli/workflows/model';\n\nconst graph = createWorkflow();`,
    },
    {
      label: 'Render a component',
      language: 'svelte',
      code: `<script lang="ts">\n  let count = $state(0);\n</script>\n\n<button onclick={() => count++}>Count: {count}</button>`,
    },
    {
      label: 'Graph data',
      language: 'json',
      code: '{"nodes": [], "edges": []}',
    },
  ],
  verifiedBy: testPath,
};

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
        filename: 'quickstart-sample.svelte',
        generate: 'client',
      });
      expect(result.warnings).toEqual([]);
      expect(result.js.code.trim()).not.toBe('');
      return;
    }
    case 'json':
      expect(JSON.parse(sample.code)).toBeDefined();
      return;
    case 'md':
      expect(sample.code.trim()).not.toBe('');
  }
}

describe('Solution quickstart block', () => {
  it('uses the shared quickstart contract and renders code as escaped text with an explicit verification citation', () => {
    const component = read('src/components/solutions/shared/quickstart/Quickstart.astro');
    expect(quickstart.entry.slug).toBe('workflows');
    expect(quickstart.verifiedBy).toBe(testPath);
    expect(readFileSync(resolve(WEBSITE, '../../', testPath), 'utf8')).toContain(
      'function compileSample'
    );
    expect(component).toContain('SolutionQuickstartProps');
    expect(component).toContain('<pre><code');
    expect(component).toContain('{sample.code}');
    expect(component).toContain('Verified by <code>{verifiedBy}</code>');
    expect(component).toContain('role="status"');
    expect(component).not.toMatch(/\{@html|innerHTML/);
  });

  it('compiles or parses every documented sample fixture', () => {
    for (const sample of [quickstart.install, ...quickstart.samples]) {
      expect(() => compileSample(sample), sample.label).not.toThrow();
    }
    expect(createWorkflow().nodes).toEqual([]);
  });

  it('copies sample text through the local clipboard seam and reports failures', async () => {
    const reports: string[] = [];
    const copied: string[] = [];
    await copyQuickstartSample(
      'const answer = 42;',
      async (text) => {
        copied.push(text);
      },
      (message) => reports.push(message)
    );
    expect(copied).toEqual(['const answer = 42;']);
    expect(reports).toEqual(['Code copied.']);

    await copyQuickstartSample(
      'blocked',
      async () => Promise.reject(new Error('blocked')),
      (message) => reports.push(message)
    );
    expect(reports.at(-1)).toBe('Copy failed: your browser blocked the clipboard.');
  });
});
