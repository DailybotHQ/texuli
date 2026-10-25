/**
 * CSS hygiene for the package stylesheets (T-x-css-diet). Reports CSS that can
 * never affect a page:
 *
 * - `duplicate-declaration`: the same property and value twice in one rule;
 * - `duplicate-rule`: a rule identical to an earlier one with the same
 *   selector in the same at-rule context;
 * - `shadowed-declaration`: a property that a later rule with the same
 *   selector, in the same context, always overrides;
 * - `unused-class`: a `tx-*` class selector that no source file can produce
 *   (Svelte, TypeScript, Astro, tests). A class built from a template
 *   (`tx-x--{variant}`, `` `tx-x--${size}` ``, `'tx-x--' + …`) counts as used
 *   when its prefix appears that way.
 *
 * Usage (repository root): pnpm exec tsx scripts/check-css.ts
 * Exit 0 prints a summary; exit 1 lists every finding.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export interface CssFinding {
  file: string;
  line: number;
  code: 'duplicate-declaration' | 'duplicate-rule' | 'shadowed-declaration' | 'unused-class';
  message: string;
}

interface Declaration {
  prop: string;
  value: string;
  important: boolean;
  line: number;
}

interface Rule {
  selector: string;
  context: string;
  line: number;
  declarations: Declaration[];
}

/** Blank out comments and strings, keeping offsets and newlines, so braces inside them are ignored. */
function mask(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (match) =>
    match.startsWith('/*')
      ? match.replace(/[^\n]/g, ' ')
      : match[0] + match.slice(1, -1).replace(/[^\n]/g, '_') + match.at(-1)
  );
}

const lineAt = (text: string, offset: number) => text.slice(0, offset).split('\n').length;
const normalizeSelector = (selector: string) =>
  selector
    .split(',')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .sort()
    .join(', ');

/** Parse rules with their at-rule context. Handles nested at-rules and simple nested rules. */
export function parseCssRules(css: string): Rule[] {
  const text = mask(css);
  const rules: Rule[] = [];
  const parseBlock = (start: number, end: number, context: string) => {
    let cursor = start;
    while (cursor < end) {
      const open = text.indexOf('{', cursor);
      const semi = text.indexOf(';', cursor);
      if (open === -1 || open >= end) return;
      if (semi !== -1 && semi < open && text.slice(cursor, semi).trim().startsWith('@')) {
        cursor = semi + 1; // statement at-rule: @import, @layer a, b;
        continue;
      }
      let depth = 1;
      let close = open + 1;
      while (close < end && depth > 0) {
        if (text[close] === '{') depth += 1;
        else if (text[close] === '}') depth -= 1;
        close += 1;
      }
      const prelude = text.slice(cursor, open).trim();
      const preludeStart =
        cursor + (text.slice(cursor, open).length - text.slice(cursor, open).trimStart().length);
      if (prelude.startsWith('@')) {
        parseBlock(open + 1, close - 1, context ? `${context} > ${prelude}` : prelude);
      } else {
        const body = text.slice(open + 1, close - 1);
        const nested = body.includes('{');
        const declarations: Declaration[] = [];
        let flat = body;
        if (nested) {
          // Keep only the rule's own declarations; nested blocks become their own rules.
          parseBlock(open + 1, close - 1, context ? `${context} > ${prelude}` : prelude);
          flat = body.replace(/[^;{}]*\{[^{}]*\}/g, '');
        }
        let offset = open + 1;
        for (const part of flat.split(';')) {
          const colon = part.indexOf(':');
          const raw = css.slice(offset, offset + part.length);
          offset += part.length + 1;
          if (colon === -1) continue;
          const prop = part.slice(0, colon).trim();
          if (!/^-{0,2}[a-zA-Z][\w-]*$/.test(prop)) continue;
          let value = raw
            .slice(raw.indexOf(':') + 1)
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .trim()
            .replace(/\s+/g, ' ');
          const important = /!important$/i.test(value);
          if (important) value = value.replace(/\s*!important$/i, '');
          declarations.push({
            prop: prop.toLowerCase(),
            value,
            important,
            line: lineAt(css, offset - part.length - 1 + colon),
          });
        }
        rules.push({
          selector: normalizeSelector(css.slice(preludeStart, preludeStart + prelude.length)),
          context,
          line: lineAt(css, preludeStart),
          declarations,
        });
      }
      cursor = close;
    }
  };
  parseBlock(0, text.length, '');
  return rules;
}

/** Duplicate, identical and shadowed CSS in one stylesheet. */
export function findDeadCss(file: string, css: string): CssFinding[] {
  const findings: CssFinding[] = [];
  const rules = parseCssRules(css);
  const seenRules = new Map<string, Rule>();
  const lastDeclaration = new Map<string, { rule: Rule; declaration: Declaration }>();
  for (const rule of rules) {
    const seen = new Map<string, Declaration>();
    for (const declaration of rule.declarations) {
      const key = `${declaration.prop}:${declaration.value}:${declaration.important}`;
      const first = seen.get(key);
      if (first) {
        findings.push({
          file,
          line: declaration.line,
          code: 'duplicate-declaration',
          message: `${rule.selector} repeats ${declaration.prop}: ${declaration.value} (line ${first.line}).`,
        });
      }
      seen.set(key, declaration);
    }
    if (rule.declarations.length > 0) {
      const signature = `${rule.context} | ${rule.selector} | ${rule.declarations.map((d) => `${d.prop}:${d.value}:${d.important}`).join(';')}`;
      const earlier = seenRules.get(signature);
      if (earlier) {
        findings.push({
          file,
          line: rule.line,
          code: 'duplicate-rule',
          message: `${rule.selector} repeats the rule at line ${earlier.line}.`,
        });
        continue;
      }
      seenRules.set(signature, rule);
    }
    for (const declaration of rule.declarations) {
      const key = `${rule.context} | ${rule.selector} | ${declaration.prop}`;
      const previous = lastDeclaration.get(key);
      if (
        previous &&
        previous.rule !== rule &&
        !(previous.declaration.important && !declaration.important)
      ) {
        findings.push({
          file,
          line: previous.declaration.line,
          code: 'shadowed-declaration',
          message: `${rule.selector} { ${declaration.prop} } is always overridden at line ${declaration.line}.`,
        });
      }
      lastDeclaration.set(key, { rule, declaration });
    }
  }
  return findings;
}

interface SourceIndex {
  /** Every `tx-…` token in the sources, sorted (not counting `--tx-…` custom properties). */
  tokens: string[];
  /** Tokens directly followed by a template (`{`, `${`, or a quoted string and `+`). */
  templates: Set<string>;
}

let cached: { corpus: string; index: SourceIndex } | undefined;

function indexSources(corpus: string): SourceIndex {
  if (cached?.corpus === corpus) return cached.index;
  const tokens = new Set<string>();
  const templates = new Set<string>();
  for (const match of corpus.matchAll(/(?<![\w-])tx-[\w-]*/g)) {
    const token = match[0];
    tokens.add(token);
    const after = corpus.slice(
      (match.index ?? 0) + token.length,
      (match.index ?? 0) + token.length + 4
    );
    if (after.startsWith('{') || after.startsWith('${') || /^['"`] \+/.test(after))
      templates.add(token);
  }
  const index = { tokens: [...tokens].sort(), templates };
  cached = { corpus, index };
  return index;
}

/** Whether some token starts with `name` (the sorted array makes this a binary search). */
function hasTokenStartingWith(tokens: readonly string[], name: string): boolean {
  let low = 0;
  let high = tokens.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((tokens[mid] as string) < name) low = mid + 1;
    else high = mid;
  }
  return tokens[low]?.startsWith(name) ?? false;
}

/** Whether `name` can appear in markup: literally, or from a template with its prefix. */
export function classIsReferenced(name: string, corpus: string): boolean {
  const { tokens, templates } = indexSources(corpus);
  if (hasTokenStartingWith(tokens, name)) return true;
  for (let cut = name.length - 1; cut > 'tx-'.length; cut -= 1) {
    if (/[-_]/.test(name[cut - 1] ?? '') && templates.has(name.slice(0, cut))) return true;
  }
  return false;
}

export function findUnusedClasses(file: string, css: string, corpus: string): CssFinding[] {
  const text = mask(css);
  const findings: CssFinding[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(/\.(tx-[a-zA-Z0-9_-]+)/g)) {
    const name = match[1] as string;
    if (seen.has(name)) continue;
    seen.add(name);
    if (!classIsReferenced(name, corpus)) {
      findings.push({
        file,
        line: lineAt(css, match.index ?? 0),
        code: 'unused-class',
        message: `.${name} is not produced by any source file.`,
      });
    }
  }
  return findings;
}

function gitFiles(patterns: string[]): string[] {
  return execFileSync('git', ['ls-files', ...patterns], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

/** Check every committed package stylesheet. */
export function checkRepositoryCss(): { files: number; findings: CssFinding[] } {
  const stylesheets = gitFiles(['packages/*.css', 'packages/**/*.css']);
  const sources = gitFiles([
    'packages/**/*.svelte',
    'packages/**/*.ts',
    'apps/**/*.svelte',
    'apps/**/*.astro',
    'apps/**/*.ts',
    'tests/**/*.svelte',
    'tests/**/*.ts',
  ]);
  const corpus = sources.map((file) => readFileSync(file, 'utf8')).join('\n');
  const findings: CssFinding[] = [];
  for (const file of stylesheets) {
    const css = readFileSync(file, 'utf8');
    findings.push(...findDeadCss(file, css), ...findUnusedClasses(file, css, corpus));
  }
  return { files: stylesheets.length, findings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { files, findings } = checkRepositoryCss();
  if (findings.length === 0) {
    console.log(`check-css: ${files} stylesheets, no dead CSS.`);
  } else {
    for (const finding of findings) {
      console.error(`${finding.file}:${finding.line} ${finding.code} ${finding.message}`);
    }
    console.error(`check-css: ${findings.length} finding(s) in ${files} stylesheets.`);
    process.exit(1);
  }
}
