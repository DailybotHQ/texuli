import { describe, expect, it } from 'vitest';
import {
  checkRepositoryCss,
  classIsReferenced,
  findDeadCss,
  findUnusedClasses,
  parseCssRules,
} from '../check-css.ts';

const codes = (css: string) => findDeadCss('x.css', css).map((f) => `${f.code}@${f.line}`);

describe('check-css parsing', () => {
  it('reads rules with their at-rule context and ignores braces in comments and strings', () => {
    const rules = parseCssRules(`/* { not a rule } */
@layer tx.components {
  .a { content: "}"; color: red; }
  @media (forced-colors: active) {
    .a, .b { color: CanvasText !important; }
  }
}
@import "x.css";`);
    expect(rules.map((r) => [r.context, r.selector])).toEqual([
      ['@layer tx.components', '.a'],
      ['@layer tx.components > @media (forced-colors: active)', '.a, .b'],
    ]);
    expect(rules[0]?.declarations.map((d) => [d.prop, d.value])).toEqual([
      ['content', '"}"'],
      ['color', 'red'],
    ]);
    expect(rules[1]?.declarations[0]).toMatchObject({ value: 'CanvasText', important: true });
  });
});

describe('check-css dead CSS', () => {
  it('finds a repeated declaration, an identical rule and a shadowed declaration', () => {
    expect(codes('.a {\n  color: red;\n  color: red;\n}')).toEqual(['duplicate-declaration@3']);
    expect(codes('.a { margin: 0; }\n.b { margin: 1px; }\n.a { margin: 0; }')).toEqual([
      'duplicate-rule@3',
    ]);
    expect(codes('.a {\n  color: red;\n  margin: 0;\n}\n.a {\n  color: blue;\n}')).toEqual([
      'shadowed-declaration@2',
    ]);
    // Selector lists match regardless of order and spacing.
    expect(codes('.a, .b { color: red; }\n.b,.a { color: blue; }')).toEqual([
      'shadowed-declaration@1',
    ]);
  });

  it('keeps fallbacks, contexts and !important apart', () => {
    // A fallback pair (different values in one rule) is intentional.
    expect(codes('.a { color: red; color: oklch(60% 0.1 20); }')).toEqual([]);
    // The same selector in another at-rule context is a separate rule.
    expect(codes('.a { color: red; }\n@media print { .a { color: black; } }')).toEqual([]);
    // A later normal declaration does not override an earlier !important one.
    expect(codes('.a { color: red !important; }\n.a { color: blue; }')).toEqual([]);
  });
});

describe('check-css unused classes', () => {
  const corpus = [
    '<div class="tx-card tx-card--{variant}">',
    // A JavaScript template literal, written as data here.
    'const cls = `tx-chip--$' + '{size}`;',
    "cx('tx-tag--' + tone)",
    'style="var(--tx-chart-{index})"',
  ].join('\n');

  it('accepts literal classes and template-built ones', () => {
    expect(classIsReferenced('tx-card', corpus)).toBe(true);
    expect(classIsReferenced('tx-card--compact', corpus)).toBe(true);
    expect(classIsReferenced('tx-chip--lg', corpus)).toBe(true);
    expect(classIsReferenced('tx-tag--danger', corpus)).toBe(true);
  });

  it('does not treat a custom property template as a class', () => {
    expect(classIsReferenced('tx-chart-legend__swatch', corpus)).toBe(false);
    expect(
      findUnusedClasses('x.css', '/* .tx-ghost */\n.tx-card {}\n.tx-ghost__part {}', corpus).map(
        (f) => `${f.code}@${f.line} ${f.message}`
      )
    ).toEqual(['unused-class@3 .tx-ghost__part is not produced by any source file.']);
  });
});

describe('repository stylesheets', () => {
  it('have no duplicate, shadowed or unreachable CSS', () => {
    const { files, findings } = checkRepositoryCss();
    expect(files).toBeGreaterThan(50);
    expect(findings.map((f) => `${f.file}:${f.line} ${f.code} ${f.message}`)).toEqual([]);
  });
});
