import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CanvasEditor } from '@texuli/canvas/editor';
import { applyCanvasOps, createCanvas, loadUntrustedCanvas } from '@texuli/canvas/model';
import { compile as compileSvelte } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  CANVAS_CREATE_SAMPLE,
  CANVAS_EDITOR_SAMPLE,
  CANVAS_INSTALL,
  CANVAS_JSON,
  CANVAS_LOAD_SAMPLE,
  CANVAS_QUICKSTART_VERIFIED_BY,
  canvasQuickstart,
} from '../../src/components/solutions/canvas/quickstart/samples.ts';
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
        filename: 'canvas-quickstart.svelte',
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

describe('Canvas quickstart', () => {
  it('feeds the shared Quickstart block with real canvas exports', () => {
    const entry = getSolution('canvas');
    const props = canvasQuickstart(entry);
    expect(props.entry.slug).toBe('canvas');
    expect(props.install.code).toBe(CANVAS_INSTALL);
    expect(props.verifiedBy).toBe(CANVAS_QUICKSTART_VERIFIED_BY);
    expect(props.samples.map((sample) => sample.language)).toEqual(['ts', 'ts', 'svelte']);
    const layout = read('src/components/solutions/canvas/quickstart/CanvasQuickstart.astro');
    expect(layout).toContain('Quickstart.astro');
    expect(layout).toContain('canvasQuickstart');
    expect(layout).not.toMatch(/PLAN_015|\/solutions\/canvas\/|\/canvas-page\//);
  });

  it('compiles every sample and runs the same calls against workspace packages', () => {
    const props = canvasQuickstart(getSolution('canvas'));
    for (const sample of [props.install, ...props.samples]) {
      expect(() => compileSample(sample), sample.label).not.toThrow();
    }

    expect(CANVAS_CREATE_SAMPLE).toContain("from '@texuli/canvas/model'");
    expect(CANVAS_LOAD_SAMPLE).toContain('loadUntrustedCanvas');
    expect(CANVAS_EDITOR_SAMPLE).toContain("from '@texuli/canvas/editor'");

    const created = createCanvas({ title: 'Launch plan' });
    const added = applyCanvasOps(created, [
      {
        op: 'add',
        shape: {
          id: 'ship',
          type: 'sticky',
          x: 0,
          y: 0,
          width: 160,
          height: 160,
          text: 'Ship',
        },
      },
    ]);
    expect(added.ok).toBe(true);
    if (added.ok) expect(added.doc.shapes.map((shape) => shape.id)).toEqual(['ship']);

    const loaded = loadUntrustedCanvas(CANVAS_JSON);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.canvas.shapes[0]?.id).toBe('ship');

    expect(typeof CanvasEditor).toBe('function');
  });
});
