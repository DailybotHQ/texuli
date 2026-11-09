import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDeckMarkdown } from '@texuli/deck/markdown';
import { parseDeck } from '@texuli/deck/model';
import { DeckStage, validateDeckBlock } from '@texuli/slides/stage';
import { compile as compileSvelte } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { SolutionCodeSample } from '../../src/components/solutions/shared/types.ts';
import {
  SLIDES_INSTALL,
  SLIDES_JSON_DECK,
  SLIDES_MARKDOWN_DECK,
  SLIDES_PARSE_JSON_SAMPLE,
  SLIDES_PARSE_MARKDOWN_SAMPLE,
  SLIDES_QUICKSTART_VERIFIED_BY,
  SLIDES_STAGE_SAMPLE,
  slidesQuickstart,
} from '../../src/components/solutions/slides/quickstart/samples.ts';
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
        filename: 'slides-quickstart.svelte',
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

describe('Slides quickstart', () => {
  it('feeds the shared Quickstart block with real deck and slides exports', () => {
    const entry = getSolution('slides');
    const props = slidesQuickstart(entry);
    expect(props.entry.slug).toBe('slides');
    expect(props.install.code).toBe(SLIDES_INSTALL);
    expect(props.verifiedBy).toBe(SLIDES_QUICKSTART_VERIFIED_BY);
    expect(props.samples.map((sample) => sample.language)).toEqual(['ts', 'ts', 'svelte']);
    const layout = read('src/components/solutions/slides/quickstart/SlidesQuickstart.astro');
    expect(layout).toContain('Quickstart.astro');
    expect(layout).toContain('slidesQuickstart');
    expect(layout).not.toMatch(/PLAN_015|\/solutions\/slides\//);
  });

  it('compiles every sample and runs the same calls against workspace packages', () => {
    const props = slidesQuickstart(getSolution('slides'));
    for (const sample of [props.install, ...props.samples]) {
      expect(() => compileSample(sample), sample.label).not.toThrow();
    }

    expect(SLIDES_PARSE_JSON_SAMPLE).toContain("from '@texuli/deck/model'");
    expect(SLIDES_PARSE_MARKDOWN_SAMPLE).toContain("from '@texuli/deck/markdown'");
    expect(SLIDES_STAGE_SAMPLE).toContain("from '@texuli/slides/stage'");

    const json = parseDeck(SLIDES_JSON_DECK);
    expect(json.ok).toBe(true);
    if (json.ok)
      expect(json.deck?.slides.map((slide) => slide.id)).toEqual(['opening', 'adoption']);

    const markdown = parseDeckMarkdown(SLIDES_MARKDOWN_DECK, { validateBlock: validateDeckBlock });
    expect(markdown.ok).toBe(true);
    if (markdown.ok) expect(markdown.deck?.slides[0]?.id).toBe('opening');

    expect(typeof DeckStage).toBe('function');
  });
});
