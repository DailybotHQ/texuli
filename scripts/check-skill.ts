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
 * 6. Every SKILL.md carries the router's version, the name and description
 *    stay within the Agent Skills limits, every SKILL.md and entry bundle
 *    stays within its byte budget, and CHANGELOG.md is Keep-a-Changelog
 * 7. The dogfood mirror `.agents/skills/texuli/` is byte-identical to the
 *    pack (`--refresh-mirror` copies it and updates skills-lock.json)
 *
 * The release helpers below (`--release-plan`, `--release`) are what
 * `.github/workflows/skill-release.yml` runs; see docs/RELEASE.md.
 *
 * Offline only — no network.
 *
 *   pnpm exec tsx scripts/check-skill.ts
 *   pnpm exec tsx scripts/check-skill.ts --write-sums
 *   pnpm exec tsx scripts/check-skill.ts --refresh-mirror
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SKILL_NAME = /^texuli(?:-[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const DOCUMENTATION_URL = 'https://texuli.com/guides/';
const ALLOWED_TOOLS = new Set(['Bash', 'Read', 'Grep', 'Glob', 'Edit', 'Write']);
/** Agent Skills specification limits. */
export const NAME_MAX = 64;
export const DESCRIPTION_MAX = 1024;
/**
 * Byte budgets, measured 2026-10-27 at 0.2.0: the largest SKILL.md is
 * media/SKILL.md at 10,711 bytes, the largest entry bundle is evals at
 * 42,278 bytes (router bundle 38,423). The budgets leave room for the
 * planned coverage of drag, workflows and date without letting a single
 * entry grow past what an agent should load at once.
 */
export const SKILL_MD_BUDGET = 16 * 1024;
export const BUNDLE_BUDGET = 64 * 1024;
/** Files of the pack that are not loaded by an agent and not budgeted. */
const UNBUDGETED = new Set(['SHA256SUMS', 'CHANGELOG.md']);
/** The skills CLI and the tag namespace of skill releases. */
export const SKILL_REPO = 'DailybotHQ/texuli';
export const SKILL_TAG_PREFIX = 'skill-v';

const REQUIRED_RELATIVE = [
  'SKILL.md',
  'TRUST.md',
  'CHANGELOG.md',
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
  // A flow mapping or sequence on one line is JSON (the OpenClaw `metadata`
  // convention); anything that does not parse stays a string and fails the
  // field's own check.
  if (/^[{[]/.test(trimmed)) {
    try {
      return JSON.parse(trimmed) as FrontmatterValue;
    } catch {
      return trimmed;
    }
  }
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
  } else if (name.length > NAME_MAX) {
    issues.push(issue(file, 'name', `must be at most ${NAME_MAX} characters (got ${name.length})`));
  } else if (expectedName !== undefined && name !== expectedName) {
    issues.push(
      issue(file, 'name', `must be '${expectedName}' to match its folder (got '${name}')`)
    );
  }

  const description = values.description;
  if (typeof description !== 'string' || !description.trim()) {
    issues.push(issue(file, 'description', 'is required and must be non-empty text'));
  } else if (description.length > DESCRIPTION_MAX) {
    issues.push(
      issue(
        file,
        'description',
        `must be at most ${DESCRIPTION_MAX} characters (got ${description.length})`
      )
    );
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
  const rawMetadata = parsed.raw.match(/^metadata:(.*)$/m)?.[1]?.trim() ?? '';
  if (metadata && !/^\{.*\}$/.test(rawMetadata)) {
    // OpenClaw reads `metadata` as one line of JSON; a nested YAML block is
    // not portable across hosts.
    issues.push(issue(file, 'metadata', 'must be single-line JSON (metadata: {"openclaw":{…}})'));
  }
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
  // Binaries the workspace packages publish (`bin`): what a consumer's
  // `npx <bin>` runs after installing that package, so they are real.
  const publishedBins = new Set<string>();
  for (const parent of ['packages', 'apps']) {
    const dir = join(repoRoot, parent);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const manifest = join(dir, entry, 'package.json');
      if (!existsSync(manifest)) continue;
      const pkg = readJson(manifest);
      packageScripts.set(String(pkg.name), new Set(Object.keys((pkg.scripts as object) ?? {})));
      if (pkg.bin && typeof pkg.bin === 'object') {
        for (const bin of Object.keys(pkg.bin)) publishedBins.add(bin);
      }
    }
  }
  const binDir = join(repoRoot, 'node_modules', '.bin');
  const setup = join(repoRoot, 'skills', 'texuli', 'setup.sh');
  return {
    repoRoot,
    rootScripts: new Set(Object.keys((rootPackage.scripts as object) ?? {})),
    packageScripts,
    bins: new Set([...(existsSync(binDir) ? readdirSync(binDir) : []), ...publishedBins]),
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

/** `https://github.com/DailybotHQ/texuli` as a regular expression source. */
const REPO_URL = String.raw`https://github\.com/DailybotHQ/texuli`;
const VERSION_OR_PLACEHOLDER = String.raw`(?:\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?|<[a-z-]+>)`;
const PINNED_TAG = `${SKILL_TAG_PREFIX}${VERSION_OR_PLACEHOLDER}`;
const SKILLS_FLAGS = String.raw`(?: (?:-g|--global|-y|--yes|--copy|-a [\w-]+))*`;
/**
 * The only network commands the skill may document: reads of the Texuli
 * repository's skill tags and downloads pinned to one `skill-vX.Y.Z` tag.
 * A moving ref (`main`, `latest`), the `owner/repo@ref` shorthand (the
 * skills CLI ignores its ref) and any other host never match.
 */
const PINNED_NETWORK: RegExp[] = [
  new RegExp(String.raw`^git ls-remote --tags(?: --refs)? ${REPO_URL}\.git(?: '?skill-v\*'?)?$`),
  new RegExp(
    String.raw`^git clone --branch ${PINNED_TAG} --depth 1 ${REPO_URL}\.git(?: [\w./-]+)?$`
  ),
  new RegExp(
    String.raw`^curl -fsSLO ${REPO_URL}/releases/download/${PINNED_TAG}/(?:texuli-skill-${VERSION_OR_PLACEHOLDER}\.tar\.gz|SHA256SUMS)$`
  ),
  new RegExp(
    `^npx (?:--yes )?skills add ${REPO_URL}/tree/${PINNED_TAG}/skills/texuli(?: --skill texuli)?${SKILLS_FLAGS}$`
  ),
  new RegExp(`^npx (?:--yes )?skills remove texuli${SKILLS_FLAGS}$`),
];

/** True for a network command pinned to the Texuli repository and one skill tag. */
export function isPinnedNetworkCommand(line: string): boolean {
  const normalized = line.trim().split(/\s+/).join(' ');
  return PINNED_NETWORK.some((pattern) => pattern.test(normalized));
}

/**
 * Pack files that may document a pinned network command: the consented
 * upgrade and the pinned install. Everywhere else the pack stays offline.
 */
export const CONSENTED_NETWORK_FILES = new Set(['upgrade/SKILL.md', 'setup/pinned-install.md']);

/** Problems with one shell command line (empty when it is real and offline). */
export function checkCommand(line: string, ctx: CommandContext): string[] {
  // Real, but networked: the pack-level check limits where they may appear.
  if (isPinnedNetworkCommand(line)) return [];
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
    case 'grep':
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
            const field = `command:${block.line + 1 + offset}`;
            if (isPinnedNetworkCommand(part) && !CONSENTED_NETWORK_FILES.has(file)) {
              issues.push(
                issue(
                  file,
                  field,
                  'needs the network; only upgrade/SKILL.md and setup/pinned-install.md may document a pinned, consented download'
                )
              );
              continue;
            }
            for (const message of checkCommand(part, ctx)) {
              issues.push(issue(file, field, message));
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

// ─── Version, budgets and changelog ────────────────────────────────────────
// The router's `version:` is the only version of the pack; the release
// workflow writes it into every SKILL.md, so a sub-skill that disagrees is
// a hand edit. Budgets keep each entry small enough to load at once.

/** Every SKILL.md of the pack, pack-relative with `/` separators. */
export function skillMdPaths(skillRoot: string): string[] {
  return findSkillMdFiles(skillRoot).map((path) => relative(skillRoot, path).split(sep).join('/'));
}

/** The quoted `version:` of a SKILL.md, or `''`. */
export function skillVersion(markdown: string): string {
  return /^version:\s*"([^"]*)"\s*$/m.exec(markdown)?.[1] ?? '';
}

export function checkVersionSync(skillRoot: string): SkillIssue[] {
  const router = skillVersion(readFileSync(join(skillRoot, 'SKILL.md'), 'utf8'));
  return skillMdPaths(skillRoot)
    .filter((rel) => skillVersion(readFileSync(join(skillRoot, rel), 'utf8')) !== router)
    .map((rel) =>
      issue(rel, 'version', `must equal the router version "${router}" (the release syncs it)`)
    );
}

export interface SkillBundle {
  /** The entry's SKILL.md, pack-relative. */
  entry: string;
  files: string[];
  bytes: number;
}

/**
 * What an agent may load for each entry: its SKILL.md and every file under
 * its folder that no deeper SKILL.md owns. The router's bundle is the
 * pack root plus the folders without a SKILL.md (`router/`, `setup/`).
 * SHA256SUMS and CHANGELOG.md are never loaded for routing.
 */
export function skillBundles(skillRoot: string): SkillBundle[] {
  const entries = skillMdPaths(skillRoot).map((rel) => (rel === 'SKILL.md' ? '' : dirname(rel)));
  const owner = (rel: string) =>
    entries
      .filter((folder) => folder === '' || rel.startsWith(`${folder}/`))
      .sort((a, b) => b.length - a.length)[0] ?? '';
  const bundles = new Map<string, SkillBundle>(
    entries.map((folder) => [
      folder,
      { entry: folder ? `${folder}/SKILL.md` : 'SKILL.md', files: [], bytes: 0 },
    ])
  );
  for (const rel of [...listPackFiles(skillRoot)]) {
    if (UNBUDGETED.has(rel)) continue;
    const bundle = bundles.get(owner(rel));
    if (!bundle) continue;
    bundle.files.push(rel);
    bundle.bytes += statSync(join(skillRoot, rel)).size;
  }
  return [...bundles.values()];
}

export function checkBudgets(skillRoot: string): SkillIssue[] {
  const issues: SkillIssue[] = [];
  for (const rel of skillMdPaths(skillRoot)) {
    const bytes = statSync(join(skillRoot, rel)).size;
    if (bytes > SKILL_MD_BUDGET) {
      issues.push(
        issue(rel, 'budget', `is ${bytes} bytes; the SKILL.md budget is ${SKILL_MD_BUDGET}`)
      );
    }
  }
  for (const bundle of skillBundles(skillRoot)) {
    if (bundle.bytes > BUNDLE_BUDGET) {
      issues.push(
        issue(
          bundle.entry,
          'bundle',
          `loads ${bundle.bytes} bytes with its references; the bundle budget is ${BUNDLE_BUDGET}`
        )
      );
    }
  }
  return issues;
}

/** Released versions in a Keep-a-Changelog file, newest first. */
export function changelogVersions(changelog: string): string[] {
  return [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]/gm)].map(
    (match) => match[1] as string
  );
}

/** -1, 0 or 1, comparing two SemVer versions by precedence. */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string) => {
    const [core = '', pre] = version.split('+', 1)[0]?.split(/-(.*)/s) ?? [];
    return { core: core.split('.').map(Number), pre: pre ?? '' };
  };
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left.core[index] ?? 0) - (right.core[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  if (left.pre === right.pre) return 0;
  if (!left.pre) return 1;
  if (!right.pre) return -1;
  const l = left.pre.split('.');
  const r = right.pre.split('.');
  for (let index = 0; index < Math.max(l.length, r.length); index += 1) {
    const x = l[index];
    const y = r[index];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const numeric = /^\d+$/.test(x) && /^\d+$/.test(y);
    if (numeric) return Math.sign(Number(x) - Number(y));
    return x < y ? -1 : 1;
  }
  return 0;
}

export function checkChangelog(skillRoot: string): SkillIssue[] {
  const path = join(skillRoot, 'CHANGELOG.md');
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  const issues: SkillIssue[] = [];
  if (!/^# Changelog$/m.test(text)) {
    issues.push(issue('CHANGELOG.md', 'format', 'must start with a "# Changelog" heading'));
  }
  if (!/^## \[Unreleased\]$/m.test(text)) {
    issues.push(issue('CHANGELOG.md', 'unreleased', 'must keep a "## [Unreleased]" block'));
  }
  const versions = changelogVersions(text);
  const router = skillVersion(readFileSync(join(skillRoot, 'SKILL.md'), 'utf8'));
  const newest = versions[0];
  if (newest && compareVersions(router, newest) < 0) {
    issues.push(
      issue('CHANGELOG.md', 'version', `newest release ${newest} is ahead of the router ${router}`)
    );
  }
  for (let index = 1; index < versions.length; index += 1) {
    if (compareVersions(versions[index - 1] as string, versions[index] as string) <= 0) {
      issues.push(issue('CHANGELOG.md', 'order', 'version sections must be newest first'));
      break;
    }
  }
  return issues;
}

// ─── Release (skill-release.yml) ───────────────────────────────────────────
// Conventional commits that touch skills/texuli/ since the last stable
// `skill-vX.Y.Z` tag decide the bump. Before 1.0.0 a breaking change bumps
// the minor, like the packages (docs/RELEASE.md "0.x versioning").

export type Bump = 'major' | 'minor' | 'patch';

export interface ReleaseCommit {
  subject: string;
  body: string;
}

export function bumpLevel(commits: readonly ReleaseCommit[]): Bump {
  const breaking = commits.some(
    (commit) =>
      /^[a-z]+(?:\([^)]*\))?!:/.test(commit.subject) || /^BREAKING[ -]CHANGE:/m.test(commit.body)
  );
  if (breaking) return 'major';
  if (commits.some((commit) => /^feat(?:\([^)]*\))?:/.test(commit.subject))) return 'minor';
  return 'patch';
}

export function nextVersion(current: string, bump: Bump): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) throw new Error(`cannot bump a non-stable version: ${current}`);
  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number];
  // 0.x: a breaking change is a minor, like the npm packages.
  const level = major === 0 && bump === 'major' ? 'minor' : bump;
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** The highest stable `skill-vX.Y.Z` tag of a repository, or `''`. */
export function lastSkillTag(tags: readonly string[]): string {
  return (
    tags
      .filter((tag) => /^skill-v\d+\.\d+\.\d+$/.test(tag))
      .sort((a, b) =>
        compareVersions(b.slice(SKILL_TAG_PREFIX.length), a.slice(SKILL_TAG_PREFIX.length))
      )[0] ?? ''
  );
}

const git = (repoRoot: string, args: string[]) =>
  execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** Commits since `tag` (or the whole history) that touch the pack, minus release commits. */
export function releaseCommits(repoRoot: string, tag: string): ReleaseCommit[] {
  const range = tag ? [`${tag}..HEAD`] : ['HEAD'];
  const log = git(repoRoot, [
    'log',
    '--no-merges',
    '--format=%s%x1f%b%x1e',
    ...range,
    '--',
    'skills/texuli',
  ]);
  return log
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [subject = '', body = ''] = record.split('\x1f');
      return { subject: subject.trim(), body: body.trim() };
    })
    .filter((commit) => !commit.subject.startsWith('chore(release):'));
}

export interface ReleasePlan {
  skip: boolean;
  reason: string;
  current: string;
  lastTag: string;
  bump: Bump | 'none';
  version: string;
  tag: string;
  commits: ReleaseCommit[];
}

/**
 * What the next skill release is. The router version is the source of
 * truth: equal to the last tag, it is bumped from the commits; ahead of it
 * (the first release, or a deliberate 1.0.0), it is released as written.
 */
export function releasePlan(repoRoot: string): ReleasePlan {
  const skillRoot = join(repoRoot, 'skills', 'texuli');
  const current = skillVersion(readFileSync(join(skillRoot, 'SKILL.md'), 'utf8'));
  const lastTag = lastSkillTag(
    git(repoRoot, ['tag', '--list', `${SKILL_TAG_PREFIX}*`]).split('\n')
  );
  const commits = releaseCommits(repoRoot, lastTag);
  const base = { current, lastTag, commits };
  if (!SEMVER.test(current) || current.includes('+')) {
    throw new Error(`router version is not a releasable SemVer: "${current}"`);
  }
  if (commits.length === 0) {
    return {
      ...base,
      skip: true,
      reason: `no commits touch skills/texuli since ${lastTag || 'the first commit'}`,
      bump: 'none',
      version: current,
      tag: `${SKILL_TAG_PREFIX}${current}`,
    };
  }
  const released = lastTag.slice(SKILL_TAG_PREFIX.length);
  const order = released ? compareVersions(current, released) : 1;
  if (order < 0) throw new Error(`router version ${current} is behind ${lastTag}`);
  const bump: Bump | 'none' = order > 0 ? 'none' : bumpLevel(commits);
  const version = bump === 'none' ? current : nextVersion(current, bump);
  return {
    ...base,
    skip: false,
    reason: bump === 'none' ? 'router version is ahead of the last tag' : `${bump} bump`,
    bump,
    version,
    tag: `${SKILL_TAG_PREFIX}${version}`,
  };
}

/** Write `version` into every SKILL.md of the pack. Returns the files changed. */
export function setPackVersion(skillRoot: string, version: string): string[] {
  if (!SEMVER.test(version)) throw new Error(`not a SemVer version: ${version}`);
  const changed: string[] = [];
  for (const rel of skillMdPaths(skillRoot)) {
    const path = join(skillRoot, rel);
    const text = readFileSync(path, 'utf8');
    const next = text.replace(/^version:\s*"[^"]*"\s*$/m, `version: "${version}"`);
    if (next !== text) {
      writeFileSync(path, next, 'utf8');
      changed.push(rel);
    }
  }
  return changed;
}

/**
 * Stamp a release into a Keep-a-Changelog file: the commits become the
 * `### Changes` list, the hand-written `## [Unreleased]` body is folded in
 * under them, and an empty `## [Unreleased]` stays on top. Returns the new
 * file and the release section (the GitHub Release notes).
 */
export function stampChangelog(
  changelog: string,
  version: string,
  date: string,
  commits: readonly ReleaseCommit[]
): { changelog: string; notes: string } {
  if (changelogVersions(changelog).includes(version)) {
    throw new Error(`CHANGELOG.md already has a ${version} section`);
  }
  const lines = changelog.split('\n');
  const start = lines.indexOf('## [Unreleased]');
  if (start < 0) throw new Error('CHANGELOG.md has no "## [Unreleased]" block');
  let end = lines.findIndex((line, index) => index > start && /^## \[/.test(line));
  if (end < 0) end = lines.length;
  const unreleased = lines.slice(start + 1, end);
  while (unreleased.length > 0 && unreleased[0]?.trim() === '') unreleased.shift();
  while (unreleased.length > 0 && unreleased.at(-1)?.trim() === '') unreleased.pop();
  const section = [
    `## [${version}] — ${date}`,
    '',
    '### Changes',
    '',
    ...commits.map((commit) => `- ${commit.subject}`),
    ...(unreleased.length > 0 ? ['', ...unreleased] : []),
    '',
  ];
  const rest = lines.slice(end);
  const next = [...lines.slice(0, start), '## [Unreleased]', '', ...section, ...rest].join('\n');
  return {
    changelog: next.endsWith('\n') ? next : `${next}\n`,
    notes: `${section.join('\n').trimEnd()}\n`,
  };
}

/**
 * Apply a release plan to the working tree: sync the version, stamp the
 * changelog, regenerate SHA256SUMS and refresh the dogfood mirror. The
 * workflow commits, tags and archives the result.
 */
export function applyRelease(
  repoRoot: string,
  plan: Pick<ReleasePlan, 'version' | 'commits'>,
  date: string
): { notes: string } {
  const skillRoot = join(repoRoot, 'skills', 'texuli');
  setPackVersion(skillRoot, plan.version);
  const path = join(skillRoot, 'CHANGELOG.md');
  const stamped = stampChangelog(readFileSync(path, 'utf8'), plan.version, date, plan.commits);
  writeFileSync(path, stamped.changelog, 'utf8');
  writeSkillChecksums(skillRoot);
  if (existsSync(mirrorPath(repoRoot))) refreshMirror(repoRoot);
  return { notes: stamped.notes };
}

// ─── Dogfood mirror ────────────────────────────────────────────────────────
// `.agents/skills/texuli/` is the copy this repository's own agents load. It
// is byte-identical to the pack; `--refresh-mirror` copies it and records
// its content hash in skills-lock.json the way the skills CLI does.

export function mirrorPath(repoRoot: string): string {
  return join(repoRoot, '.agents', 'skills', 'texuli');
}

/** Every regular file under `dir`, relative with `/`, sorted by code point. */
function allFiles(dir: string): string[] {
  const found: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        visit(path);
      } else if (entry.isFile()) found.push(relative(dir, path).split(sep).join('/'));
    }
  };
  if (existsSync(dir)) visit(dir);
  return found.sort();
}

/**
 * The skills CLI's `computedHash` of an installed skill folder: SHA-256 over
 * each file's relative path then its bytes, in `localeCompare` order,
 * skipping `.git` and `node_modules` (skills 1.5.x `computeSkillFolderHash`).
 */
export function skillFolderHash(dir: string): string {
  const hash = createHash('sha256');
  for (const rel of allFiles(dir).sort((a, b) => a.localeCompare(b))) {
    hash.update(rel);
    hash.update(readFileSync(join(dir, rel)));
  }
  return hash.digest('hex');
}

/** Files that differ between the pack and the mirror (missing, extra or changed). */
export function mirrorDifferences(repoRoot: string): string[] {
  const pack = join(repoRoot, 'skills', 'texuli');
  const mirror = mirrorPath(repoRoot);
  const packFiles = allFiles(pack).filter((rel) => !rel.endsWith('.DS_Store'));
  const mirrorFiles = allFiles(mirror).filter((rel) => !rel.endsWith('.DS_Store'));
  const differences = new Set<string>();
  for (const rel of new Set([...packFiles, ...mirrorFiles])) {
    const a = join(pack, rel);
    const b = join(mirror, rel);
    if (!existsSync(a) || !existsSync(b)) differences.add(rel);
    else if (!readFileSync(a).equals(readFileSync(b))) differences.add(rel);
    else if ((statSync(a).mode & 0o111) !== (statSync(b).mode & 0o111)) differences.add(rel);
  }
  return [...differences].sort();
}

export function checkMirror(repoRoot: string): SkillIssue[] {
  if (!existsSync(mirrorPath(repoRoot))) return [];
  const issues = mirrorDifferences(repoRoot).map((rel) =>
    issue(
      `.agents/skills/texuli/${rel}`,
      'mirror',
      'differs from skills/texuli; run pnpm exec tsx scripts/check-skill.ts --refresh-mirror'
    )
  );
  const lockPath = join(repoRoot, 'skills-lock.json');
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
      skills?: Record<string, { computedHash?: string }>;
    };
    const recorded = lock.skills?.texuli?.computedHash;
    if (recorded !== skillFolderHash(mirrorPath(repoRoot))) {
      issues.push(
        issue(
          'skills-lock.json',
          'texuli',
          'computedHash does not match .agents/skills/texuli; run --refresh-mirror'
        )
      );
    }
  }
  return issues;
}

/**
 * Copy the pack into the mirror (replacing it), prove every byte matches,
 * and record the mirror's hash in skills-lock.json. Before writing the
 * hash, the algorithm must reproduce an entry the real skills CLI wrote.
 */
export function refreshMirror(repoRoot: string, control = 'ai-diff-reviewer'): string {
  const pack = join(repoRoot, 'skills', 'texuli');
  const mirror = mirrorPath(repoRoot);
  rmSync(mirror, { recursive: true, force: true });
  for (const rel of allFiles(pack)) {
    if (rel.endsWith('.DS_Store')) continue;
    const target = join(mirror, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(pack, rel)));
    chmodSync(target, statSync(join(pack, rel)).mode & 0o777);
  }
  const differences = mirrorDifferences(repoRoot);
  if (differences.length > 0) {
    throw new Error(`mirror copy differs from the pack: ${differences.join(', ')}`);
  }
  const lockPath = join(repoRoot, 'skills-lock.json');
  const hash = skillFolderHash(mirror);
  if (!existsSync(lockPath)) return hash;
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
    version: number;
    skills: Record<string, Record<string, string>>;
  };
  const controlEntry = lock.skills[control];
  const controlDir = join(repoRoot, '.agents', 'skills', control);
  if (controlEntry && existsSync(controlDir)) {
    const computed = skillFolderHash(controlDir);
    if (computed !== controlEntry.computedHash) {
      throw new Error(
        `skills-lock.json: the hash algorithm does not reproduce the '${control}' entry; not writing`
      );
    }
  }
  lock.skills = Object.fromEntries(
    Object.entries({
      ...lock.skills,
      texuli: {
        source: SKILL_REPO,
        sourceType: 'github',
        skillPath: 'skills/texuli/SKILL.md',
        computedHash: hash,
      },
    }).sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return hash;
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

  issues.push(...checkVersionSync(skillRoot));
  issues.push(...checkBudgets(skillRoot));
  issues.push(...checkChangelog(skillRoot));
  issues.push(...validateSkillLinks(skillRoot));
  issues.push(...validateSkillCommands(skillRoot, repoRoot));
  issues.push(...verifySkillChecksums(skillRoot));
  issues.push(...checkMirror(repoRoot));
  return issues;
}

export function repositoryRootFromHere(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

/** The value after a flag (`--date 2026-10-27`), or `undefined`. */
function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function main(argv = process.argv.slice(2)): number {
  const writeSums = argv.includes('--write-sums');
  const root = repositoryRootFromHere();
  if (argv.includes('--refresh-mirror')) {
    const hash = refreshMirror(root);
    console.log(`check-skill: .agents/skills/texuli mirrors skills/texuli (computedHash ${hash}).`);
    return 0;
  }
  if (argv.includes('--release-plan')) {
    // key=value lines for $GITHUB_OUTPUT; every value is validated text.
    const plan = releasePlan(root);
    console.log(`skip=${plan.skip}`);
    console.log(`current=${plan.current}`);
    console.log(`last_tag=${plan.lastTag}`);
    console.log(`bump=${plan.bump}`);
    console.log(`version=${plan.version}`);
    console.log(`tag=${plan.tag}`);
    console.error(`check-skill: ${plan.reason}; ${plan.commits.length} commit(s).`);
    return 0;
  }
  if (argv.includes('--release')) {
    const plan = releasePlan(root);
    const expected = flagValue(argv, '--release');
    if (plan.skip || plan.version !== expected) {
      console.error(
        `check-skill: the release plan is ${plan.version} (${plan.reason}), not ${expected}.`
      );
      return 1;
    }
    const date = flagValue(argv, '--date') ?? new Date().toISOString().slice(0, 10);
    const { notes } = applyRelease(root, plan, date);
    const notesPath = flagValue(argv, '--notes');
    if (notesPath) writeFileSync(notesPath, notes, 'utf8');
    const issues = checkSkillPack(root);
    for (const item of issues) console.error(`${item.file}: ${item.field} — ${item.message}`);
    if (issues.length > 0) return 1;
    console.log(`check-skill: stamped ${plan.tag} and validated the pack.`);
    return 0;
  }
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
