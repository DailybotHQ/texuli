import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALLOWLIST,
  checkTokenUsage,
  contractTokenNames,
  cssOf,
  literalMatches,
  maskContractFallbacks,
  scanStylesheet,
  stylesheetFiles,
} from '../check-token-usage.ts';

const CONTRACT = new Set(['--tx-primary', '--tx-border', '--tx-space-2', '--tx-chart-1']);
const found = (css: string, file = 'packages/x/src/x.css') =>
  scanStylesheet(file, css, CONTRACT).map(
    (f) => `${f.code} ${f.property}: ${f.literal} @${f.line}`
  );

describe('check-token-usage: what counts as a literal', () => {
  it('flags literal colors, but not the fallback of a contract token', () => {
    expect(
      found(`.a {
  color: #fff;
  background: rgb(0 0 0 / 0.5);
  border-color: var(--tx-border, #aab2bd);
  fill: var(--tx-chart-1, oklch(0.6 0.2 250));
  outline-color: var(--tx-made-up, #123456);
  caret-color: white;
  accent-color: var(--tx-primary, light-dark(#5b21b6, #c4b5fd));
  stroke: color-mix(in oklab, var(--tx-primary, Highlight) 30%, transparent);
  --local: var(--tx-primary, #2563eb);
  --edge: #000;
}`)
    ).toEqual([
      'literal-color color: #fff @2',
      'literal-color background: rgb(0 0 0 / 0.5) @3',
      'literal-color outline-color: #123456 @6',
      'literal-color caret-color: white @7',
      'literal-color --edge: #000 @11',
    ]);
  });

  it('flags px and rem in spacing, radius and font-size; relative units, zero and tokens pass', () => {
    expect(
      found(`.a {
  padding: 0.5rem 1em;
  margin-inline: -1px;
  gap: var(--tx-space-2);
  row-gap: calc(var(--tx-space-unit) * 1.5);
  border-radius: 6px;
  border-start-end-radius: 50%;
  font-size: 0.8125rem;
  font-size: 0.8em;
  padding-block: 0px;
  inline-size: 12rem;
  border: 1px solid;
  z-index: 3;
  z-index: 100;
  z-index: var(--tx-z-modal);
}`)
    ).toEqual([
      'literal-space padding: 0.5rem @2',
      'literal-space margin-inline: -1px @3',
      'literal-radius border-radius: 6px @6',
      'literal-font-size font-size: 0.8125rem @8',
      'literal-z-index z-index: 100 @14',
    ]);
  });

  it('reads only Svelte <style> blocks and ignores comments, keeping line numbers', () => {
    const svelte = `<script>
const color = '#fff';
</script>
<div style="padding: 3rem"></div>
<style>
  /* #000 in a comment */
  .a { color: #000; }
</style>`;
    expect(cssOf('a.svelte', svelte)).not.toContain("'#fff'");
    expect(found(svelte, 'packages/x/src/A.svelte')).toEqual(['literal-color color: #000 @7']);
  });

  it('masks only contract fallbacks, same length', () => {
    const value = 'var(--tx-primary, #fff) var(--tx-other, #000)';
    const masked = maskContractFallbacks(value, CONTRACT);
    expect(masked).toHaveLength(value.length);
    expect(masked).not.toContain('#fff');
    expect(masked).toContain('#000');
  });
});

describe('check-token-usage: the allowlist', () => {
  it('keeps listed literals per path and rule, matches *px by unit, and reports stale entries', () => {
    expect(literalMatches('*px', '24px')).toBe(true);
    expect(literalMatches('*px', '1.5rem')).toBe(false);
    expect(literalMatches('#FFF', '#fff')).toBe(true);
    const files = [
      {
        file: 'packages/m/src/L.svelte',
        source: '<style>.a { color: #fff; padding: 20px; }</style>',
      },
      { file: 'packages/m/src/b.css', source: '.b { color: #fff; }' },
    ];
    const report = checkTokenUsage(files, CONTRACT, [
      {
        path: 'packages/m/src/L.svelte',
        literals: ['#fff', '#000'],
        code: 'literal-color',
        reason: 'r',
      },
      { path: 'packages/m/src/', literals: ['*px'], code: 'literal-space', reason: 'r' },
    ]);
    expect(report.findings.map((f) => `${f.file} ${f.literal}`)).toEqual([
      'packages/m/src/b.css #fff',
    ]);
    expect(report.allowed).toBe(2);
    expect(report.stale).toEqual(['packages/m/src/L.svelte #000']);
  });

  it('gives every allowlist entry a reason', () => {
    for (const entry of ALLOWLIST) {
      expect(entry.reason.length, entry.path).toBeGreaterThan(20);
      expect(entry.literals.length, entry.path).toBeGreaterThan(0);
    }
  });
});

describe('check-token-usage: the repository', () => {
  it('finds no literal outside the allowlist and no stale entry in any package stylesheet', async () => {
    const files = stylesheetFiles().map((file) => ({ file, source: readFileSync(file, 'utf8') }));
    expect(files.length).toBeGreaterThan(500);
    expect(files.some((f) => f.file.startsWith('packages/tokens/'))).toBe(false);
    const report = checkTokenUsage(files, await contractTokenNames());
    expect(report.findings).toEqual([]);
    expect(report.stale).toEqual([]);
  });
});
