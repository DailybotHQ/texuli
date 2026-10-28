// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  MATH_ATTRIBUTES,
  MATH_LIMITS,
  MATH_TAGS,
  type MathNode,
  mathText,
  texToMath,
} from '../src/math/index.ts';

function walk(node: MathNode, visit: (node: MathNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function ok(tex: string, display = false): MathNode {
  const result = texToMath(tex, { display });
  expect(result.issues).toEqual([]);
  expect(result.ok).toBe(true);
  return result.node;
}

describe('deck math: the owned TeX subset', () => {
  it('builds a MathML tree for tokens, scripts and fractions', () => {
    expect(ok('x_1^2 + 3.5')).toEqual({
      tag: 'math',
      attrs: { display: 'inline' },
      children: [
        {
          tag: 'msubsup',
          children: [
            { tag: 'mi', text: 'x' },
            { tag: 'mn', text: '1' },
            { tag: 'mn', text: '2' },
          ],
        },
        { tag: 'mo', text: '+' },
        { tag: 'mn', text: '3.5' },
      ],
    });
    expect(ok('\\frac{a}{b}', true).children).toEqual([
      {
        tag: 'mfrac',
        children: [
          { tag: 'mi', text: 'a' },
          { tag: 'mi', text: 'b' },
        ],
      },
    ]);
  });

  it.each([
    ['e^{i\\pi} + 1 = 0', 'eiπ+1=0'],
    ['\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', '−b±b2−4ac2a'],
    ['\\sqrt[3]{x}', 'x3'],
    ['\\sum_{i=1}^{n} i^2', '∑i=1ni2'],
    ['\\int_0^\\infty e^{-x}\\,dx', '∫0∞e−xdx'],
    ['\\lim_{x \\to 0} \\frac{\\sin x}{x}', 'limx→0sinxx'],
    ['\\alpha + \\Beta', ''],
    ['\\left( \\frac{1}{2} \\right]', '(12]'],
    ['\\binom{n}{k}', '(nk)'],
    ['\\hat{x} \\vec{v} \\overline{AB} \\underbrace{abc}', 'x^v→AB‾abc⏟'],
    ['\\mathbb{R}^n \\mathbf{v} \\mathcal{L}', 'RnvL'],
    ['\\text{if } x \\ne 0', 'if x≠0'],
    ['\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', '(abcd)'],
    [
      'f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & \\text{otherwise} \\end{cases}',
      'f(x)={1x>00otherwise',
    ],
    ['a \\le b \\leq c \\ge d \\approx e \\in A \\subseteq B \\Rightarrow C', 'a≤b≤c≥d≈e∈A⊆B⇒C'],
    ["f'(x) \\not= g''", 'f′(x)≠g′′'],
    ['\\operatorname{rank} A', 'rankA'],
    ['x \\quad y \\qquad z % a comment', 'xyz'],
  ])('%s', (tex, text) => {
    const result = texToMath(tex, { display: true });
    if (text === '') {
      expect(result.ok).toBe(false);
      return;
    }
    expect(result.issues).toEqual([]);
    expect(mathText(result.node)).toBe(text);
  });

  it('puts limits under big operators in display math only', () => {
    expect(ok('\\sum_{i}^{n}', true).children?.[0]?.tag).toBe('munderover');
    expect(ok('\\sum_{i}^{n}').children?.[0]?.tag).toBe('msubsup');
    expect(ok('\\int_0^1', true).children?.[0]?.tag).toBe('msubsup');
  });

  it('only emits allowlisted tags and attributes, from its own tables', () => {
    const node = ok(
      '\\left\\{ \\begin{aligned} a &= \\frac{\\sqrt[3]{x}}{\\mathbb{R}} \\\\ b &= \\overbrace{x}^{n} \\end{aligned} \\right. \\dfrac{1}{2} \\binom{a}{b}',
      true
    );
    walk(node, (item) => {
      expect(MATH_TAGS).toContain(item.tag);
      for (const name of Object.keys(item.attrs ?? {})) expect(MATH_ATTRIBUTES).toContain(name);
    });
  });

  it.each([
    ['\\href{javascript:alert(1)}{x}', 'tex-unsupported'],
    ['\\url{https://example.com}', 'tex-unsupported'],
    ['\\color{red}{x}', 'tex-unsupported'],
    ['\\textcolor{red}{x}', 'tex-unsupported'],
    ['\\htmlClass{evil}{x}', 'tex-unsupported'],
    ['\\htmlStyle{color:red}{x}', 'tex-unsupported'],
    ['\\def\\x{1}', 'tex-unsupported'],
    ['\\newcommand{\\x}{1}', 'tex-unsupported'],
    ['\\includegraphics{a.png}', 'tex-unsupported'],
    ['\\input{file}', 'tex-unsupported'],
    ['\\unknowncommand', 'tex-unsupported'],
    ['\\begin{tikzpicture}\\end{tikzpicture}', 'tex-unsupported'],
    ['\\text{\\href{x}{y}}', 'tex-unsupported'],
    ['x^2^3', 'tex-syntax'],
    ['x_1_2', 'tex-syntax'],
    ['{x', 'tex-syntax'],
    ['x}', 'tex-syntax'],
    ['\\frac{1}', 'tex-syntax'],
    ['\\left( x', 'tex-syntax'],
    ['\\right)', 'tex-syntax'],
    ['\\begin{matrix} a', 'tex-syntax'],
    ['\\begin{matrix} a \\end{pmatrix}', 'tex-syntax'],
    ['a & b', 'tex-syntax'],
    ['#1', 'tex-syntax'],
    ['$x$', 'tex-syntax'],
  ])('refuses %s', (tex, code) => {
    const result = texToMath(tex);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([code]);
    // The fallback shows the source as text.
    expect(result.node).toEqual({
      tag: 'math',
      attrs: { display: 'inline' },
      children: [{ tag: 'mtext', text: tex }],
    });
  });

  it('bounds source length, nesting and output nodes', () => {
    expect(texToMath('x'.repeat(MATH_LIMITS.source + 1)).issues[0]?.code).toBe('tex-limit');
    expect(
      texToMath(`${'{'.repeat(MATH_LIMITS.depth + 1)}x${'}'.repeat(MATH_LIMITS.depth + 1)}`)
        .issues[0]?.code
    ).toBe('tex-limit');
    expect(texToMath('\\frac'.repeat(20) + '{1}{2}'.repeat(20)).ok).toBe(false);
    const cells = `\\begin{matrix}${Array.from({ length: 60 }, () => 'a').join(' \\\\ ')}\\end{matrix}`;
    expect(texToMath(cells).issues[0]?.code).toBe('tex-limit');
    const start = performance.now();
    for (let i = 0; i < 200; i++) texToMath('\\frac{a}{b}+'.repeat(150));
    expect(performance.now() - start).toBeLessThan(1_000);
  });

  it('never throws on arbitrary input', () => {
    for (const tex of [
      '\\',
      '\\\\',
      '^',
      '_',
      '{}',
      '\\left',
      '\\begin',
      '\\sqrt[',
      '\\text{',
      '\\not',
      '\\operatorname{1}',
      '\u0000',
    ]) {
      expect(() => texToMath(tex)).not.toThrow();
    }
  });
});
