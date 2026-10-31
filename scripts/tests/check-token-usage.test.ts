import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALLOWLIST,
  checkTokenUsage,
  componentTokenNames,
  contractTokenNames,
  cssOf,
  declaredTokenNames,
  definedTokenNames,
  forcedColorsBlocks,
  isDefinedName,
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

const ROLES = new Set([
  '--tx-surface',
  '--tx-surface-foreground',
  '--tx-foreground',
  '--tx-border',
  '--tx-destructive',
  '--tx-primary',
  '--tx-ring',
  '--tx-link',
  '--tx-shape-radius-lg',
]);
// Svelte and script sources hold template placeholders; build them without one here.
const DOLLAR = '$';
const DEFINED = new Set(['--tx-button-radius', '--tx-player-gap-size', '--tx-cohort-heat-*']);
const flagged = (css: string, file = 'packages/x/src/x.css') =>
  scanStylesheet(file, css, ROLES, DEFINED)
    .filter((f) => f.code === 'system-color' || f.code === 'unknown-token')
    .map((f) => `${f.code} ${f.property}: ${f.literal} @${f.line}`);

describe('check-token-usage: system colors and undefined names (T-ds-conformance)', () => {
  it('flags a system color that can render, but not in a contract fallback or a forced-colors block', () => {
    expect(
      flagged(`.a {
  background: Canvas;
  color: var(--tx-foreground, CanvasText);
  border-color: color-mix(in srgb, var(--tx-primary, Highlight) 30%, Canvas);
  outline-color: var(--tx-made-up, Highlight);
  grid-area: canvas;
  content: "Mark";
  --edge: ButtonText;
}
@media (forced-colors: active) {
  .a { border-color: CanvasText; color: LinkText; }
  @supports (color: red) { .b { background: Canvas; } }
}
@media (min-width: 40rem) and (forced-colors: active) {
  .c { outline-color: Highlight; }
}
.d { accent-color: AccentColor; }`)
    ).toEqual([
      'system-color background: Canvas @2',
      'system-color border-color: Canvas @4',
      'system-color outline-color: Highlight @5',
      'unknown-token outline-color: --tx-made-up @5',
      'system-color --edge: ButtonText @8',
      'system-color accent-color: AccentColor @17',
    ]);
  });

  it('finds the forced-colors blocks, nested braces included', () => {
    const css = '.a{} @media (forced-colors: active) { .b { color: red; } } .c{}';
    const [[from, to]] = forcedColorsBlocks(css) as [[number, number]];
    expect(css.slice(from, to)).toBe('@media (forced-colors: active) { .b { color: red; } }');
  });

  it('flags a --tx-* read nothing defines, unless it is a component token, declared, or a hook onto a role', () => {
    expect(
      flagged(`.a {
  border-radius: var(--tx-button-radius, var(--tx-shape-radius-lg));
  gap: var(--tx-player-gap-size);
  background: var(--tx-cohort-heat-3, var(--tx-surface));
  color: var(--tx-cohort-heat-3-text, var(--tx-foreground));
  border-inline-start-color: var(--tx-workflow-accent, var(--tx-primary, CanvasText));
  inline-size: var(--tx-sidebar-width, 16rem);
  font-weight: var(--tx-font-weight-semibold);
  color: var(--tx-danger, var(--tx-destructive));
}`)
    ).toEqual([
      'unknown-token inline-size: --tx-sidebar-width @7',
      'unknown-token font-weight: --tx-font-weight-semibold @8',
    ]);
    // Without the defined names, the rule is off (the literal rules still run).
    expect(
      scanStylesheet('packages/x/src/x.css', '.a { gap: var(--tx-nope); }', ROLES).map(
        (f) => f.code
      )
    ).toEqual([]);
  });

  it('collects declared names: CSS declarations, style directives, setProperty and templated families', () => {
    const names = declaredTokenNames([
      { source: '.a { --tx-player-gap-size: 1rem; }' },
      {
        source: `<div style:--tx-pages-caret-color={c} style="--tx-swatch-color: ${DOLLAR}{v}"></div>`,
      },
      {
        source: `node.style.setProperty('--tx-chart-hover', v); node.style.setProperty(\`--tx-cohort-heat-${DOLLAR}{i}\`, s);`,
      },
    ]);
    expect([...names].sort()).toEqual([
      '--tx-chart-hover',
      '--tx-cohort-heat-*',
      '--tx-pages-caret-color',
      '--tx-player-gap-size',
      '--tx-swatch-color',
    ]);
    expect(isDefinedName('--tx-cohort-heat-9-text', names)).toBe(true);
    expect(isDefinedName('--tx-cohort', names)).toBe(false);
    expect(componentTokenNames().has('--tx-button-radius')).toBe(true);
    expect(definedTokenNames([]).has('--tx-button-radius')).toBe(true);
  });

  it('fails on the reads the first conformance run reported, and passes on their fixes', async () => {
    const contract = await contractTokenNames();
    const defined = definedTokenNames([]);
    const codes = (file: string, css: string) =>
      scanStylesheet(file, css, contract, defined).map((f) => `${f.code} ${f.literal}`);
    // packages/player/src/player.css: cards, slides and tiles, and the danger accents.
    expect(
      codes(
        'packages/player/src/player.css',
        `.tx-player-layout--card { background: var(--tx-card, Canvas); }
.tx-player__badge[data-status="invalid"] { border-color: var(--tx-danger, Mark); }`
      )
    ).toEqual([
      'system-color Canvas',
      'unknown-token --tx-card',
      'system-color Mark',
      'unknown-token --tx-danger',
    ]);
    expect(
      codes(
        'packages/player/src/player.css',
        `.tx-player-layout--card { background: var(--tx-surface, Canvas); color: var(--tx-surface-foreground, CanvasText); }
.tx-player__badge[data-status="invalid"] { border-color: var(--tx-destructive, Mark); }`
      )
    ).toEqual([]);
    // packages/data/src/dashboard/Dashboard.svelte: the widget.
    expect(
      codes(
        'packages/data/src/dashboard/Dashboard.svelte',
        '<style>.w { background: var(--tx-card, Canvas); color: var(--tx-card-foreground, CanvasText); }</style>'
      )
    ).toEqual([
      'system-color Canvas',
      'unknown-token --tx-card',
      'system-color CanvasText',
      'unknown-token --tx-card-foreground',
    ]);
    // packages/blocks: the structure block and the link preview.
    expect(
      codes(
        'packages/blocks/src/structure/structure.css',
        '.c { border: 1px solid var(--tx-color-border, CanvasText); outline: 2px solid var(--tx-color-ring, Highlight); }'
      )
    ).toEqual([
      'system-color CanvasText',
      'unknown-token --tx-color-border',
      'system-color Highlight',
      'unknown-token --tx-color-ring',
    ]);
    expect(
      codes(
        'packages/blocks/src/embed/LinkPreview.svelte',
        '<style>a { color: var(--tx-color-link, LinkText); } .p { border-color: var(--tx-border, ButtonBorder); } a { color: var(--tx-link, LinkText); }</style>'
      )
    ).toEqual(['system-color LinkText', 'unknown-token --tx-color-link']);
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
    const report = checkTokenUsage(
      files,
      await contractTokenNames(),
      ALLOWLIST,
      definedTokenNames()
    );
    expect(report.findings).toEqual([]);
    expect(report.stale).toEqual([]);
  });
});
