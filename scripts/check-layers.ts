/**
 * Layer guard (`pnpm exec tsx scripts/check-layers.ts [--root <dir>] [--json]`).
 *
 * Reads every workspace manifest (`packages/*`, `apps/*`) and every shipped
 * source file, and fails when:
 *
 * - a package depends on, or imports, a package in its own or a higher layer
 *   (dependencies point down only: see `LAYERS`);
 * - an import reaches into another package past its public `exports` (for
 *   example `@texuli/core/src/...`, or a relative path out of the package);
 * - anything depends on or imports `@protoyard/*`, `dexie` or `@faker-js/*`;
 * - shipped code uses an HTML or code sink: `{@html}`, `eval(`,
 *   `new Function(`, an `innerHTML` / `outerHTML` assignment or
 *   `insertAdjacentHTML(`;
 * - shipped Svelte markup has a static `style="..."` attribute (dynamic
 *   `style={...}`, `style="...{x}..."` and `style:` directives are fine).
 *
 * Comments and string contents are masked before sinks are searched, so a
 * doc comment that says "never use {@html}" passes. Exit codes: 0 clean,
 * 1 findings, 2 usage error.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Layer of every workspace package. A package may only depend on lower layers. */
export const LAYERS: Readonly<Record<string, number>> = Object.freeze({
  '@texuli/core': 0,
  '@texuli/date': 0,
  '@texuli/drag': 0,
  // L0: the framework-free, dependency-free deck engine (ADR-009).
  '@texuli/deck': 0,
  // L0: the framework-free blueprint contract — the cross-language spine
  // consumed by every layer (spec-compose-design.md B1).
  '@texuli/spec': 0,
  '@texuli/primitives': 1,
  '@texuli/tokens': 2,
  texuli: 3,
  '@texuli/charts': 4,
  '@texuli/chat': 4,
  '@texuli/data': 4,
  '@texuli/editor': 4,
  '@texuli/media': 4,
  '@texuli/workflows': 4,
  '@texuli/blocks': 5,
  '@texuli/catalog': 6,
  '@texuli/tools': 8,
  // L7: the Svelte player paints validated blueprints (roadmap D4).
  '@texuli/player': 7,
  // L8: the slides stage presents @texuli/deck decks and paints any
  // slide-renderable component through the player (ADR-009).
  // L8: adapters and hosts that consume the library (astro integration;
  // tools wraps the player, so it sits above it per roadmap D4).
  '@texuli/astro': 8,
  '@texuli/slides': 8,
});

/**
 * Workspace packages that consume the library but are not a layer (private
 * demos). They may import any layer, and every other rule still applies.
 */
export const CONSUMERS: ReadonlySet<string> = new Set(['@texuli/examples']);

export const RULES = [
  'layer',
  'unknown-layer',
  'deep-import',
  'banned-dependency',
  'banned-import',
  'html-sink',
  'code-sink',
  'static-style',
] as const;
export type Rule = (typeof RULES)[number];

export interface Finding {
  /** Path relative to the workspace root, with `/` separators. */
  file: string;
  /** 1-based line, or 0 for a manifest-level finding. */
  line: number;
  rule: Rule;
  message: string;
}

const BANNED: readonly { test: (name: string) => boolean; label: string }[] = [
  {
    test: (name) => name.startsWith('@protoyard/'),
    label: '@protoyard/* (Protoyard consumes Texuli, never the reverse)',
  },
  { test: (name) => name === 'dexie', label: 'dexie (no storage engine in the library)' },
  {
    test: (name) => name.startsWith('@faker-js/'),
    label: '@faker-js/* (no data generation in the library)',
  },
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs', '.svelte']);
const RUNTIME_SECTIONS = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const;
const ALL_SECTIONS = [...RUNTIME_SECTIONS, 'devDependencies'] as const;

interface Manifest {
  name?: string;
  exports?: unknown;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface WorkspacePackage {
  name: string;
  dir: string;
  /** `packages/*` ship; `apps/*` consume. */
  kind: 'package' | 'app';
  manifest: Manifest;
  manifestPath: string;
}

/** `@scope/name/sub` → `@scope/name`; `name/sub` → `name`. */
export function packageNameOf(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

function bannedLabel(name: string): string | null {
  return BANNED.find((entry) => entry.test(name))?.label ?? null;
}

/**
 * Blanks comments (and, with `strings`, string and template-literal text)
 * while keeping every newline, so indexes and line numbers stay valid.
 * Template `${...}` expressions stay code. Regex literals are not detected.
 */
export function maskCode(source: string, options: { strings: boolean }): string {
  const out = source.split('');
  const blank = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  // A stack of template-literal depths: each entry counts open braces in its `${...}`.
  const templates: number[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    const inTemplateExpression = templates.length > 0;
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (char === '"' || char === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== char && source[j] !== '\n') {
        j += source[j] === '\\' ? 2 : 1;
      }
      if (options.strings) blank(i + 1, j);
      i = j + 1;
    } else if (char === '`' || (char === '}' && inTemplateExpression && templates.at(-1) === 0)) {
      // Start of a template literal, or the end of a `${...}` back into one.
      if (char === '}') templates.pop();
      let j = i + 1;
      while (
        j < source.length &&
        source[j] !== '`' &&
        !(source[j] === '$' && source[j + 1] === '{')
      ) {
        j += source[j] === '\\' ? 2 : 1;
      }
      if (options.strings) blank(i + 1, j);
      if (source[j] === '$') {
        templates.push(0);
        i = j + 2;
      } else {
        i = j + 1;
      }
    } else {
      if (inTemplateExpression && char === '{')
        templates[templates.length - 1] = (templates.at(-1) ?? 0) + 1;
      if (inTemplateExpression && char === '}')
        templates[templates.length - 1] = (templates.at(-1) ?? 1) - 1;
      i++;
    }
  }
  return out.join('');
}

/** Blanks `<!-- ... -->` comments in Svelte markup, keeping newlines. */
function maskHtmlComments(markup: string): string {
  return markup.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '));
}

interface SvelteParts {
  /** The file with only its `<script>` contents kept (everything else blanked). */
  script: string;
  /** The file with `<script>` and `<style>` blocks and HTML comments blanked. */
  markup: string;
}

/** Splits a Svelte file into its script and markup, both the full file length. */
export function splitSvelte(source: string): SvelteParts {
  const blankAll = (text: string) => text.replace(/[^\n]/g, ' ');
  let script = blankAll(source);
  let markup = source;
  for (const match of source.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1\s*>/g)) {
    const start = match.index ?? 0;
    const whole = match[0];
    const bodyStart = start + whole.indexOf('>') + 1;
    const body = match[2] ?? '';
    markup = markup.slice(0, start) + blankAll(whole) + markup.slice(start + whole.length);
    if (match[1] === 'script') {
      script = script.slice(0, bodyStart) + body + script.slice(bodyStart + body.length);
    }
  }
  return { script, markup: maskHtmlComments(markup) };
}

export interface ImportSite {
  specifier: string;
  index: number;
}

const IMPORT_PATTERNS = [
  // import x from 'y', import { a } from 'y', import type T from 'y', import 'y'
  /\bimport\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?(['"])([^'"\n]+)\1/g,
  // export * from 'y', export { a } from 'y', export type { T } from 'y'
  /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s+(['"])([^'"\n]+)\1/g,
  // import('y')
  /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
  // require('y')
  /\brequire\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
];

/** Import specifiers in code whose comments are already masked. */
export function importsOf(code: string): ImportSite[] {
  const sites: ImportSite[] = [];
  // A keyword blanked when string contents are masked sits inside a string literal
  // (for example a migration table showing an old import): it is text, not an import.
  const withoutStrings = maskCode(code, { strings: true });
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of code.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (withoutStrings[index] === ' ' && code[index] !== ' ') continue;
      sites.push({ specifier: match[2] ?? '', index });
    }
  }
  return sites.sort((a, b) => a.index - b.index);
}

const CODE_SINKS: readonly { pattern: RegExp; rule: Rule; what: string }[] = [
  { pattern: /(?<![\w$.])eval\s*\(/g, rule: 'code-sink', what: 'eval(' },
  { pattern: /\bnew\s+Function\s*\(/g, rule: 'code-sink', what: 'new Function(' },
  {
    pattern: /\.(?:innerHTML|outerHTML)\s*(?:\+?=)(?!=)/g,
    rule: 'html-sink',
    what: 'an innerHTML or outerHTML assignment',
  },
  { pattern: /\binsertAdjacentHTML\s*\(/g, rule: 'html-sink', what: 'insertAdjacentHTML(' },
];

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

/** Sink findings in code (comments and strings already masked). */
function codeSinks(masked: string): { index: number; rule: Rule; message: string }[] {
  const out: { index: number; rule: Rule; message: string }[] = [];
  for (const sink of CODE_SINKS) {
    for (const match of masked.matchAll(sink.pattern)) {
      out.push({
        index: match.index ?? 0,
        rule: sink.rule,
        message: `uses ${sink.what}: never turn data into HTML or code`,
      });
    }
  }
  return out;
}

/** Findings in Svelte markup: `{@html}` and static `style` attributes. */
function markupFindings(markup: string): { index: number; rule: Rule; message: string }[] {
  const out: { index: number; rule: Rule; message: string }[] = [];
  for (const match of markup.matchAll(/\{@html\b/g)) {
    out.push({
      index: match.index ?? 0,
      rule: 'html-sink',
      message: 'uses {@html}: render text, or a sanitized component',
    });
  }
  // `style=` as an attribute (not `style:prop`), quoted or bare, with no `{` in its value.
  for (const match of markup.matchAll(/(?<=[\s"'])style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g)) {
    const value = match[1] ?? '';
    if (value.includes('{')) continue;
    out.push({
      index: match.index ?? 0,
      rule: 'static-style',
      message: `has a static style=${value}: use classes, tokens or a style: directive`,
    });
  }
  // Code sinks inside markup expressions ({eval(x)}, onclick={() => el.innerHTML = x}).
  out.push(...codeSinks(maskCode(markup, { strings: true })));
  return out;
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.'))
      continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(path));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name)) && !entry.name.endsWith('.d.ts'))
      out.push(path);
  }
  return out.sort();
}

const NOT_SHIPPED = new Set(['tests', 'test', 'docs', 'fixtures', 'scripts', 'public']);

function shippedFiles(packageDir: string): string[] {
  if (!existsSync(packageDir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(packageDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || NOT_SHIPPED.has(entry.name)) continue;
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.'))
      continue;
    out.push(...listFiles(join(packageDir, entry.name)));
  }
  return out.sort();
}

function readWorkspace(root: string): WorkspacePackage[] {
  const packages: WorkspacePackage[] = [];
  for (const [folder, kind] of [
    ['packages', 'package'],
    ['apps', 'app'],
  ] as const) {
    const base = join(root, folder);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base).sort()) {
      const dir = join(base, entry);
      const manifestPath = join(dir, 'package.json');
      if (!statSync(dir).isDirectory() || !existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
      packages.push({ name: manifest.name ?? entry, dir, kind, manifest, manifestPath });
    }
  }
  return packages;
}

/** Public subpaths of a manifest's `exports` (`.` when it has none). */
function exportedSubpaths(manifest: Manifest): Set<string> {
  const exportsField = manifest.exports;
  if (exportsField === undefined || typeof exportsField === 'string') return new Set(['.']);
  if (exportsField && typeof exportsField === 'object') {
    const keys = Object.keys(exportsField);
    // A conditions object (`{ import, types }`) is the `.` entry.
    return new Set(keys.every((key) => key.startsWith('.')) ? keys : ['.']);
  }
  return new Set(['.']);
}

function isExported(subpath: string, exported: Set<string>): boolean {
  if (exported.has(subpath)) return true;
  // `./icons/*` style patterns.
  return [...exported].some((key) => {
    const star = key.indexOf('*');
    return (
      star >= 0 && subpath.startsWith(key.slice(0, star)) && subpath.endsWith(key.slice(star + 1))
    );
  });
}

/** Runs every rule over the workspace at `root`. */
export function checkWorkspace(root: string): Finding[] {
  const findings: Finding[] = [];
  const rel = (path: string) => relative(root, path).split(sep).join('/');
  const workspace = readWorkspace(root);
  const byName = new Map(workspace.map((pkg) => [pkg.name, pkg]));
  const layerOf = (name: string) => LAYERS[name];
  const isWorkspace = (name: string) => byName.has(name) || name in LAYERS;

  for (const pkg of workspace) {
    const ownLayer = layerOf(pkg.name);
    const consumer = pkg.kind === 'app' || CONSUMERS.has(pkg.name);
    if (pkg.kind === 'package' && ownLayer === undefined && !consumer) {
      findings.push({
        file: rel(pkg.manifestPath),
        line: 0,
        rule: 'unknown-layer',
        message: `${pkg.name} has no layer: add it to LAYERS (or CONSUMERS) in scripts/check-layers.ts`,
      });
    }

    // Manifest: banned packages anywhere; workspace dependencies point down.
    for (const section of ALL_SECTIONS) {
      for (const dependency of Object.keys(pkg.manifest[section] ?? {})) {
        const banned = bannedLabel(dependency);
        if (banned) {
          findings.push({
            file: rel(pkg.manifestPath),
            line: 0,
            rule: 'banned-dependency',
            message: `${section} lists ${banned}`,
          });
        }
      }
    }
    if (ownLayer !== undefined && !consumer) {
      for (const section of RUNTIME_SECTIONS) {
        for (const dependency of Object.keys(pkg.manifest[section] ?? {})) {
          const target = layerOf(dependency);
          if (target !== undefined && target >= ownLayer) {
            findings.push({
              file: rel(pkg.manifestPath),
              line: 0,
              rule: 'layer',
              message: `${pkg.name} (L${ownLayer}) ${section} lists ${dependency} (L${target}): dependencies point down only`,
            });
          }
        }
      }
    }

    // Sources: everything a package ships, not only `src/` (tools keeps `mcp/`,
    // `elements/` and `cli-init/` beside it). Tests, docs and fixtures are not shipped.
    for (const file of shippedFiles(pkg.dir)) {
      const source = readFileSync(file, 'utf8');
      const svelte = file.endsWith('.svelte');
      const parts = svelte ? splitSvelte(source) : { script: source, markup: '' };
      const code = maskCode(parts.script, { strings: false });
      const at = (index: number) => lineOf(source, index);

      for (const site of importsOf(code)) {
        const { specifier } = site;
        const line = at(site.index);
        if (specifier.startsWith('.')) {
          const target = resolve(dirname(file), specifier);
          if (target !== pkg.dir && !target.startsWith(pkg.dir + sep)) {
            findings.push({
              file: rel(file),
              line,
              rule: 'deep-import',
              message: `imports ${specifier}, outside ${pkg.name}: import the package by name`,
            });
          }
          continue;
        }
        const name = packageNameOf(specifier);
        const banned = bannedLabel(name);
        if (banned) {
          findings.push({
            file: rel(file),
            line,
            rule: 'banned-import',
            message: `imports ${banned}`,
          });
          continue;
        }
        if (!isWorkspace(name) || name === pkg.name) continue;
        const subpath = `.${specifier.slice(name.length)}` || '.';
        const target = byName.get(name);
        if (
          subpath !== '.' &&
          (subpath.startsWith('./src') ||
            !target ||
            !isExported(subpath, exportedSubpaths(target.manifest)))
        ) {
          findings.push({
            file: rel(file),
            line,
            rule: 'deep-import',
            message: `imports ${specifier}, past ${name}'s public exports`,
          });
        }
        const targetLayer = layerOf(name);
        if (
          ownLayer !== undefined &&
          !consumer &&
          targetLayer !== undefined &&
          targetLayer >= ownLayer
        ) {
          findings.push({
            file: rel(file),
            line,
            rule: 'layer',
            message: `${pkg.name} (L${ownLayer}) imports ${name} (L${targetLayer}): dependencies point down only`,
          });
        }
      }

      const sinks = [
        ...codeSinks(maskCode(parts.script, { strings: true })),
        ...(svelte ? markupFindings(parts.markup) : []),
      ];
      for (const sink of sinks) {
        findings.push({
          file: rel(file),
          line: at(sink.index),
          rule: sink.rule,
          message: sink.message,
        });
      }
    }
  }
  // Code-unit order (not locale order), so the report is identical on every machine.
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return findings.sort(
    (a, b) => compare(a.file, b.file) || a.line - b.line || compare(a.rule, b.rule)
  );
}

/** CLI entry: returns the exit code. */
export function run(args: readonly string[], out: (text: string) => void = console.log): number {
  let root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') json = true;
    else if (arg === '--root' && args[i + 1]) root = resolve(args[++i] as string);
    else {
      out(`Unknown argument: ${arg}\nUsage: tsx scripts/check-layers.ts [--root <dir>] [--json]`);
      return 2;
    }
  }
  const findings = checkWorkspace(root);
  if (json) out(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else if (findings.length === 0)
    out('✓ Layer guard: dependencies point down; no banned imports, sinks or static styles.');
  else {
    for (const f of findings)
      out(`${f.file}${f.line ? `:${f.line}` : ''}  ${f.rule}  ${f.message}`);
    out(`✗ Layer guard: ${findings.length} finding(s).`);
  }
  return findings.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = run(process.argv.slice(2));
}
