import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FRAME_PATH =
  'apps/website/src/components/solutions/shared/demo-frame/SolutionDemoFrame.astro';
const FRAME = readFileSync(resolve(FRAME_PATH), 'utf8');

describe('Solution demo frame markup contract', () => {
  it('uses the typed frame props and exposes separate named demo and SSR preview slots', () => {
    expect(FRAME).toContain("import type { SolutionDemoFrameProps } from '../types.ts'");
    expect(FRAME).toContain('Astro.props as SolutionDemoFrameProps');
    expect(FRAME).toContain('<slot name="demo" />');
    expect(FRAME).toContain('<slot name="preview" />');
    expect(FRAME).toContain('static preview');
    expect(FRAME).toContain('data-tx-solution-demo={entry.slug}');
  });

  it('provides a labelled demo region, try-this actions, reset guidance and optional source chrome', () => {
    expect(FRAME).toContain('aria-label={label}');
    expect(FRAME).toContain('aria-label="Try this"');
    expect(FRAME).toContain('{tryThis.map((action) => <li>{action}</li>)}');
    expect(FRAME).toContain('Use Reset to return to the starting example.');
    expect(FRAME).toContain("Astro.slots.has('source')");
    expect(FRAME).toContain('<summary>View source</summary>');
    expect(FRAME).toContain('<slot name="actions" />');
  });

  it('keeps the shell static, supplies fallback markup and exposes a budget probe', () => {
    expect(FRAME).toContain('<slot name="error">');
    expect(FRAME).toContain('role="status"');
    expect(FRAME).toContain('<noscript>');
    expect(FRAME).toContain('data-tx-demo-budget-probe={entry.slug}');
    expect(FRAME).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(FRAME).not.toMatch(/client:(?:load|idle|visible|media|only)/);
    expect(FRAME).not.toMatch(/<script\b|\{@html|innerHTML|PLAN_015|T-f-block-demo-frame/);
  });
});
