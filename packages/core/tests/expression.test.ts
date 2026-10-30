// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  analyzeExpression,
  CORE_FUNCTIONS,
  createExpressionBudget,
  daysToIsoDate,
  EXPRESSION_LIMITS,
  EXPRESSION_OPS,
  type Expression,
  type ExpressionEnv,
  type ExpressionFunctionTable,
  type ExpressionNode,
  evaluateExpression,
  formatExpression,
  isExpressionError,
  isoDateToDays,
  isTrue,
  parseExpression,
  parseExpressionText,
} from '../src/expression/index.ts';

const compile = (input: unknown): Expression => {
  const result = parseExpression(input);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.expression;
};
const text = (source: string): Expression => {
  const result = parseExpressionText(source);
  if (!result.ok) throw new Error(`${source}: ${JSON.stringify(result.diagnostics)}`);
  return result.expression;
};
const fields = (values: Record<string, unknown>): ExpressionEnv => ({
  field: (name) => (Object.hasOwn(values, name) ? values[name] : undefined),
});
const run = (source: string, values: Record<string, unknown> = {}) =>
  evaluateExpression(text(source), fields(values));

/** A left-deep chain of `count` nodes: not(not(…(true))). */
function nested(depth: number): unknown {
  let node: unknown = { op: 'bool', value: true };
  for (let i = 1; i < depth; i += 1) node = { op: 'not', value: node };
  return node;
}

describe('the JSON AST', () => {
  it('accepts the blueprint spec numberFormula and condition shapes unchanged', () => {
    const formula = {
      op: 'if',
      test: {
        op: 'and',
        args: [
          { op: 'gte', left: { op: 'var', name: 'seats' }, right: { op: 'num', value: 10 } },
          {
            op: 'not',
            value: { op: 'eq', left: { op: 'var', name: 'plan' }, right: { op: 'num', value: 0 } },
          },
        ],
      },
      ifTrue: {
        op: 'round',
        value: {
          op: 'mul',
          left: { op: 'var', name: 'seats' },
          right: { op: 'num', value: 7.255 },
        },
        digits: 2,
      },
      ifFalse: {
        op: 'clamp',
        value: { op: 'pow', base: { op: 'num', value: 2 }, exponent: { op: 'var', name: 'seats' } },
        min: { op: 'num', value: 0 },
        max: {
          op: 'max',
          args: [
            { op: 'num', value: 3 },
            { op: 'num', value: 50 },
          ],
        },
      },
    };
    const expression = compile(formula);
    expect(expression.fields).toEqual(['plan', 'seats']);
    expect(evaluateExpression(expression, fields({ seats: 12, plan: 1 }))).toBe(87.06);
    expect(evaluateExpression(expression, fields({ seats: 3, plan: 1 }))).toBe(8);
    expect(Object.isFrozen(expression.ast)).toBe(true);
  });

  it('refuses each malformed node with its code and path', () => {
    const cases: [unknown, string, string][] = [
      [42, 'not-a-node', '$'],
      [{ op: 'eval', value: 'x' }, 'unknown-op', '$.op'],
      [{ op: 'num', value: 1, code: 'x' }, 'unknown-member', '$.code'],
      [{ op: 'add', left: { op: 'num', value: 1 } }, 'missing-member', '$.right'],
      [{ op: 'num', value: Number.POSITIVE_INFINITY }, 'bad-member', '$.value'],
      [{ op: 'field', name: 'a-b' }, 'bad-name', '$.name'],
      [{ op: 'field', name: '__proto__x'.repeat(10) }, 'bad-name', '$.name'],
      [{ op: 'call', fn: 'fetch', args: [] }, 'unknown-function', '$.fn'],
      [{ op: 'call', fn: 'len', args: [] }, 'arity', '$.args'],
      [{ op: 'ref', ref: 'A1' }, 'refs-disabled', '$.ref'],
      [{ op: 'and', args: [] }, 'bad-member', '$.args'],
      [{ op: 'round', value: { op: 'num', value: 1 }, digits: 99 }, 'bad-member', '$.digits'],
      [{ op: 'str', value: 'x'.repeat(EXPRESSION_LIMITS.stringLength + 1) }, 'too-long', '$.value'],
    ];
    for (const [input, code, path] of cases) {
      const result = parseExpression(input);
      expect(result.ok, JSON.stringify(input).slice(0, 60)).toBe(false);
      expect(result.diagnostics[0]?.code).toBe(code);
      expect(result.diagnostics[0]?.path).toBe(path);
    }
  });

  it('lists every op once', () => {
    expect(new Set(EXPRESSION_OPS).size).toBe(EXPRESSION_OPS.length);
    expect(EXPRESSION_OPS).toEqual(
      expect.arrayContaining(['field', 'call', 'ref', 'range', 'concat'])
    );
  });
});

describe('the text form', () => {
  it('parses precedence, associativity and calls into the AST', () => {
    const cases: [string, unknown][] = [
      ['1 + 2 * 3', 7],
      ['(1 + 2) * 3', 9],
      ['2 ^ 3 ^ 2', 512],
      ['-2 ^ 2', -4],
      ['10 - 4 - 3', 3],
      ['7 % 3', 1],
      ['-7 % 3', 2],
      ['"a" & 1 & true', 'a1true'],
      ['not true or true', true],
      ['true and not false', true],
      ['1 < 2 == true', 'syntax'],
      ['if(1 > 2, "big", "small")', 'small'],
      ['round(2.345, 2)', 2.35],
      ['round(1234, -2)', 1200],
      ['clamp(12, 0, 10)', 10],
      ['min(3, 1, 2) + max(4, 9)', 10],
      ["'it\\'s' == \"it's\"", true],
      ['len(trim("  hi  "))', 2],
      ['1 <> 2 && 2 = 2', true],
    ];
    for (const [source, expected] of cases) {
      if (expected === 'syntax') {
        expect(parseExpressionText(source).diagnostics[0]?.code).toBe('syntax');
        continue;
      }
      expect(run(source), source).toEqual(expected);
    }
  });

  it('reports syntax errors at their offset', () => {
    const cases: [string, string, string][] = [
      ['1 +', 'syntax', '@3'],
      ['"open', 'syntax', '@0'],
      ['a $ b', 'syntax', '@2'],
      ['f(1', 'syntax', '@3'],
      ['round(1, x)', 'syntax', '@0'],
      ['if(1, 2)', 'arity', '@0'],
      ['and', 'syntax', '@0'],
      ['upload(1)', 'unknown-function', '$.fn'],
    ];
    for (const [source, code, path] of cases) {
      const result = parseExpressionText(source);
      expect(result.ok, source).toBe(false);
      expect(result.diagnostics[0]?.code, source).toBe(code);
      expect(result.diagnostics[0]?.path, source).toBe(path);
    }
  });

  it('prints ASTs back to text that evaluates the same', () => {
    const values = { a: 3, b: -2, name: 'Ada "Lovelace"', tags: ['x', 'y'], start: '2026-01-31' };
    const sources = [
      '(a + b) * 2 - a / (b - 1)',
      'a ^ (b + 4) % 5',
      '-(a - b)',
      'not (a > b and b > 0) or contains(lower(name), "ada")',
      'if(a == 3, concat(name, "!"), "no") & " " & len(tags)',
      'round(a / 7, 3) + clamp(b, 0, 1) + min(a, b)',
      'addDays(start, 1) > "2026-01-31" and daysBetween(start, "2026-03-01") == 29',
    ];
    for (const source of sources) {
      const once = text(source);
      const printed = formatExpression(once.ast);
      const twice = text(printed);
      expect(evaluateExpression(twice, fields(values)), printed).toEqual(
        evaluateExpression(once, fields(values))
      );
      expect(formatExpression(twice.ast)).toBe(printed);
    }
    expect(formatExpression(compile({ op: 'num', value: -3 }).ast)).toBe('(-3)');
  });

  it('flattens long and/or/& chains past the argument cap', () => {
    const source = Array.from({ length: 150 }, (_, i) => `f${i}`).join(' or ');
    const expression = text(source);
    expect(expression.ast.op).toBe('or');
    expect(expression.fields).toHaveLength(150);
    expect(evaluateExpression(expression, fields({ f149: true }))).toBe(true);
    expect(evaluateExpression(expression, fields({}))).toBe(null);
  });
});

describe('evaluation', () => {
  it('uses three-valued logic: empty operands are unknown and only true is true', () => {
    const cases: [string, Record<string, unknown>, unknown][] = [
      ['age >= 18', {}, null],
      ['age >= 18', { age: 20 }, true],
      ['not (age >= 18)', {}, null],
      ['age >= 18 and false', {}, false],
      ['age >= 18 or true', {}, true],
      ['age >= 18 and true', {}, null],
      ['age == null', {}, true],
      ['age != null', { age: 0 }, true],
      ['if(age > 1, 1, 2)', {}, 2],
      ['age + 1', {}, null],
    ];
    for (const [source, values, expected] of cases) {
      expect(run(source, values), source).toBe(expected);
    }
    expect(isTrue(run('age >= 18'))).toBe(false);
  });

  it('returns error values, never exceptions', () => {
    const cases: [string, Record<string, unknown>, string][] = [
      ['1 / 0', {}, '#DIV/0!'],
      ['1 % 0', {}, '#DIV/0!'],
      ['"a" + 1', {}, '#VALUE!'],
      ['"a" < 1', {}, '#VALUE!'],
      ['tags < 1', { tags: ['a'] }, '#VALUE!'],
      ['10 ^ 400', {}, '#NUM!'],
      ['2 ^ 100', {}, '#NUM!'],
      ['clamp(1, 5, 0)', {}, '#NUM!'],
      ['date(2026, 2, 30)', {}, '#NUM!'],
      ['today()', {}, '#N/A'],
      ['daysBetween("tomorrow", "2026-01-01")', {}, '#VALUE!'],
      ['(1 / 0) + 1 > 0 or true', {}, '#DIV/0!'],
    ];
    for (const [source, values, code] of cases) {
      const value = run(source, values);
      expect(isExpressionError(value), source).toBe(true);
      expect(value, source).toEqual({ error: code });
    }
    expect(
      evaluateExpression(
        compile({ op: 'call', fn: 'len', args: [{ op: 'num', value: 1 }] }),
        {},
        { functions: {} }
      )
    ).toEqual({ error: '#NAME?' });
  });

  it('runs every core function on a representative input', () => {
    const now = Date.UTC(2026, 9, 29, 15);
    const cases: [string, unknown][] = [
      ['len("héllo")', 5],
      ['len(tags)', 2],
      ['len(null)', 0],
      ['lower("AbC")', 'abc'],
      ['upper("AbC")', 'ABC'],
      ['trim("  a b  ")', 'a b'],
      ['contains("example.com", ".com")', true],
      ['startsWith("ticket-12", "ticket-")', true],
      ['endsWith("report.pdf", ".pdf")', true],
      ['isEmpty("   ")', true],
      ['isEmpty(tags)', false],
      ['coalesce(null, "", "fallback")', 'fallback'],
      ['includes(tags, "design")', true],
      ['count(tags)', 2],
      ['sum(scores)', 6],
      ['abs(-3)', 3],
      ['floor(2.7)', 2],
      ['ceil(2.1)', 3],
      ['number(" 12.5 ")', 12.5],
      ['number("12px")', { error: '#VALUE!' }],
      ['today()', '2026-10-29'],
      ['date(2024, 2, 29)', '2024-02-29'],
      ['isDate("2025-02-29")', false],
      ['daysBetween("2026-01-01", "2026-12-31")', 364],
      ['addDays("2026-02-27", 2)', '2026-03-01'],
      ['year("2026-10-29") * 10000 + month("2026-10-29") * 100 + day("2026-10-29")', 20261029],
      ['"2026-10-29" > "2026-09-30"', true],
    ];
    const used = new Set<string>();
    for (const [source, expected] of cases) {
      const expression = text(source);
      for (const name of expression.functions) used.add(name);
      const value = evaluateExpression(
        expression,
        {
          field: (name) => ({ tags: ['design', 'docs'], scores: [1, 2, 'x', 3] })[name],
          now: () => now,
        },
        {}
      );
      expect(value, source).toEqual(expected);
    }
    expect([...used].sort()).toEqual(Object.keys(CORE_FUNCTIONS).sort());
  });

  it('converts ISO days both ways across leap years and eras', () => {
    for (const day of ['0001-01-01', '1900-02-28', '2000-02-29', '2024-12-31', '9999-12-31']) {
      expect(daysToIsoDate(isoDateToDays(day) as number)).toBe(day);
    }
    expect(isoDateToDays('1970-01-01')).toBe(0);
    expect(isoDateToDays('2023-02-29')).toBe(null);
    expect(daysToIsoDate(isoDateToDays('9999-12-31')! + 1)).toBe(null);
  });

  it('normalizes outside values and caps their size', () => {
    expect(run('a', { a: Number.NaN })).toBe(null);
    expect(run('a', { a: { toString: () => 'x' } })).toEqual({ error: '#VALUE!' });
    expect(run('a', { a: 'x'.repeat(EXPRESSION_LIMITS.stringLength + 1) })).toEqual({
      error: '#LIMIT!',
    });
    expect(run('a', { a: new Array(EXPRESSION_LIMITS.listItems + 1).fill(1) })).toEqual({
      error: '#LIMIT!',
    });
    expect(run('a', { a: [[1]] })).toEqual({ error: '#VALUE!' });
    const thrower: ExpressionFunctionTable = {
      ...CORE_FUNCTIONS,
      boom: {
        minArgs: 0,
        maxArgs: 0,
        params: [],
        returns: 'any',
        call: () => {
          throw new Error('x');
        },
      },
    };
    const boom = parseExpressionText('boom()', { functions: thrower });
    expect(boom.ok && evaluateExpression(boom.expression, {}, { functions: thrower })).toEqual({
      error: '#VALUE!',
    });
  });
});

describe('static analysis', () => {
  it('infers types and reports misuse and unknown fields', () => {
    const declared = {
      age: 'number',
      email: 'string',
      tags: 'list',
      start: 'date',
      ok: 'boolean',
    } as const;
    const ok = [
      ['age >= 18 and ok', 'boolean'],
      ['len(email) > 3 or includes(tags, "x")', 'boolean'],
      ['start < "2026-01-01"', 'boolean'],
      ['concat(email, age)', 'string'],
      ['if(ok, age, null)', 'number'],
    ] as const;
    for (const [source, type] of ok) {
      const analysis = analyzeExpression(text(source), {
        fields: declared,
        expect: 'boolean' === type ? 'boolean' : 'any',
      });
      expect(analysis.diagnostics, source).toEqual([]);
      expect(analysis.type, source).toBe(type);
    }
    const bad: [string, string, string][] = [
      ['email + 1', 'type', '$.left'],
      ['tags > 1', 'type', '$'],
      ['lower(tags) == "x"', 'type', '$.left.args[0]'],
      ['phone == "1"', 'unknown-field', '$.left.name'],
      ['"text"', 'type', '$'],
    ];
    for (const [source, code, path] of bad) {
      const analysis = analyzeExpression(text(source), { fields: declared, expect: 'boolean' });
      expect(analysis.diagnostics[0]?.code, source).toBe(code);
      expect(analysis.diagnostics[0]?.path, source).toBe(path);
    }
  });
});

describe('the extension seam (dialect references, function tables, pass budgets)', () => {
  const A1 = { isRef: (ref: string) => /^[A-Z]{1,3}[1-9][0-9]{0,6}$/.test(ref) };
  const cells: Record<string, unknown> = { A1: 2, A2: 3, A3: null, B1: 'x' };

  it('lets a dialect enable refs and ranges, list them as dependencies, and resolve them', () => {
    const result = parseExpression(
      {
        op: 'add',
        left: { op: 'call', fn: 'sum', args: [{ op: 'range', from: 'A1', to: 'A3' }] },
        right: { op: 'mul', left: { op: 'ref', ref: 'A2' }, right: { op: 'ref', ref: 'A3' } },
      },
      { references: A1 }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expression.refs).toEqual(['A2', 'A3']);
    expect(result.expression.ranges).toEqual([{ from: 'A1', to: 'A3' }]);
    const env: ExpressionEnv = {
      ref: (ref) => cells[ref],
      range: (from, to) => (from === 'A1' && to === 'A3' ? [cells.A1, cells.A2, cells.A3] : []),
    };
    // Sheets read blanks as zero; forms keep them unknown.
    expect(evaluateExpression(result.expression, env, { blank: 'zero' })).toBe(5);
    expect(evaluateExpression(result.expression, env)).toBe(null);
    expect(evaluateExpression(result.expression, {})).toEqual({ error: '#REF!' });
    expect(
      parseExpression({ op: 'ref', ref: 'not a ref' }, { references: A1 }).diagnostics[0]?.code
    ).toBe('bad-ref');
  });

  it('takes a caller function table, error-accepting functions and case-insensitive compare', () => {
    const table: ExpressionFunctionTable = {
      ...CORE_FUNCTIONS,
      IFERROR: {
        minArgs: 2,
        maxArgs: 2,
        params: ['any', 'any'],
        returns: 'any',
        acceptsErrors: true,
        call: ([value, fallback]) =>
          isExpressionError(value) ? (fallback ?? null) : (value ?? null),
      },
    };
    const parsed = parseExpressionText('IFERROR(1 / 0, "none")', { functions: table });
    expect(parsed.ok && evaluateExpression(parsed.expression, {}, { functions: table })).toBe(
      'none'
    );
    expect(parseExpressionText('IFERROR(1, 2)').ok).toBe(false);
    expect(evaluateExpression(text('"Ada" == "ADA"'), {}, { caseInsensitive: true })).toBe(true);
  });
});

describe('limits and hostile input (ADR-015)', () => {
  const timed = <T>(work: () => T): [T, number] => {
    const start = performance.now();
    const value = work();
    return [value, performance.now() - start];
  };

  it('accepts exactly the node and depth limits and refuses one more', () => {
    expect(parseExpression(nested(EXPRESSION_LIMITS.depth)).ok).toBe(true);
    expect(parseExpression(nested(EXPRESSION_LIMITS.depth + 1)).diagnostics[0]?.code).toBe(
      'too-deep'
    );
    // 1 root + 15 lists of 64 + 39 = 1,000 nodes at depth 3.
    const leaves = (n: number) => Array.from({ length: n }, () => ({ op: 'num', value: 1 }));
    const wide = (extra: number) => ({
      op: 'max',
      args: [
        ...Array.from({ length: 15 }, () => ({ op: 'max', args: leaves(63) })),
        { op: 'max', args: leaves(38 + extra) },
      ],
    });
    expect(parseExpression(wide(0)).ok).toBe(true);
    expect(parseExpression(wide(1)).diagnostics[0]?.code).toBe('too-many-nodes');
  });

  it('refuses a 100,000-level object, unbalanced parentheses and unary chains in linear time', () => {
    const [deep, deepMs] = timed(() => parseExpression(nested(100_000)));
    expect(deep.diagnostics[0]?.code).toBe('too-deep');
    for (const source of [
      '('.repeat(16_000),
      `${'-'.repeat(16_000)}1`,
      `${'not '.repeat(4_000)}x`,
    ]) {
      const [result, ms] = timed(() => parseExpressionText(source));
      expect(result.diagnostics[0]?.code).toBe('too-deep');
      expect(ms).toBeLessThan(500);
    }
    const [long] = timed(() => parseExpressionText(`${'1+'.repeat(10_000)}1`));
    expect(long.diagnostics[0]?.code).toBe('too-long');
    const [many, manyMs] = timed(() =>
      parseExpressionText(Array.from({ length: 3_000 }, () => 'a').join(' or '))
    );
    expect(many.diagnostics[0]?.code).toBe('too-many-nodes');
    expect(deepMs + manyMs).toBeLessThan(1000);
  });

  it('turns step exhaustion into #LIMIT! deterministically', () => {
    // Each contains() scans 32 KB (2,048 steps); 60 of them pass 100,000 steps.
    const big = 'x'.repeat(EXPRESSION_LIMITS.stringLength);
    const calls = Array.from({ length: 60 }, () => ({
      op: 'call',
      fn: 'contains',
      args: [
        { op: 'field', name: 'big' },
        { op: 'str', value: 'y' },
      ],
    }));
    const expression = compile({ op: 'or', args: calls });
    const [value, ms] = timed(() => evaluateExpression(expression, fields({ big })));
    expect(value).toEqual({ error: '#LIMIT!' });
    expect(ms).toBeLessThan(1000);
    // The same expression fits with a smaller input.
    expect(evaluateExpression(expression, fields({ big: 'x'.repeat(1000) }))).toBe(false);
    // A caller can lower the per-expression cap, never raise it.
    expect(evaluateExpression(text('1 + 1'), {}, { steps: 2 })).toEqual({ error: '#LIMIT!' });
    expect(evaluateExpression(text('1 + 1'), {}, { steps: 1e12 })).toBe(2);
  });

  it('shares one budget across a recalculation pass', () => {
    const budget = createExpressionBudget(100);
    const expression = text('a + b + c'); // 5 steps
    const results = Array.from({ length: 25 }, () =>
      evaluateExpression(expression, fields({ a: 1, b: 2, c: 3 }), { budget })
    );
    expect(results.slice(0, 20).every((value) => value === 6)).toBe(true);
    expect(results.slice(21)).toEqual(Array(4).fill({ error: '#LIMIT!' }));
    expect(budget.exhausted).toBe(true);
    expect(createExpressionBudget().limit).toBe(EXPRESSION_LIMITS.passSteps);
  });

  it('keeps concatenation inside the string cap', () => {
    const half = 'x'.repeat(EXPRESSION_LIMITS.stringLength / 2 + 1);
    expect(run('a & a', { a: half })).toEqual({ error: '#LIMIT!' });
    expect(run('len(a & "!")', { a: 'abc' })).toBe(4);
  });

  it('never reaches host objects through names', () => {
    for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const parsed = parseExpressionText(`${name}(1)`);
      expect(parsed.diagnostics[0]?.code, name).toBe('unknown-function');
      expect(run(name, {})).toBe(null);
    }
    const ast = text('a').ast as ExpressionNode;
    expect(Object.isFrozen(ast)).toBe(true);
  });
});

describe('documentation', () => {
  it('is a subpath export whose page names every export', async () => {
    const { readFileSync } = await import('node:fs');
    const exportsMap = JSON.parse(readFileSync('packages/core/package.json', 'utf8')).exports;
    expect(exportsMap['./expression']).toBe('./src/expression/index.ts');
    const root = await import('../src/index.ts');
    expect('parseExpression' in root).toBe(false);
    const doc = readFileSync('packages/core/docs/core-expression.md', 'utf8');
    const source = readFileSync('packages/core/src/expression/index.ts', 'utf8');
    const names = new Set<string>();
    for (const match of source.matchAll(/export\s+\{([^}]*)\}/g)) {
      for (const raw of (match[1] ?? '').split(',')) {
        const name = /(?:\w+\s+as\s+)?(\w+)$/.exec(raw.trim().replace(/^type\s+/, ''))?.[1];
        if (name) names.add(name);
      }
    }
    expect(names.size).toBeGreaterThan(35);
    expect([...names].filter((name) => !new RegExp(`\`${name}\\b`).test(doc))).toEqual([]);
    expect(readFileSync('packages/core/README.md', 'utf8')).toContain('core-expression.md');
  });
});
