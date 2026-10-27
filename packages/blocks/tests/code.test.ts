/// <reference types="node" />
// biome-ignore-all lint/suspicious/noTemplateCurlyInString: fixtures are source code text that contains ${…}.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { contrastRatio } from '@texuli/tokens';
import { loadAllFullLibraryThemes } from '@texuli/tokens/library-expand';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bashGrammar,
  CODE_TOKEN_KINDS,
  CODE_TOKENIZE_MAX_LENGTH,
  type CodeToken,
  cssGrammar,
  type Grammar,
  htmlGrammar,
  javascriptGrammar,
  jsonGrammar,
  parseLineSpec,
  pythonGrammar,
  resolveHighlightSteps,
  splitTokenLines,
  sqlGrammar,
  sticky,
  tokenize,
  tokenizeCode,
  typescriptGrammar,
  yamlGrammar,
} from '../src/code/engine.ts';
import {
  activeHighlightIndex,
  CODE_BLOCK_TYPES,
  CODE_COLOR_ROLES,
  CODE_GRAMMAR_LANGUAGES,
  CODE_TOKEN_STYLES,
  checkCodeBlock,
  codeTokenClass,
  DEFAULT_CODE_BLOCK_LABELS,
  fillCodeLabel,
  isCodeFamilyBlock,
  loadCodeFamily,
  loadCodeGrammar,
  resolveCodeBlockLabels,
  resolveCodeLanguage,
} from '../src/code/index.ts';
import { CodeBlockView } from '../src/code/renderers.ts';
import {
  BLOCK_CONTENT_LIMITS,
  blockText,
  getCatalogEntry,
  safeParseBlock,
} from '../src/core/index.ts';
import * as root from '../src/index.ts';

/** `kind:text` for styled tokens, bare text for plain ones. */
const compact = (tokens: readonly CodeToken[]) =>
  tokens.map((t) => (t.kind === 'plain' ? t.text : `${t.kind}:${t.text}`));
const joined = (tokens: readonly CodeToken[]) => tokens.map((t) => t.text).join('');

const GOLDEN: Record<string, { code: string; tokens: string[] }> = {
  ts: {
    code: 'const greet = (name: string): Promise<User> => api.get(`/u/${name}`); // hi\nclass Foo extends Bar {}',
    tokens: [
      'keyword:const',
      ' greet ',
      'operator:=',
      ' ',
      'punctuation:(',
      'name',
      'operator::',
      ' ',
      'type:string',
      'punctuation:)',
      'operator::',
      ' ',
      'type:Promise',
      'operator:<',
      'type:User',
      'operator:>',
      ' ',
      'operator:=>',
      ' api',
      'punctuation:.',
      'property:get',
      'punctuation:(',
      'string:`/u/${name}`',
      'punctuation:);',
      ' ',
      'comment:// hi',
      '\n',
      'keyword:class',
      ' ',
      'type:Foo',
      ' ',
      'keyword:extends',
      ' ',
      'type:Bar',
      ' ',
      'punctuation:{}',
    ],
  },
  js: {
    code: "import { a } from './a.js';\nexport async function load(id) {\n  /* c */ return a?.items.map((x) => x * 0x1F) ?? null;\n}",
    tokens: [
      'keyword:import',
      ' ',
      'punctuation:{',
      ' a ',
      'punctuation:}',
      ' ',
      'keyword:from',
      ' ',
      "string:'./a.js'",
      'punctuation:;',
      '\n',
      'keyword:export',
      ' ',
      'keyword:async',
      ' ',
      'keyword:function',
      ' ',
      'function:load',
      'punctuation:(',
      'id',
      'punctuation:)',
      ' ',
      'punctuation:{',
      '\n  ',
      'comment:/* c */',
      ' ',
      'keyword:return',
      ' a',
      'operator:?.',
      'property:items',
      'punctuation:.',
      'property:map',
      'punctuation:((',
      'x',
      'punctuation:)',
      ' ',
      'operator:=>',
      ' x ',
      'operator:*',
      ' ',
      'number:0x1F',
      'punctuation:)',
      ' ',
      'operator:??',
      ' ',
      'constant:null',
      'punctuation:;',
      '\n',
      'punctuation:}',
    ],
  },
  json: {
    code: '{"name": "x", "n": -1.5e3, "ok": true, "v": null}',
    tokens: [
      'punctuation:{',
      'property:"name"',
      'punctuation::',
      ' ',
      'string:"x"',
      'punctuation:,',
      ' ',
      'property:"n"',
      'punctuation::',
      ' ',
      'number:-1.5e3',
      'punctuation:,',
      ' ',
      'property:"ok"',
      'punctuation::',
      ' ',
      'constant:true',
      'punctuation:,',
      ' ',
      'property:"v"',
      'punctuation::',
      ' ',
      'constant:null',
      'punctuation:}',
    ],
  },
  bash: {
    code: '#!/bin/bash\nexport FOO="bar $HOME"\npnpm install --frozen-lockfile && echo ${FOO} # done',
    tokens: [
      'comment:#!/bin/bash',
      '\n',
      'keyword:export',
      ' FOO',
      'operator:=',
      'string:"bar $HOME"',
      '\n',
      'function:pnpm',
      ' install ',
      'attr:--frozen-lockfile',
      ' ',
      'operator:&&',
      ' ',
      'function:echo',
      ' ',
      'variable:${FOO}',
      ' ',
      'comment:# done',
    ],
  },
  python: {
    code: '@dataclass\nclass A:\n    def f(self, x=None):\n        return f"{x}" + """doc"""  # c',
    tokens: [
      'attr:@dataclass',
      '\n',
      'keyword:class',
      ' ',
      'type:A',
      'operator::',
      '\n    ',
      'keyword:def',
      ' ',
      'function:f',
      'punctuation:(',
      'self',
      'punctuation:,',
      ' x',
      'operator:=',
      'constant:None',
      'punctuation:)',
      'operator::',
      '\n        ',
      'keyword:return',
      ' ',
      'string:f"{x}"',
      ' ',
      'operator:+',
      ' ',
      'string:"""doc"""',
      '  ',
      'comment:# c',
    ],
  },
  css: {
    code: '@media (max-width: 600px) {\n  .card:hover > a { color: #fff; margin: 0 1.5rem !important; }\n}',
    tokens: [
      'keyword:@media',
      ' ',
      'punctuation:(',
      'property:max-width',
      'punctuation::',
      ' ',
      'number:600px',
      'punctuation:)',
      ' ',
      'punctuation:{',
      '\n  ',
      'attr:.card',
      'keyword::hover',
      ' ',
      'punctuation:>',
      ' ',
      'tag:a',
      ' ',
      'punctuation:{',
      ' ',
      'property:color',
      'punctuation::',
      ' ',
      'number:#fff',
      'punctuation:;',
      ' ',
      'property:margin',
      'punctuation::',
      ' ',
      'number:0',
      ' ',
      'number:1.5rem',
      ' ',
      'keyword:!important',
      'punctuation:;',
      ' ',
      'punctuation:}',
      '\n',
      'punctuation:}',
    ],
  },
  html: {
    code: '<!doctype html>\n<a href="x" data-x=1 disabled>T &amp; C</a><!-- c -->',
    tokens: [
      'keyword:<!doctype html>',
      '\n',
      'punctuation:<',
      'tag:a',
      ' ',
      'attr:href',
      'operator:=',
      'string:"x"',
      ' ',
      'attr:data-x',
      'operator:=',
      'string:1',
      ' ',
      'attr:disabled',
      'punctuation:>',
      'T ',
      'constant:&amp;',
      ' C',
      'punctuation:</',
      'tag:a',
      'punctuation:>',
      'comment:<!-- c -->',
    ],
  },
  sql: {
    code: "SELECT u.id, count(*) FROM users u WHERE name = 'O''Brien' AND id > $1 -- c",
    tokens: [
      'keyword:SELECT',
      ' u',
      'punctuation:.',
      'property:id',
      'punctuation:,',
      ' ',
      'function:count',
      'punctuation:(',
      'operator:*',
      'punctuation:)',
      ' ',
      'keyword:FROM',
      ' users u ',
      'keyword:WHERE',
      ' name ',
      'operator:=',
      ' ',
      "string:'O''Brien'",
      ' ',
      'keyword:AND',
      ' id ',
      'operator:>',
      ' ',
      'variable:$1',
      ' ',
      'comment:-- c',
    ],
  },
  yaml: {
    code: '# c\n---\nname: demo\nlist:\n  - key: "v" # c\n    on: true\nnum: 3.5\nref: *anchor',
    tokens: [
      'comment:# c',
      '\n',
      'punctuation:---',
      '\n',
      'property:name',
      'punctuation::',
      ' demo\n',
      'property:list',
      'punctuation::',
      '\n  ',
      'punctuation:-',
      ' ',
      'property:key',
      'punctuation::',
      ' ',
      'string:"v"',
      ' ',
      'comment:# c',
      '\n    ',
      'property:on',
      'punctuation::',
      ' ',
      'constant:true',
      '\n',
      'property:num',
      'punctuation::',
      ' ',
      'number:3.5',
      '\n',
      'property:ref',
      'punctuation::',
      ' ',
      'variable:*anchor',
    ],
  },
};

const GRAMMARS: Grammar[] = [
  typescriptGrammar,
  javascriptGrammar,
  jsonGrammar,
  bashGrammar,
  pythonGrammar,
  cssGrammar,
  htmlGrammar,
  sqlGrammar,
  yamlGrammar,
];

describe('code tokenizer: golden tokens', () => {
  it('has a golden fixture for every grammar language, and 6 related cases', () => {
    // has a golden fixture for every grammar language
    expect(Object.keys(GOLDEN).sort()).toEqual([...CODE_GRAMMAR_LANGUAGES].sort());
    cleanup();
    // tokenizes
    for (const [lang, { code, tokens }] of Object.entries(GOLDEN)) {
      const result = tokenizeCode(code, lang);
      expect(compact(result), String(lang)).toEqual(tokens);
      expect(joined(result), String(lang)).toBe(code);

      cleanup();
    }
    cleanup();
    // handles strings and comments that never close
    expect(compact(tokenizeCode('a = "open\nb = 1', 'js'))).toEqual([
      'a ',
      'operator:=',
      ' ',
      'string:"open',
      '\nb ',
      'operator:=',
      ' ',
      'number:1',
    ]);
    expect(compact(tokenizeCode('x /* open\nstill', 'css'))).toEqual([
      'tag:x',
      ' ',
      'comment:/* open\nstill',
    ]);
    expect(compact(tokenizeCode('s = """open\nmore', 'python'))).toEqual([
      's ',
      'operator:=',
      ' ',
      'string:"""open\nmore',
    ]);
    expect(compact(tokenizeCode('<!-- open', 'html'))).toEqual(['comment:<!-- open']);
    cleanup();
    // keeps comment markers inside strings and words
    expect(compact(tokenizeCode('echo "a # b" a#b $#', 'bash'))).toEqual([
      'function:echo',
      ' ',
      'string:"a # b"',
      ' a#b ',
      'variable:$#',
    ]);
    expect(compact(tokenizeCode('url = "http://x" // c', 'js'))).toEqual([
      'url ',
      'operator:=',
      ' ',
      'string:"http://x"',
      ' ',
      'comment:// c',
    ]);
    cleanup();
    // treats unknown languages and text as one plain token
    expect(tokenizeCode('<b>x</b>', 'text')).toEqual([{ kind: 'plain', text: '<b>x</b>' }]);
    expect(tokenizeCode('fn main() {}', 'rust')).toEqual([{ kind: 'plain', text: 'fn main() {}' }]);
    expect(tokenizeCode('', 'ts')).toEqual([]);
    expect(tokenizeCode('', 'text')).toEqual([]);
    cleanup();
    // resolves language aliases, case-insensitively
    expect(resolveCodeLanguage('TypeScript')).toBe('ts');
    expect(resolveCodeLanguage('tsx')).toBe('ts');
    expect(resolveCodeLanguage('sh')).toBe('bash');
    expect(resolveCodeLanguage('yml')).toBe('yaml');
    expect(resolveCodeLanguage('postgres')).toBe('sql');
    expect(resolveCodeLanguage('text')).toBeNull();
    expect(resolveCodeLanguage('constructor')).toBeNull();
    expect(resolveCodeLanguage('__proto__')).toBeNull();
    cleanup();
    // resolves every grammar language to itself and text to none
    for (const lang of CODE_GRAMMAR_LANGUAGES) expect(resolveCodeLanguage(lang), lang).toBe(lang);
    expect(resolveCodeLanguage(' TS ')).toBe('ts');
  });
});

describe('code tokenizer: invariants', () => {
  const corpus = [
    ...Object.values(GOLDEN).map((g) => g.code),
    'a\r\nb\r\n',
    '\t\tindented\n\n\n',
    'emoji 🚀 and ünïcödé and \u2028 separators',
    '\\"\'`${}/*-->--#',
  ];
  it('always concatenates back to the input and uses only known kinds, and 5 related cases', () => {
    // always concatenates back to the input and uses only known kinds
    for (const grammar of GRAMMARS) {
      for (const code of corpus) {
        const tokens = tokenize(code, grammar);
        expect(joined(tokens), `${grammar.name}: ${code.slice(0, 30)}`).toBe(code);
        for (const token of tokens) {
          expect(CODE_TOKEN_KINDS).toContain(token.kind);
          expect(token.text.length).toBeGreaterThan(0);
        }
        for (let i = 1; i < tokens.length; i += 1) {
          expect(tokens[i]?.kind, 'adjacent tokens of one kind are merged').not.toBe(
            tokens[i - 1]?.kind
          );
        }
      }
    }
    cleanup();
    {
      // round-trips seeded random text in every grammar
      let seed = 0x5eed;
      const alphabet = 'ab_ $#@:;{}()[]<>="\'`\\/*-+.,!?&|^~%\n\t 0123456789xX';
      const next = () => {
        seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
        return seed / 2 ** 31;
      };
      for (let i = 0; i < 200; i += 1) {
        const length = Math.floor(next() * 200);
        let code = '';
        for (let j = 0; j < length; j += 1) code += alphabet[Math.floor(next() * alphabet.length)];
        for (const grammar of GRAMMARS) expect(joined(tokenize(code, grammar))).toBe(code);
      }
    }
    cleanup();
    {
      // tokenizes only the first 20,000 characters and keeps the rest as plain text
      const code = `${'const a = 1;\n'.repeat(1_600)}const tail = 2;`;
      expect(code.length).toBeGreaterThan(CODE_TOKENIZE_MAX_LENGTH);
      const tokens = tokenizeCode(code, 'ts');
      expect(joined(tokens)).toBe(code);
      const last = tokens[tokens.length - 1];
      expect(last?.kind).toBe('plain');
      expect(last?.text.endsWith('const tail = 2;')).toBe(true);
    }
    cleanup();
    // uses only sticky, multiline rules with valid state transitions
    for (const grammar of GRAMMARS) {
      expect(Object.keys(grammar.states)).toContain(grammar.start);
      for (const [state, rules] of Object.entries(grammar.states)) {
        for (const rule of rules) {
          expect(rule.re.flags, `${grammar.name}.${state} ${rule.re.source}`).toBe('my');
          if (rule.next) expect(Object.keys(grammar.states)).toContain(rule.next);
        }
      }
    }
    cleanup();
    {
      // refuses a grammar rule with a capture group instead of misattributing matches
      const broken: Grammar = {
        name: 'broken',
        start: 'a',
        states: { a: [{ re: sticky('(x)y'), kind: 'keyword' }] },
      };
      expect(() => tokenize('xy', broken)).toThrow(/capture groups/);
      const ordered: Grammar = {
        name: 'ordered',
        start: 'a',
        states: {
          a: [
            { re: sticky('ab'), kind: 'keyword' },
            { re: sticky('a'), kind: 'string' },
          ],
        },
      };
      expect(compact(tokenize('aba', ordered))).toEqual(['keyword:ab', 'string:a']);
    }
    cleanup();
    {
      // splits tokens into lines without the line breaks
      const lines = splitTokenLines(tokenizeCode('/* a\nb */ x\n\ny', 'js'));
      expect(lines.map(compact)).toEqual([['comment:/* a'], ['comment:b */', ' x'], [], ['y']]);
      expect(splitTokenLines([])).toEqual([[]]);
    }
  });
});

// Wall-clock comparisons run only in the serialized perf run (pnpm test:perf).
describe.skipIf(process.env.TEXULI_PERF !== '1')(
  'code tokenizer: pathological inputs stay linear',
  () => {
    const patterns = [
      '"',
      "'",
      '`',
      '\\',
      '"\\',
      "'\\",
      '/*',
      '*/',
      '//',
      '<!--',
      '<',
      '</',
      '<a ',
      '="',
      "='",
      '&',
      '&#',
      '#',
      '$',
      '${',
      '$(',
      '@',
      'a',
      'a ',
      '1',
      '1.',
      '1e',
      '0x',
      '-',
      '- ',
      '--',
      ':',
      'a:',
      'k: ',
      '.a:b ',
      'a{',
      '{',
      '}',
      ';',
      '"""',
      "'''",
      "''",
      '""',
      'r"',
      "f'",
      '!',
      '!important',
      '?.',
      '=>',
      '\t',
      ' ',
      '\n',
      ' \n',
      '#fff',
      '*a',
      '&a',
      '---\n',
      'a\\\n',
      // Escapes next to delimiters: a lone trailing backslash must not make a string fail.
      '`\\',
      '"\\"',
      "'\\'",
      '"""\\',
      "'''\\",
      '\\\n',
      '"a\\',
      '`${',
      '$"',
      '<a b="',
    ];
    const SIZE = CODE_TOKENIZE_MAX_LENGTH;
    const BUDGET_MS = 50;
    /** A quadratic pattern costs hundreds of times a linear one at 20 KB. */
    const BASELINE_FACTOR = 20;

    /** The fastest of five runs: the algorithm's cost, not a busy machine's scheduler. */
    const fastest = (code: string, grammar: Grammar) => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 5; i += 1) {
        const started = performance.now();
        tokenize(code, grammar);
        best = Math.min(best, performance.now() - started);
      }
      return best;
    };

    it('tokenizes 20 KB pathological inputs in linear time', () => {
      for (const [_name, grammar] of GRAMMARS.map((g) => [g.name, g] as const)) {
        tokenize('warm up '.repeat(100), grammar);
        // Same size, benign text, same machine and moment: the budget scales with load.
        const baseline = fastest('word '.repeat(SIZE / 5), grammar);
        const budget = Math.max(BUDGET_MS, BASELINE_FACTOR * baseline);
        const slow: string[] = [];
        for (const pattern of patterns) {
          const code = pattern.repeat(Math.ceil(SIZE / pattern.length)).slice(0, SIZE);
          expect(joined(tokenize(code, grammar)), String(_name)).toBe(code);
          const time = fastest(code, grammar);
          if (time >= budget) {
            slow.push(
              `${JSON.stringify(pattern)}: ${time.toFixed(1)} ms (budget ${budget.toFixed(1)} ms)`
            );
          }
        }
        expect(slow, String(_name)).toEqual([]);

        cleanup();
      }
    });
  }
);

describe('highlight steps', () => {
  it('resolves line specs and range lists to sorted, unique, clamped lines; highlights nothing for malformed steps; shares the code block schema parser', () => {
    // resolves line specs and range lists to sorted, unique, clamped lines
    expect(resolveHighlightSteps(['1-2,4', [[1, 2], 4], '3', [[2, 9]]], 5)).toEqual([
      [1, 2, 4],
      [1, 2, 4],
      [3],
      [2, 3, 4, 5],
    ]);
    expect(resolveHighlightSteps(['2,1,2-3'], 10)).toEqual([[1, 2, 3]]);
    cleanup();
    // highlights nothing for malformed steps
    expect(
      resolveHighlightSteps(['3-1', '0', 'x', [[2, 1]], [0], [1.5], [[1, 2, 3] as never]], 10)
    ).toEqual([[], [], [], [], [], [], []]);
    expect(resolveHighlightSteps(['1-3'], 0)).toEqual([[]]);
    cleanup();
    // shares the code block schema parser
    expect(parseLineSpec('1-2,4')).toEqual([
      [1, 2],
      [4, 4],
    ]);
    expect(parseLineSpec('2-1')).toBeNull();
  });
});

describe('code tokenizer: package hygiene', () => {
  const dir = join(import.meta.dirname, '..', 'src', 'code');
  const files: string[] = [];
  const walk = (path: string) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  it('keeps the tokenizer and grammars free of imports outside the code folder; has no HTML sinks or dynamic code anywhere in the family', () => {
    {
      // keeps the tokenizer and grammars free of imports outside the code folder
      const engine = files.filter((file) =>
        /(?:tokenizer|highlight|grammars|tokenize-code)\.ts$|[\\/]languages[\\/]/.test(file)
      );
      expect(engine.length).toBeGreaterThanOrEqual(13);
      for (const file of engine) {
        const text = readFileSync(file, 'utf8');
        for (const match of text.matchAll(
          /\bfrom\s+['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g
        )) {
          const target = match[1] ?? match[2];
          // The one shared import: the schema and the renderer parse line specs alike.
          if (target === '../core/schema/line-spec.ts') continue;
          expect(target, file).toMatch(/^\.\.?\//);
          expect(target, file).not.toMatch(/schema|\.\.\/\.\./);
        }
      }
    }
    cleanup();
    // has no HTML sinks or dynamic code anywhere in the family
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/innerHTML|\{@html|\beval\s*\(|new\s+Function/);
    }
  });
});

const RLO = '\u202e';

describe('checkCodeBlock: the untrusted-input guard', () => {
  it('accepts a code block and keeps only known fields, and 3 related cases', () => {
    {
      // accepts a code block and keeps only known fields
      const result = checkCodeBlock({
        type: 'code',
        lang: 'ts',
        filename: 'harbor.ts',
        code: 'const a = 1;\n',
        extra: '<img src=x onerror=alert(1)>',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.block).toEqual({
          type: 'code',
          lang: 'ts',
          filename: 'harbor.ts',
          code: 'const a = 1;\n',
        });
        expect(isCodeFamilyBlock(result.block)).toBe(true);
      }
    }
    cleanup();
    {
      // keeps markup in code as data, never as structure
      const result = checkCodeBlock({
        type: 'code',
        lang: 'html',
        code: '<script>alert(1)</script>',
      });
      expect(result.ok && result.block.code).toBe('<script>alert(1)</script>');
    }
    cleanup();
    // rejects
    for (const [_name, value, field] of [
      ['a foreign block type', { type: 'heading', level: 2, text: 'Hi' }, 'type'],
      ['an unknown block type', { type: 'script', code: 'x' }, 'type'],
      ['missing code', { type: 'code' }, 'code'],
      ['non-string code', { type: 'code', code: 42 }, 'code'],
      ['a bidi override in code', { type: 'code', code: `const a = '${RLO}x';` }, 'code'],
      [
        'a bidi override in the filename',
        { type: 'code', code: 'x', filename: `a${RLO}.ts` },
        'filename',
      ],
      ['an injected language token', { type: 'code', code: 'x', lang: 'ts" onload="x' }, 'lang'],
      ['an uppercase language', { type: 'code', code: 'x', lang: 'TS' }, 'lang'],
      ['too many characters', { type: 'code', code: 'a'.repeat(20_001) }, 'code'],
      ['too many lines', { type: 'code', code: '\n'.repeat(400) }, 'code'],
      ['not an object', 'const a = 1;', undefined],
      ['null', null, undefined],
    ]) {
      const result = checkCodeBlock(value);
      expect(result.ok, String(_name)).toBe(false);
      if (!result.ok && field)
        expect(
          result.issues.map((issue) => issue.path.join('.')),
          String(_name)
        ).toContain(field);

      cleanup();
    }
    cleanup();
    // exports the light entry from the package root without the tokenizer
    expect(root.checkCodeBlock).toBe(checkCodeBlock);
    expect(root.CODE_BLOCK_TYPES).toEqual(CODE_BLOCK_TYPES);
    expect('tokenize' in root).toBe(false);
    expect('tokenizeCode' in root).toBe(false);
  });
});

describe('code labels', () => {
  it('merges string overrides over the English defaults; fills every {name} as plain text', () => {
    {
      // merges string overrides over the English defaults
      const labels = resolveCodeBlockLabels({ copy: 'Copiar', copied: 7 as never });
      expect(labels.copy).toBe('Copiar');
      expect(labels.copied).toBe(DEFAULT_CODE_BLOCK_LABELS.copied);
      expect(resolveCodeBlockLabels()).toEqual(DEFAULT_CODE_BLOCK_LABELS);
    }
    cleanup();
    // fills every {name} as plain text
    expect(fillCodeLabel('Copy {name} code ({name})', 'a.ts')).toBe('Copy a.ts code (a.ts)');
    expect(fillCodeLabel('Copy code', '<b>')).toBe('Copy code');
  });
});

describe('code token styles', () => {
  it('styles every token kind with an allowed role and a class, and 2 related cases', async () => {
    // styles every token kind with an allowed role and a class
    for (const kind of CODE_TOKEN_KINDS) {
      expect(CODE_COLOR_ROLES).toContain(CODE_TOKEN_STYLES[kind].color);
      if (kind === 'plain') expect(codeTokenClass(kind)).toBeUndefined();
      else expect(codeTokenClass(kind)).toBe(`tx-code-tok--${kind}`);
    }
    cleanup();
    // draws every role at AA on surface and on muted in every library theme, light and dark
    await (async () => {
      const themes = await loadAllFullLibraryThemes();
      expect(themes.length).toBeGreaterThanOrEqual(64);
      const misses: string[] = [];
      for (const theme of themes) {
        for (const mode of ['light', 'dark'] as const) {
          const palette = theme[mode] as unknown as Record<string, { default: string }>;
          for (const role of CODE_COLOR_ROLES) {
            for (const background of ['surface', 'muted']) {
              const ratio = contrastRatio(
                palette[role]?.default ?? '',
                palette[background]?.default ?? ''
              );
              if (!(ratio >= 4.5))
                misses.push(`${theme.id} ${mode} ${role}/${background} ${ratio}`);
            }
          }
        }
      }
      expect(misses).toEqual([]);
    })();
    cleanup();
    // picks the active highlight step, clamped
    expect(activeHighlightIndex(0, 3)).toBe(-1);
    expect(activeHighlightIndex(3, undefined)).toBe(0);
    expect(activeHighlightIndex(3, Number.NaN)).toBe(0);
    expect(activeHighlightIndex(3, 1.9)).toBe(1);
    expect(activeHighlightIndex(3, 9)).toBe(2);
    expect(activeHighlightIndex(3, -4)).toBe(0);
  }, 30000);
});

describe('loadCodeGrammar', () => {
  it('loads one grammar per language, by id or alias, and caches it; gives null for text, unknown and missing languages', async () => {
    // loads one grammar per language, by id or alias, and caches it
    await (async () => {
      const ts = await loadCodeGrammar('ts');
      expect(ts).toBe(typescriptGrammar);
      expect(await loadCodeGrammar('TypeScript')).toBe(ts);
      expect(loadCodeGrammar('yml')).toBe(loadCodeGrammar('yaml'));
      for (const lang of CODE_GRAMMAR_LANGUAGES)
        expect(await loadCodeGrammar(lang), lang).not.toBeNull();
    })();
    cleanup();
    // gives null for text, unknown and missing languages
    await (async () => {
      expect(await loadCodeGrammar('text')).toBeNull();
      expect(await loadCodeGrammar('rust')).toBeNull();
      expect(await loadCodeGrammar('__proto__')).toBeNull();
      expect(await loadCodeGrammar(undefined)).toBeNull();
    })();
  });
});

describe('CodeBlockView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const source = 'const a = "<b>x</b>";\n// note\nreturn a;';

  function codeText(container: HTMLElement): string {
    return container.querySelector('pre')?.textContent ?? '';
  }
  it('loads lazily as its own chunk, and 9 related cases', async () => {
    // loads lazily as its own chunk
    await (async () => {
      const module = await loadCodeFamily();
      expect(module.default).toBe(CodeBlockView);
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    // renders the exact source as text and highlights it once the grammar arrives
    await (async () => {
      const view = render(CodeBlockView, {
        props: { block: { type: 'code', lang: 'ts', code: source } },
      });
      const figure = view.container.querySelector('[data-tx-block="code"]') as HTMLElement;
      expect(codeText(view.container)).toBe(source);
      await waitFor(() => expect(figure.getAttribute('data-tokenized')).toBe('true'));
      expect(codeText(view.container)).toBe(source);
      expect(view.container.querySelector('b')).toBeNull();
      expect(view.container.querySelector('.tx-code-tok--keyword')?.textContent).toBe('const');
      expect(view.container.querySelector('.tx-code-tok--string')?.textContent).toBe('"<b>x</b>"');
      expect(view.container.querySelector('.tx-code-tok--comment')?.textContent).toBe('// note');
      expect(figure.getAttribute('data-lang')).toBe('ts');
      expect(figure.getAttribute('data-grammar')).toBe('ts');
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    // keeps hostile markup inert
    await (async () => {
      const hostile = '<script>alert(1)</script><img src=x onerror=alert(1)>{@html x}';
      const view = render(CodeBlockView, {
        props: { block: { type: 'code', lang: 'html', code: hostile } },
      });
      await waitFor(() => expect(view.container.querySelector('[data-tokenized]')).not.toBeNull());
      expect(view.container.querySelector('script, img')).toBeNull();
      expect(codeText(view.container)).toBe(hostile);
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    // shows unknown languages as plain text, never tokenized
    await (async () => {
      const view = render(CodeBlockView, {
        props: { block: { type: 'code', lang: 'rust', code: 'fn main() {}' } },
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const figure = view.container.querySelector('[data-tx-block="code"]') as HTMLElement;
      expect(figure.hasAttribute('data-tokenized')).toBe(false);
      expect(figure.getAttribute('data-grammar')).toBe('none');
      expect(view.container.querySelector('[class^="tx-code-tok--"]')).toBeNull();
      expect(codeText(view.container)).toBe('fn main() {}');
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    {
      // names the focusable scroll region by the filename, else the language, else the label
      const named = render(CodeBlockView, {
        props: { block: { type: 'code', lang: 'ts', filename: 'harbor.ts', code: 'x' } },
      });
      const region = named.getByRole('region', { name: 'harbor.ts' });
      expect(region.getAttribute('tabindex')).toBe('0');
      expect(region.getAttribute('dir')).toBe('ltr');
      expect(named.getByRole('button', { name: 'Copy harbor.ts code' })).toBeTruthy();
      named.unmount();
      const byLang = render(CodeBlockView, {
        props: { block: { type: 'code', lang: 'sql', code: 'x' } },
      });
      expect(byLang.getByRole('region', { name: 'SQL' })).toBeTruthy();
      byLang.unmount();
      const bare = render(CodeBlockView, {
        props: {
          block: { type: 'code', code: 'x' },
          labels: { code: 'Código', copyName: 'Copiar {name}' },
        },
      });
      expect(bare.getByRole('region', { name: 'Código' })).toBeTruthy();
      expect(bare.getByRole('button', { name: 'Copiar Código' })).toBeTruthy();
    }
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    {
      // marks highlighted lines for the chosen step and draws line numbers outside the text
      const block = { type: 'code', lang: 'text', code: 'a\nb\nc\nd' };
      const view = render(CodeBlockView, {
        props: { block, lineNumbers: true, highlights: ['1-2', [4], 'bad'], step: 1 },
      });
      const marks = Array.from(view.container.querySelectorAll('mark'));
      expect(marks.map((mark) => mark.getAttribute('data-line'))).toEqual(['4']);
      expect(
        view.container.querySelector('pre')?.classList.contains('tx-code__pre--numbered')
      ).toBe(true);
      expect(codeText(view.container)).toBe('a\nb\nc\nd');
      const lines = Array.from(view.container.querySelectorAll('.tx-code__line'));
      expect(lines.map((line) => line.getAttribute('data-line'))).toEqual(['1', '2', '3', '4']);
      view.unmount();
      const first = render(CodeBlockView, { props: { block, highlights: ['1-2', [4]] } });
      expect(
        Array.from(first.container.querySelectorAll('mark')).map((m) => m.textContent)
      ).toEqual(['a\n', 'b\n']);
      expect(
        first.container.querySelector('pre')?.classList.contains('tx-code__pre--numbered')
      ).toBe(false);
    }
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    // copies the exact source and announces it
    await (async () => {
      const writeText = vi.fn(async () => {});
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      const view = render(CodeBlockView, {
        props: { block: { type: 'code', lang: 'ts', code: source } },
      });
      const button = view.getByRole('button', { name: 'Copy TS code' });
      await fireEvent.click(button);
      expect(writeText).toHaveBeenCalledWith(source);
      await waitFor(() => expect(button.getAttribute('data-state')).toBe('copied'));
      expect(button.textContent).toContain('Copied');
      expect(view.container.querySelector('[aria-live="polite"]')?.textContent).toBe(
        'Code copied to the clipboard.'
      );
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    // says so when the copy fails
    await (async () => {
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: async () => {
            throw new Error('denied');
          },
        },
      });
      const execCommand = vi.fn(() => false);
      Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
      const view = render(CodeBlockView, {
        props: {
          block: { type: 'code', code: 'x' },
          labels: { copyFailed: 'Falló', copyFailedAnnouncement: 'No se pudo copiar.' },
        },
      });
      const button = view.getByRole('button');
      await fireEvent.click(button);
      await waitFor(() => expect(button.getAttribute('data-state')).toBe('failed'));
      expect(button.textContent).toContain('Falló');
      expect(view.container.querySelector('[aria-live="polite"]')?.textContent).toBe(
        'No se pudo copiar.'
      );
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    {
      // hides the copy button when not copyable
      const view = render(CodeBlockView, {
        props: { block: { type: 'code', code: 'x' }, copyable: false },
      });
      expect(view.queryByRole('button')).toBeNull();
    }
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    // shows an inert notice and reports the issues for a rejected block
    await (async () => {
      const oninvalid = vi.fn();
      const view = render(CodeBlockView, {
        props: {
          block: { type: 'code', code: `x${RLO}` },
          oninvalid,
          labels: { invalid: 'No válido.' },
        },
      });
      const note = view.getByRole('note');
      expect(note.textContent).toBe('No válido.');
      expect(view.container.querySelector('pre')).toBeNull();
      await waitFor(() => expect(oninvalid).toHaveBeenCalled());
      expect(oninvalid.mock.calls[0]?.[0][0].path).toEqual(['code']);
    })();
  });
});

describe('code block schema: highlights, line numbers and caption', () => {
  const code = 'a\nb\nc\nd';
  it('accepts the new fields and keeps them, and 5 related cases', () => {
    {
      // accepts the new fields and keeps them
      const result = checkCodeBlock({
        type: 'code',
        code,
        step: 2,
        caption: 'Four fictional lines.',
        lineNumbers: true,
        highlights: ['1-2', '4', '1,3-4'],
      });
      expect(result.ok && result.block).toEqual({
        type: 'code',
        code,
        step: 2,
        caption: 'Four fictional lines.',
        lineNumbers: true,
        highlights: ['1-2', '4', '1,3-4'],
      });
      const off = checkCodeBlock({ type: 'code', code, lineNumbers: false });
      expect(off.ok && off.block.lineNumbers).toBe(false);
    }
    cleanup();
    {
      // caps highlight steps, spec length and caption length
      const max = BLOCK_CONTENT_LIMITS.codeHighlightSteps;
      expect(checkCodeBlock({ type: 'code', code, highlights: Array(max).fill('1') }).ok).toBe(
        true
      );
      expect(checkCodeBlock({ type: 'code', code, highlights: Array(max + 1).fill('1') }).ok).toBe(
        false
      );
      const long = Array.from({ length: 400 }, () => 'x').join('\n');
      const spec = Array.from({ length: 60 }, (_, i) => String(i + 1)).join(',');
      expect(spec.length).toBeGreaterThan(BLOCK_CONTENT_LIMITS.codeHighlightSpec);
      expect(checkCodeBlock({ type: 'code', code: long, highlights: [spec] }).ok).toBe(false);
      const caption = 'c'.repeat(BLOCK_CONTENT_LIMITS.codeCaption);
      expect(checkCodeBlock({ type: 'code', code, caption }).ok).toBe(true);
      expect(checkCodeBlock({ type: 'code', code, caption: `${caption}c` }).ok).toBe(false);
    }
    cleanup();
    // rejects
    for (const [_name, extra, field] of [
      ['an empty highlight list', { highlights: [] }, 'highlights'],
      ['a highlight list that is not a list', { highlights: '1-2' }, 'highlights'],
      ['a non-string spec', { highlights: [3] }, 'highlights.0'],
      ['a reversed range', { highlights: ['3-1'] }, 'highlights.0'],
      ['line zero', { highlights: ['0'] }, 'highlights.0'],
      ['a spec with spaces or words', { highlights: ['1, 2'] }, 'highlights.0'],
      ['script in a spec', { highlights: ['1"><script>'] }, 'highlights.0'],
      ['a line past the end', { highlights: ['1', '2-5'] }, 'highlights.1'],
      ['a non-boolean lineNumbers', { lineNumbers: 'yes' }, 'lineNumbers'],
      ['a caption with a bidi override', { caption: `a${RLO}b` }, 'caption'],
      ['a multi-line caption', { caption: 'a\nb' }, 'caption'],
      ['a non-string caption', { caption: { html: '<b>' } }, 'caption'],
      ['a fractional step', { step: 1.5 }, 'step'],
      ['a negative step', { step: -1 }, 'step'],
    ] as const) {
      const result = checkCodeBlock({ type: 'code', code, ...extra });
      expect(result.ok, String(_name)).toBe(false);
      if (!result.ok)
        expect(
          result.issues.map((issue) => issue.path.join('.')),
          String(_name)
        ).toContain(field);

      cleanup();
    }
    cleanup();
    {
      // puts the caption in the block text
      const parsed = safeParseBlock({ type: 'code', code: 'x = 1', caption: 'Setup' });
      expect(parsed.success && blockText(parsed.data)).toBe('Setup\nx = 1');
      const bare = safeParseBlock({ type: 'code', code: 'x = 1' });
      expect(bare.success && blockText(bare.data)).toBe('x = 1');
    }
    cleanup();
    {
      // keeps the catalog examples valid, the rich one using every new field
      const entry = getCatalogEntry('code');
      expect(checkCodeBlock(entry?.exampleMinimal).ok).toBe(true);
      const rich = checkCodeBlock(entry?.exampleRich);
      expect(rich.ok).toBe(true);
      if (rich.ok) {
        expect(rich.block.caption).toBeTruthy();
        expect(rich.block.lineNumbers).toBe(true);
        expect(rich.block.highlights?.length).toBeGreaterThan(1);
      }
      expect(entry?.limits.join(' ')).toContain(String(BLOCK_CONTENT_LIMITS.codeHighlightSteps));
    }
    cleanup();
    // picks the highlight step from an explicit step, else the host step from the block step
    expect(activeHighlightIndex(3, 2, 0, 0)).toBe(2);
    expect(activeHighlightIndex(3, undefined, 5, 4)).toBe(1);
    expect(activeHighlightIndex(3, undefined, 2, 4)).toBe(0);
    expect(activeHighlightIndex(3, undefined, 99, 4)).toBe(2);
    expect(activeHighlightIndex(3, undefined, Number.NaN, 4)).toBe(0);
  });
});

describe('CodeBlockView reads the schema fields', () => {
  const block = {
    type: 'code',
    code: 'a\nb\nc\nd',
    step: 3,
    caption: 'Fictional caption.',
    lineNumbers: true,
    highlights: ['1-2', '4'],
  };
  const marked = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('mark')).map((mark) => mark.getAttribute('data-line'));
  it('shows the caption, line numbers and the first highlight step from data, and 2 related cases', () => {
    {
      // shows the caption, line numbers and the first highlight step from data
      const view = render(CodeBlockView, { props: { block } });
      expect(view.container.querySelector('figcaption')?.textContent).toBe('Fictional caption.');
      expect(
        view.container.querySelector('pre')?.classList.contains('tx-code__pre--numbered')
      ).toBe(true);
      expect(marked(view.container)).toEqual(['1', '2']);
      expect(view.container.querySelector('pre')?.textContent).toBe('a\nb\nc\nd');
    }
    cleanup();
    {
      // follows the host step from the block step, and lets props override
      const deck = render(CodeBlockView, { props: { block, hostStep: 4 } });
      expect(marked(deck.container)).toEqual(['4']);
      deck.unmount();
      const before = render(CodeBlockView, { props: { block, hostStep: 1 } });
      expect(marked(before.container)).toEqual(['1', '2']);
      before.unmount();
      const override = render(CodeBlockView, {
        props: { block, lineNumbers: false, highlights: ['3'], step: 0, hostStep: 4 },
      });
      expect(marked(override.container)).toEqual(['3']);
      expect(
        override.container.querySelector('pre')?.classList.contains('tx-code__pre--numbered')
      ).toBe(false);
    }
    cleanup();
    {
      // shows no caption or highlights when the block has none
      const view = render(CodeBlockView, { props: { block: { type: 'code', code: 'x' } } });
      expect(view.container.querySelector('figcaption')).toBeNull();
      expect(view.container.querySelector('mark')).toBeNull();
      expect(view.container.querySelector('[data-highlight-step]')).toBeNull();
    }
  });
});
