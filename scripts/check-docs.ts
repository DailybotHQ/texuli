/**
 * Check every tracked Markdown doc in the repository ("docs are honest"):
 *
 * 1. Relative links resolve: the target file or directory exists, and a
 *    `#fragment` on a Markdown target names one of its headings (GitHub
 *    slugs). A bare `#fragment` checks the doc's own headings.
 * 2. Commands name something real: fenced shell lines and inline code that
 *    start with `pnpm`, `npx`, `texuli`, `tsx` or `bash` go through the skill
 *    checker's `checkCommand` (root scripts, workspace package scripts, local
 *    binaries, repository paths, CLI commands). It checks that each command
 *    exists; running the cheap ones is a separate, manual step.
 *
 * Vendored kits (`.agents/skills/deepworkplan`, `.agents/skills/ai-diff-reviewer`)
 * keep their own link layout and are skipped; `.dwp/` is never tracked.
 * Root-relative links (`/docs/…`) are website routes, not files, and are not
 * checked here. Offline only.
 *
 *   pnpm exec tsx scripts/check-docs.ts
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type CommandContext,
  checkCommand,
  codeBlocks,
  commandContext,
  findMarkdownLinks,
} from './check-skill.ts';

export interface DocIssue {
  file: string;
  line: number;
  message: string;
}

const VENDORED = ['.agents/skills/deepworkplan/', '.agents/skills/ai-diff-reviewer/'];
const CHECKED_HEADS = new Set(['pnpm', 'npx', 'texuli', 'tsx', 'bash']);
/** pnpm's own commands and flags (not scripts). */
const PNPM_BUILTINS = new Set([
  'install',
  'add',
  'remove',
  'audit',
  'outdated',
  'why',
  'list',
  'ls',
  'licenses',
  'pack',
  'store',
  '-r',
  '--recursive',
  '--version',
  '-v',
]);

/** Tracked Markdown files, minus vendored kits. */
export function trackedDocs(repoRoot: string): string[] {
  const listed = execFileSync('git', ['ls-files', '-z', '--', '*.md'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return listed
    .split('\0')
    .filter((path) => path !== '' && !VENDORED.some((prefix) => path.startsWith(prefix)))
    .filter((path) => existsSync(join(repoRoot, path)))
    .sort();
}

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces to hyphens. */
export function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

/** Every anchor a Markdown file offers: heading slugs (with -1, -2 for repeats) and explicit ids. */
export function anchors(markdown: string): Set<string> {
  const found = new Set<string>();
  const seen = new Map<string, number>();
  const text = markdown.replace(/^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[^\n]*$/gm, '');
  for (const match of text.matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm)) {
    const base = slug(match[1] as string);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    found.add(count === 0 ? base : `${base}-${count}`);
  }
  for (const match of text.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) {
    found.add(match[1] as string);
  }
  return found;
}

export function checkLinks(repoRoot: string, file: string, markdown: string): DocIssue[] {
  const issues: DocIssue[] = [];
  const source = join(repoRoot, file);
  for (const { destination, line } of findMarkdownLinks(markdown)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(destination) || destination.startsWith('//')) continue;
    if (destination.startsWith('/')) continue;
    const [pathPart = '', fragment] = destination.split('#', 2) as [string, string | undefined];
    const cleanPath = pathPart.split('?', 1)[0] as string;
    let target = source;
    if (cleanPath !== '') {
      let decoded: string;
      try {
        decoded = decodeURIComponent(cleanPath);
      } catch {
        issues.push({ file, line, message: `${destination}: invalid percent encoding` });
        continue;
      }
      target = resolve(dirname(source), decoded);
      if (!existsSync(target)) {
        issues.push({ file, line, message: `${destination}: target does not exist` });
        continue;
      }
    }
    const self = cleanPath === '';
    if (fragment && (self || (target.endsWith('.md') && statSync(target).isFile()))) {
      const wanted = decodeURIComponent(fragment);
      if (/^L\d+(?:-L\d+)?$/.test(wanted)) continue;
      if (!anchors(self ? markdown : readFileSync(target, 'utf8')).has(wanted)) {
        issues.push({ file, line, message: `${destination}: no heading #${wanted}` });
      }
    }
  }
  return issues;
}

/** A shell glob (`tests/consumer-ids*.test.ts`) stands for its first match, if any. */
function expandGlob(word: string, repoRoot: string): string {
  if (!word.includes('*') || /[<>…{]/.test(word)) return word;
  const directory = join(repoRoot, dirname(word));
  if (!existsSync(directory)) return word;
  const name = word.slice(word.lastIndexOf('/') + 1);
  const pattern = new RegExp(
    `^${name.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
  );
  const match = readdirSync(directory).find((entry) => pattern.test(entry));
  return match ? join(dirname(word), match) : word;
}

function commandProblems(command: string, ctx: CommandContext): string[] {
  // `bash -c '<commands>'`: check the quoted commands.
  const wrapped = /^\s*bash -c (['"])(.*)\1\s*$/.exec(command);
  if (wrapped) return commandProblems(wrapped[2] as string, ctx);
  const problems: string[] = [];
  for (const part of command.split(/\s*(?:&&|\|\||\||;)\s*/)) {
    const words = part.trim().split(/\s+/);
    const head = words.find((word) => !/^[A-Z][A-Z0-9_]*=/.test(word));
    if (!head || !CHECKED_HEADS.has(head)) continue;
    const next = words[words.indexOf(head) + 1] ?? '';
    if (head === 'pnpm' && PNPM_BUILTINS.has(next)) continue;
    // `pnpm --dir <path> …` runs in a directory, which must exist.
    if (head === 'pnpm' && next === '--dir') {
      const dir = words[words.indexOf(head) + 2] ?? '';
      if (!existsSync(join(ctx.repoRoot, dir)))
        problems.push(`pnpm --dir ${dir}: no such directory`);
      continue;
    }
    // `pnpm --filter <package> …` names a placeholder, not a package.
    if (
      head === 'pnpm' &&
      next === '--filter' &&
      /[<>…]/.test(words[words.indexOf(head) + 2] ?? '')
    )
      continue;
    // `pnpm --filter <pkg> exec <bin>` runs a package binary, not a script.
    if (head === 'pnpm' && next === '--filter' && words[words.indexOf(head) + 3] === 'exec') {
      const name = words[words.indexOf(head) + 2] as string;
      if (!ctx.packageScripts.has(name))
        problems.push(`pnpm --filter ${name}: no such workspace package`);
      continue;
    }
    if (head === 'tsx' || head === 'bash') {
      const path = words[words.indexOf(head) + 1];
      if (path && !/[<>…]/.test(path) && !existsSync(join(ctx.repoRoot, path))) {
        problems.push(`${path} does not exist in the repository`);
      }
      continue;
    }
    problems.push(
      ...checkCommand(words.map((word) => expandGlob(word, ctx.repoRoot)).join(' '), ctx)
    );
  }
  return problems;
}

export function checkCommands(file: string, markdown: string, ctx: CommandContext): DocIssue[] {
  const issues: DocIssue[] = [];
  for (const block of codeBlocks(markdown)) {
    if (!['bash', 'sh', 'shell', 'console'].includes(block.lang)) continue;
    block.code.split('\n').forEach((raw, offset) => {
      const text = raw.replace(/\s#.*$/, '').replace(/^\s*\$\s+/, '');
      if (text.trim() === '' || text.trim().startsWith('#')) return;
      for (const message of commandProblems(text, ctx)) {
        issues.push({ file, line: block.line + 1 + offset, message });
      }
    });
  }
  const outside = markdown.replace(/^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[^\n]*$/gm, (fence) =>
    fence.replace(/[^\n]/g, ' ')
  );
  for (const match of outside.matchAll(/`((?:[A-Z][A-Z0-9_]*=\S+\s+)*(?:pnpm|npx) [^`\n]+)`/g)) {
    const line = outside.slice(0, match.index ?? 0).split('\n').length;
    for (const message of commandProblems(match[1] as string, ctx)) {
      issues.push({ file, line, message });
    }
  }
  return issues;
}

export function checkDocs(repoRoot: string, files = trackedDocs(repoRoot)): DocIssue[] {
  const ctx = commandContext(repoRoot);
  const issues: DocIssue[] = [];
  for (const file of files) {
    const markdown = readFileSync(join(repoRoot, file), 'utf8');
    issues.push(...checkLinks(repoRoot, file, markdown), ...checkCommands(file, markdown, ctx));
  }
  return issues;
}

export function main(): number {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const files = trackedDocs(root);
  const issues = checkDocs(root, files);
  for (const item of issues) console.error(`${item.file}:${item.line} — ${item.message}`);
  if (issues.length > 0) {
    console.error(`check-docs: ${issues.length} issue(s) in ${files.length} docs.`);
    return 1;
  }
  console.log(`check-docs: ${files.length} docs, every relative link and command is real.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
