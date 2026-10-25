/**
 * Validate the distributable Texuli skill pack under `skills/texuli/`.
 *
 * Checks:
 * 1. Required files exist
 * 2. Every SKILL.md frontmatter (Open Agent Skills + host metadata)
 * 3. Relative Markdown links stay inside the pack
 * 4. Every fenced command is real and offline (root scripts, workspace package
 *    scripts, local binaries, repository paths, setup.sh flags), every
 *    `texuli …` command exists in the CLI usage, JSON snippets parse and
 *    Texuli imports in TS/Svelte snippets name real package exports
 * 5. SHA256SUMS matches every file (or `--write-sums` regenerates it)
 *
 * Offline only — no network.
 *
 *   pnpm exec tsx scripts/check-skill.ts
 *   pnpm exec tsx scripts/check-skill.ts --write-sums
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SKILL_NAME = /^texuli(?:-[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const DOCUMENTATION_URL = 'https://texuli.com/docs/';
const ALLOWED_TOOLS = new Set(['Bash', 'Read', 'Grep', 'Glob', 'Edit', 'Write']);

const REQUIRED_RELATIVE = [
  'SKILL.md',
  'TRUST.md',
  'setup.sh',
  'SHA256SUMS',
  'router/routes.md',
  'router/hosts.md',
] as const;

export type FrontmatterValue = boolean | number | string | FrontmatterMap | FrontmatterValue[];

export interface FrontmatterMap {
  [key: string]: FrontmatterValue;
}

export interface SkillIssue {
  file: string;
  field: string;
  message: string;
}

type FrontmatterStackEntry = {
  indent: number;
  value: FrontmatterMap | FrontmatterValue[];
};

function scalar(value: string): FrontmatterValue {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const quote = trimmed[0];
    const body = trimmed.slice(1, -1);
    return quote === '"'
      ? body.replace(/\\(["\\nrt])/g, (_m, escaped: string) => {
          if (escaped === 'n') return '\n';
          if (escaped === 'r') return '\r';
          if (escaped === 't') return '\t';
          return escaped;
        })
      : body.replace(/''/g, "'");
  }
  if (trimmed === '[]') return [];
  if (trimmed === '{}') return {};
  return trimmed;
}

function stripComment(line: string): string {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if ((character === '"' || character === "'") && line[index - 1] !== '\\') {
      quote = quote === character ? null : (quote ?? character);
    }
    if (character === '#' && quote === null && (index === 0 || /\s/.test(line[index - 1] ?? ''))) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line;
}

export function parseFrontmatter(source: string): { values: FrontmatterMap; raw: string } {
  const opening = source.startsWith('---\n') || source.startsWith('---\r\n');
  if (!opening) throw new Error('frontmatter must start with ---');
  const lines = source.split(/\r?\n/);
  const closing = lines.findIndex((line, index) => index > 0 && line === '---');
  if (closing < 0) throw new Error('frontmatter must close with ---');
  const rawLines = lines.slice(1, closing);
  const values: FrontmatterMap = {};
  const stack: FrontmatterStackEntry[] = [{ indent: -1, value: values }];

  for (let index = 0; index < rawLines.length; index += 1) {
    const original = rawLines[index] ?? '';
    if (/\t/.test(original)) throw new Error(`frontmatter line ${index + 2} contains a tab`);
    const line = stripComment(original);
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    while (stack.length > 1 && indent <= (stack.at(-1)?.indent ?? -1)) stack.pop();
    const parentEntry = stack.at(-1);
    if (!parentEntry) throw new Error(`frontmatter line ${index + 2} has no parent`);
    const parent = parentEntry.value;
    const content = line.trim();
    if (content.startsWith('- ')) {
      if (!Array.isArray(parent)) {
        throw new Error(`frontmatter line ${index + 2} has an unexpected list item`);
      }
      parent.push(scalar(content.slice(2)));
      continue;
    }
    if (Array.isArray(parent)) throw new Error(`frontmatter line ${index + 2} needs a list item`);
    const separator = content.indexOf(':');
    if (separator < 1) throw new Error(`frontmatter line ${index + 2} needs key: value`);
    const key = content.slice(0, separator).trim();
    const rawValue = content.slice(separator + 1).trim();
    if (key in parent) throw new Error(`frontmatter line ${index + 2} repeats key '${key}'`);
    if (rawValue) {
      parent[key] = scalar(rawValue);
      continue;
    }
    const next = rawLines.slice(index + 1).find((candidate) => candidate.trim());
    const nextContent = next?.trim() ?? '';
    const nextIndent = next ? next.length - next.trimStart().length : -1;
    const child: FrontmatterMap | FrontmatterValue[] =
      nextIndent > indent && nextContent.startsWith('- ') ? [] : {};
    parent[key] = child;
    stack.push({ indent, value: child });
  }
  return { values, raw: rawLines.join('\n') };
}

function asMap(value: FrontmatterValue | undefined): FrontmatterMap | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function issue(file: string, field: string, message: string): SkillIssue {
  return { file, field, message };
}

/**
 * Expected `name` for a SKILL.md: `texuli` at pack root, `texuli-<folder>` nested.
 */
export function expectedSkillName(skillsRoot: string, path: string): string {
  const folder = relative(skillsRoot, dirname(path));
  if (folder === '' || folder === '.') return 'texuli';
  return `texuli-${folder.split(/[\\/]/).filter(Boolean).join('-')}`;
}

export function validateFrontmatterParsed(
  file: string,
  parsed: { values: FrontmatterMap; raw: string },
  expectedName?: string
): SkillIssue[] {
  const values = parsed.values;
  const issues: SkillIssue[] = [];
  const name = values.name;
  if (typeof name !== 'string' || !name) {
    issues.push(issue(file, 'name', 'is required and must be a string'));
  } else if (!SKILL_NAME.test(name)) {
    issues.push(
      issue(file, 'name', `must be namespaced kebab-case beginning with texuli (got '${name}')`)
    );
  } else if (expectedName !== undefined && name !== expectedName) {
    issues.push(
      issue(file, 'name', `must be '${expectedName}' to match its folder (got '${name}')`)
    );
  }

  const description = values.description;
  if (typeof description !== 'string' || !description.trim()) {
    issues.push(issue(file, 'description', 'is required and must be non-empty text'));
  }

  const version = values.version;
  const rawVersion = parsed.raw.match(/^version:\s*(.*)$/m)?.[1]?.trim();
  if (typeof version !== 'string' || !version) {
    issues.push(issue(file, 'version', 'is required and must be a quoted SemVer string'));
  } else if (!rawVersion || !/^(["']).*\1$/.test(rawVersion)) {
    issues.push(issue(file, 'version', 'must be quoted (for example version: "0.1.0")'));
  } else if (!SEMVER.test(version)) {
    issues.push(issue(file, 'version', `must be SemVer-shaped X.Y.Z (got '${version}')`));
  }

  if (values.homepage !== undefined) {
    issues.push(issue(file, 'homepage', 'is forbidden; use documentation_url instead'));
  }
  if (values.documentation_url !== DOCUMENTATION_URL) {
    issues.push(issue(file, 'documentation_url', `must be ${DOCUMENTATION_URL}`));
  }

  if (typeof values['user-invocable'] !== 'boolean') {
    issues.push(
      issue(file, 'user-invocable', 'is required and must be the YAML boolean true or false')
    );
  }

  const allowedTools = values['allowed-tools'];
  if (typeof allowedTools !== 'string' || !allowedTools.trim()) {
    issues.push(
      issue(file, 'allowed-tools', 'is required and must be a non-empty comma-separated list')
    );
  } else {
    for (const tool of allowedTools.split(',').map((part) => part.trim())) {
      if (!ALLOWED_TOOLS.has(tool)) {
        issues.push(issue(file, 'allowed-tools', `contains unsupported tool '${tool}'`));
      }
    }
  }

  const metadata = asMap(values.metadata);
  const openclaw = asMap(metadata?.openclaw);
  if (!openclaw) {
    issues.push(issue(file, 'metadata.openclaw', 'is required and must be a mapping'));
  } else {
    if (typeof openclaw.emoji !== 'string' || !openclaw.emoji.trim()) {
      issues.push(issue(file, 'metadata.openclaw.emoji', 'is required and must be non-empty text'));
    }
    if (openclaw.homepage !== DOCUMENTATION_URL) {
      issues.push(issue(file, 'metadata.openclaw.homepage', `must be ${DOCUMENTATION_URL}`));
    }
    const requires = asMap(openclaw.requires);
    const anyBins = requires?.anyBins;
    if (
      !Array.isArray(anyBins) ||
      anyBins.length === 0 ||
      anyBins.some((bin) => typeof bin !== 'string' || !bin.trim())
    ) {
      issues.push(
        issue(
          file,
          'metadata.openclaw.requires.anyBins',
          'is required and must be a non-empty list of binary names'
        )
      );
    }
  }
  return issues;
}

export function validateSkillFile(
  path: string,
  displayPath = path,
  expectedName?: string
): SkillIssue[] {
  try {
    const source = readFileSync(path, 'utf8');
    return validateFrontmatterParsed(displayPath, parseFrontmatter(source), expectedName);
  } catch (error) {
    return [
      issue(displayPath, 'frontmatter', error instanceof Error ? error.message : String(error)),
    ];
  }
}

function findSkillMdFiles(root: string): string[] {
  const found: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory).sort()) {
      if (entry === 'node_modules' || entry === '.git') continue;
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) visit(path);
      else if (entry === 'SKILL.md') found.push(path);
    }
  };
  if (existsSync(root)) visit(root);
  return found;
}

function listPackFiles(skillRoot: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory).sort()) {
      if (entry === '.DS_Store') continue;
      const path = join(directory, entry);
      const st = statSync(path);
      if (st.isDirectory()) visit(path);
      else if (st.isFile()) {
        const rel = relative(skillRoot, path).split(sep).join('/');
        if (rel !== 'SHA256SUMS') files.push(rel);
      }
    }
  };
  visit(skillRoot);
  return files.sort((a, b) => a.localeCompare(b));
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function writeSkillChecksums(skillRoot: string): string {
  const files = listPackFiles(skillRoot);
  const lines = files.map((rel) => `${sha256File(join(skillRoot, rel))}  ${rel}`);
  const body = `${lines.join('\n')}\n`;
  writeFileSync(join(skillRoot, 'SHA256SUMS'), body, 'utf8');
  return body;
}

export function verifySkillChecksums(skillRoot: string): SkillIssue[] {
  const sumsPath = join(skillRoot, 'SHA256SUMS');
  if (!existsSync(sumsPath)) {
    return [issue('SHA256SUMS', 'file', 'is missing')];
  }
  const issues: SkillIssue[] = [];
  const listed = new Set<string>();
  const text = readFileSync(sumsPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^([0-9a-fA-F]{64})\s+\*?(.+)$/.exec(line);
    if (!match) {
      issues.push(issue('SHA256SUMS', 'line', `malformed: ${line}`));
      continue;
    }
    const hash = (match[1] ?? '').toLowerCase();
    const rel = (match[2] ?? '').trim();
    if (rel.startsWith('/') || rel.includes('..')) {
      issues.push(issue('SHA256SUMS', rel, 'unsafe path'));
      continue;
    }
    listed.add(rel);
    const full = join(skillRoot, rel);
    if (!existsSync(full)) {
      issues.push(issue(rel, 'checksum', 'missing file'));
      continue;
    }
    if (sha256File(full) !== hash) {
      issues.push(issue(rel, 'checksum', 'content does not match SHA256SUMS'));
    }
  }
  for (const rel of listPackFiles(skillRoot)) {
    if (!listed.has(rel)) {
      issues.push(issue(rel, 'checksum', 'file is not listed in SHA256SUMS'));
    }
  }
  return issues;
}

function isInside(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot === '' ||
    (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !isAbsolute(pathFromRoot))
  );
}

function withoutMarkdownCode(text: string): string {
  return text
    .replace(/^\s*```[^\n]*\n[\s\S]*?^\s*```[^\n]*(?:\n|$)/gm, (block) =>
      block.replace(/[^\n]/g, ' ')
    )
    .replace(/`[^`\n]*`/g, (code) => code.replace(/[^\n]/g, ' '));
}

export function findMarkdownLinks(markdown: string): { destination: string; line: number }[] {
  const searchable = withoutMarkdownCode(markdown);
  const matches: { destination: string; line: number }[] = [];
  const patterns = [
    /!?\[[^\]\n]*\]\(\s*(?:<([^>\n]*)>|([^\s)]+))(?:\s+[^)]*)?\s*\)/g,
    /^\s*\[[^\]\n]+\]:\s*(?:<([^>\n]*)>|([^\s]+))/gm,
  ];
  for (const pattern of patterns) {
    for (const match of searchable.matchAll(pattern)) {
      const destination = match[1] ?? match[2];
      if (destination === undefined) continue;
      const index = match.index ?? 0;
      matches.push({
        destination,
        line: searchable.slice(0, index).split('\n').length,
      });
    }
  }
  return matches;
}

function markdownFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory).sort()) {
      const path = join(directory, entry);
      if (statSync(path).isSymbolicLink()) continue;
      if (statSync(path).isDirectory()) visit(path);
      else if (entry.toLowerCase().endsWith('.md')) files.push(path);
    }
  };
  visit(root);
  return files;
}

export function validateSkillLinks(skillRoot: string): SkillIssue[] {
  const issues: SkillIssue[] = [];
  for (const sourcePath of markdownFiles(skillRoot)) {
    const markdown = readFileSync(sourcePath, 'utf8');
    for (const { destination, line } of findMarkdownLinks(markdown)) {
      if (/^[a-z][a-z\d+.-]*:/i.test(destination) || destination.startsWith('//')) continue;
      const pathPart = destination.split(/[?#]/, 1)[0] ?? '';
      if (pathPart === '') continue;
      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(pathPart);
      } catch {
        issues.push(
          issue(relative(skillRoot, sourcePath), `link:${line}`, 'invalid percent encoding')
        );
        continue;
      }
      const targetPath = resolve(dirname(sourcePath), decodedPath);
      const source = relative(skillRoot, sourcePath).split(sep).join('/');
      if (!isInside(skillRoot, targetPath)) {
        issues.push(
          issue(source, `link:${line}`, `${destination} resolves outside the skill pack`)
        );
        continue;
      }
      if (!existsSync(targetPath)) {
        issues.push(issue(source, `link:${line}`, `${destination} target does not exist`));
      }
    }
  }
  return issues;
}

// ─── Commands, CLI references and snippets ─────────────────────────────────
// "Every command and snippet in the skill runs or validates": each fenced
// bash line must name something real (a root script, a workspace package
// script, a local binary, a file in the repository, a setup.sh flag), every
// `texuli …` command must exist in the CLI's usage text, JSON snippets must
// parse and Texuli imports must name real package exports. Offline: nothing
// here touches the network, and network commands are rejected.

export interface CodeBlock {
  lang: string;
  code: string;
  /** 1-based line of the opening fence. */
  line: number;
}

/** Fenced code blocks of a Markdown file. */
export function codeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  // `[ \t]*`, not `\s*`: `\s` would swallow the blank line before a fence
  // and report the block one line early.
  const pattern = /^[ \t]*```([\w-]*)[^\n]*\n([\s\S]*?)^[ \t]*```/gm;
  for (const match of markdown.matchAll(pattern)) {
    blocks.push({
      lang: (match[1] ?? '').toLowerCase(),
      code: match[2] ?? '',
      line: markdown.slice(0, match.index ?? 0).split('\n').length,
    });
  }
  return blocks;
}

/** Commands a Texuli CLI declares in its usage text (`init`, `theme preview`, …). */
export function cliCommands(repoRoot: string): Set<string> {
  const commands = new Set<string>();
  const cliRoot = join(repoRoot, 'packages', 'tools', 'src');
  if (!existsSync(cliRoot)) return commands;
  for (const entry of readdirSync(cliRoot)) {
    const cli = join(cliRoot, entry, 'cli.ts');
    if (!existsSync(cli)) continue;
    for (const match of readFileSync(cli, 'utf8').matchAll(
      /\btexuli ([a-z][a-z-]*)(?: ([a-z][a-z-]*))?/g
    )) {
      const command = match[1] as string;
      commands.add(command);
      if (match[2]) commands.add(`${command} ${match[2]}`);
    }
  }
  return commands;
}

/** True when a command or path is a documented placeholder (`<id>`, `…`). */
function isPlaceholder(word: string): boolean {
  return /[<>…]|\.\.\./.test(word);
}

export interface CommandContext {
  repoRoot: string;
  rootScripts: Set<string>;
  /** Workspace package name → its scripts. */
  packageScripts: Map<string, Set<string>>;
  bins: Set<string>;
  setupFlags: Set<string>;
  cli: Set<string>;
}

export function commandContext(repoRoot: string): CommandContext {
  const readJson = (path: string) =>
    JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const rootPackage = readJson(join(repoRoot, 'package.json'));
  const packageScripts = new Map<string, Set<string>>();
  for (const parent of ['packages', 'apps']) {
    const dir = join(repoRoot, parent);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const manifest = join(dir, entry, 'package.json');
      if (!existsSync(manifest)) continue;
      const pkg = readJson(manifest);
      packageScripts.set(String(pkg.name), new Set(Object.keys((pkg.scripts as object) ?? {})));
    }
  }
  const binDir = join(repoRoot, 'node_modules', '.bin');
  const setup = join(repoRoot, 'skills', 'texuli', 'setup.sh');
  return {
    repoRoot,
    rootScripts: new Set(Object.keys((rootPackage.scripts as object) ?? {})),
    packageScripts,
    bins: new Set(existsSync(binDir) ? readdirSync(binDir) : []),
    setupFlags: new Set(
      existsSync(setup) ? (readFileSync(setup, 'utf8').match(/--[a-z][a-z-]*/g) ?? []) : []
    ),
    cli: cliCommands(repoRoot),
  };
}

const NETWORK = new Set(['curl', 'wget', 'ssh', 'scp', 'rsync', 'nc']);
const LOCAL_GIT = new Set([
  'merge',
  'status',
  'diff',
  'log',
  'show',
  'add',
  'commit',
  'switch',
  'checkout',
  'stash',
  'rev-parse',
]);

function pathsExist(ctx: CommandContext, words: string[]): string[] {
  return words
    .filter((word) => !word.startsWith('-') && !isPlaceholder(word) && /[/.]/.test(word))
    .filter((word) => !existsSync(join(ctx.repoRoot, word)))
    .map((word) => `${word} does not exist in the repository`);
}

/** Problems with one shell command line (empty when it is real and offline). */
export function checkCommand(line: string, ctx: CommandContext): string[] {
  const words = line
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    // Environment assignments (TEXULI_E2E_PORT=4830) prefix the command.
    .filter(
      (word, index, all) =>
        !(
          /^[A-Z][A-Z0-9_]*=/.test(word) &&
          all.slice(0, index).every((w) => /^[A-Z][A-Z0-9_]*=/.test(w))
        )
    );
  const [head, second, third, ...rest] = words;
  if (!head) return [];
  if (NETWORK.has(head)) return [`${head} needs the network; the skill must work offline`];
  if (head === 'setup.sh' || head.endsWith('/setup.sh')) {
    // The pack's setup.sh, from a checkout or an unpacked release archive.
    const unknown = words
      .slice(1)
      .filter((word) => word.startsWith('--') && !ctx.setupFlags.has(word.split('=')[0] as string));
    return unknown.map((flag) => `setup.sh has no ${flag} option`);
  }
  switch (head) {
    case 'pnpm': {
      if (second === 'dlx') return ['pnpm dlx downloads packages; the skill must work offline'];
      if (second === 'exec') {
        if (third === 'tsx') return pathsExist(ctx, rest.slice(0, 1));
        if (!third || !ctx.bins.has(third))
          return [`pnpm exec ${third ?? ''}: no such local binary`];
        return third === 'playwright' || third === 'vitest' ? pathsExist(ctx, rest) : [];
      }
      if (second === '--filter') {
        const scripts = third ? ctx.packageScripts.get(third) : undefined;
        if (!scripts) return [`pnpm --filter ${third ?? ''}: no such workspace package`];
        const script = rest[0];
        return script && !scripts.has(script) ? [`${third} has no "${script}" script`] : [];
      }
      if (second === 'vitest' || second === 'test')
        return pathsExist(
          ctx,
          [third ?? '', ...rest].filter((word) => word !== 'run')
        );
      if (!second || !ctx.rootScripts.has(second))
        return [`pnpm ${second ?? ''}: no such root script`];
      return [];
    }
    case 'npx':
      return second && ctx.bins.has(second)
        ? pathsExist(
            ctx,
            rest.concat(third ?? []).filter((w) => w !== 'check')
          )
        : [`npx ${second ?? ''}: no local binary (npx would download it)`];
    case 'git':
      if (
        second === 'push' ||
        second === 'remote' ||
        second === 'fetch' ||
        second === 'pull' ||
        second === 'clone'
      ) {
        return [`git ${second} reaches a remote; the skill never does`];
      }
      return second && LOCAL_GIT.has(second)
        ? []
        : [`git ${second ?? ''}: not an allowed local command`];
    case 'texuli': {
      const sub = [second, third].filter(Boolean).join(' ');
      return ctx.cli.has(sub) || (second && ctx.cli.has(second))
        ? []
        : [`texuli ${sub}: not a Texuli CLI command`];
    }
    case 'cd':
    case 'echo':
    case 'ls':
    case 'cat':
    case 'mkdir':
    case 'tar':
    case 'shasum':
    case 'sha256sum':
      return [];
    default:
      return [`${head}: unknown command (add it to the checker if it is real)`];
  }
}

/** `texuli <cmd>` references in inline code must name real CLI commands. */
export function checkCliReferences(
  markdown: string,
  ctx: CommandContext
): { line: number; message: string }[] {
  const problems: { line: number; message: string }[] = [];
  const outside = markdown.replace(/^\s*```[^\n]*\n[\s\S]*?^\s*```[^\n]*$/gm, (block) =>
    block.replace(/[^\n]/g, ' ')
  );
  for (const match of outside.matchAll(/`texuli ([a-z][a-z-]*)(?: ([a-z][a-z-]*))?[^`]*`/g)) {
    const command = match[1] as string;
    const sub = match[2] ? `${command} ${match[2]}` : command;
    if (!ctx.cli.has(command) && !ctx.cli.has(sub)) {
      problems.push({
        line: outside.slice(0, match.index ?? 0).split('\n').length,
        message: `\`texuli ${sub}\` is not a Texuli CLI command`,
      });
    }
  }
  return problems;
}

/** The package `exports` keys of a workspace package by name, or `undefined`. */
function exportsOf(repoRoot: string, name: string): string[] | undefined {
  for (const parent of ['packages', 'apps']) {
    const dir = join(repoRoot, parent);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const manifest = join(dir, entry, 'package.json');
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as {
        name?: string;
        exports?: Record<string, unknown>;
      };
      if (pkg.name === name) return Object.keys(pkg.exports ?? { '.': '' });
    }
  }
  return undefined;
}

/** Problems with a TS or Svelte snippet's Texuli imports (relative imports are context and skipped). */
export function checkSnippetImports(code: string, repoRoot: string): string[] {
  const problems: string[] = [];
  for (const match of code.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
    const specifier = match[1] as string;
    if (!/^(?:texuli(?:\/|$)|@texuli\/)/.test(specifier)) continue;
    const parts = specifier.split('/');
    const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] as string);
    const subpath = specifier.slice(name.length);
    const keys = exportsOf(repoRoot, name);
    if (!keys) {
      problems.push(`${specifier}: no workspace package ${name}`);
      continue;
    }
    const wanted = `.${subpath}`;
    const matches = keys.some(
      (key) =>
        key === wanted ||
        (key.includes('*') &&
          new RegExp(`^${key.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('\\*', '.+')}$`).test(
            wanted
          ))
    );
    if (!matches) problems.push(`${specifier}: ${name} does not export "${wanted}"`);
  }
  return problems;
}

/** Commands, CLI references and snippets across every Markdown file of the pack. */
export function validateSkillCommands(skillRoot: string, repoRoot: string): SkillIssue[] {
  const ctx = commandContext(repoRoot);
  const issues: SkillIssue[] = [];
  for (const path of markdownFiles(skillRoot)) {
    const markdown = readFileSync(path, 'utf8');
    const file = relative(skillRoot, path).split(sep).join('/');
    for (const { line, message } of checkCliReferences(markdown, ctx)) {
      issues.push(issue(file, `cli:${line}`, message));
    }
    for (const block of codeBlocks(markdown)) {
      if (['bash', 'sh', 'shell', 'console'].includes(block.lang)) {
        block.code.split('\n').forEach((raw, offset) => {
          const lineText = raw.replace(/\s#.*$/, '').replace(/^\$\s+/, '');
          if (lineText.trim() === '' || lineText.trim().startsWith('#')) return;
          // Pipes and && chains: check each command.
          for (const part of lineText.split(/\s*(?:&&|\|\||\||;)\s*/)) {
            for (const message of checkCommand(part, ctx)) {
              issues.push(issue(file, `command:${block.line + 1 + offset}`, message));
            }
          }
        });
      } else if (block.lang === 'json') {
        try {
          JSON.parse(block.code);
        } catch (error) {
          issues.push(
            issue(file, `snippet:${block.line}`, `JSON does not parse: ${(error as Error).message}`)
          );
        }
      } else if (['ts', 'typescript', 'svelte', 'js'].includes(block.lang)) {
        for (const message of checkSnippetImports(block.code, repoRoot)) {
          issues.push(issue(file, `snippet:${block.line}`, message));
        }
      }
    }
  }
  return issues;
}

export function checkRequiredFiles(skillRoot: string): SkillIssue[] {
  const issues: SkillIssue[] = [];
  for (const rel of REQUIRED_RELATIVE) {
    if (!existsSync(join(skillRoot, rel))) {
      issues.push(issue(rel, 'required', 'missing required skill file'));
    }
  }
  return issues;
}

export function checkSkillPack(
  repoRoot: string,
  options: { writeSums?: boolean } = {}
): SkillIssue[] {
  const skillRoot = join(repoRoot, 'skills', 'texuli');
  if (!existsSync(skillRoot)) {
    return [issue('skills/texuli', 'tree', 'skill directory does not exist')];
  }

  if (options.writeSums) {
    writeSkillChecksums(skillRoot);
  }

  const issues: SkillIssue[] = [];
  issues.push(...checkRequiredFiles(skillRoot));

  for (const path of findSkillMdFiles(skillRoot)) {
    const display = relative(repoRoot, path).split(sep).join('/');
    issues.push(...validateSkillFile(path, display, expectedSkillName(skillRoot, path)));
  }

  issues.push(...validateSkillLinks(skillRoot));
  issues.push(...validateSkillCommands(skillRoot, repoRoot));
  issues.push(...verifySkillChecksums(skillRoot));
  return issues;
}

export function repositoryRootFromHere(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export function main(argv = process.argv.slice(2)): number {
  const writeSums = argv.includes('--write-sums');
  const root = repositoryRootFromHere();
  const issues = checkSkillPack(root, { writeSums });
  if (issues.length > 0) {
    for (const item of issues) {
      console.error(`${item.file}: ${item.field} — ${item.message}`);
    }
    console.error(`check-skill: ${issues.length} issue(s).`);
    return 1;
  }
  console.log(
    writeSums
      ? `check-skill: wrote skills/texuli/SHA256SUMS and validated the pack.`
      : `check-skill: skills/texuli pack is valid.`
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
