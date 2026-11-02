/**
 * Facts guard (PLAN_014 T-guards): typed counts in the site source and the
 * docs must agree with the repository. Each fact is derived from its source
 * when the check runs, never typed here:
 *
 * - primitives: the subpaths `@texuli/primitives` exports (one per primitive);
 * - themes: the full library (`BUILTIN + PORT + EXPAND` theme ids) or the
 *   core `@texuli/tokens/library` subpath (`PORT`); "200+" style lower
 *   bounds pass while they stay at or below the full count;
 * - published and packable packages: every workspace package but the
 *   never-packed `@texuli/examples`;
 * - the release in "every one at `x.y.z`": the version of `texuli`.
 *
 * History is exempt: release notes, decisions, dated quality reports and
 * changelogs quote the numbers of their day. A file can also opt one line
 * out with a `facts: historical` marker on that line.
 *
 * Usage: pnpm exec tsx scripts/check-facts.ts [--json]
 * Tests: pnpm vitest run scripts/tests/check-facts.test.ts
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..');

export interface Facts {
  primitives: number;
  themesFull: number;
  themesCore: number;
  publishedPackages: number;
  release: string;
}

export interface FactIssue {
  file: string;
  line: number;
  claim: string;
  expected: string;
}

/** The paths scanned, as `git ls-files` pathspecs. */
export const SCANNED = [
  'AGENTS.md',
  'README.md',
  'CONTRIBUTING.md',
  'docs',
  'apps/website/src',
  'apps/website/docs',
  'native/README.md',
  'native/docs',
  'skills/texuli',
  'packages/*/README.md',
  'packages/*/docs',
];

/** Files whose numbers are history by design. */
export const HISTORICAL: readonly RegExp[] = [
  /^docs\/RELEASE\.md$/,
  /^docs\/DECISIONS\.md$/,
  /^docs\/quality\//,
  /CHANGELOG\.md$/,
  /^apps\/website\/src\/pages\/changelog\//,
  /^apps\/website\/docs\/illustration-prompts\.md$/,
  /\/generated\//,
];

const TEXT = /\.(md|ts|astro|svelte|json)$/;
const LINE_OPT_OUT = 'facts: historical';

/** Derives every fact from the repository at `root`. */
export async function deriveFacts(root = ROOT): Promise<Facts> {
  const manifests = readdirSync(join(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(
      (entry) =>
        JSON.parse(readFileSync(join(root, 'packages', entry.name, 'package.json'), 'utf8')) as {
          name: string;
          version: string;
          exports?: Record<string, unknown>;
        }
    );
  const byName = new Map(manifests.map((manifest) => [manifest.name, manifest]));
  const primitives = Object.keys(byName.get('@texuli/primitives')?.exports ?? {}).filter(
    (key) => key !== '.' && !key.endsWith('package.json')
  ).length;
  const ids = (await import(
    pathToFileURL(join(root, 'packages/tokens/src/library-ids/ids.ts')).href
  )) as Record<'BUILTIN_THEME_IDS' | 'PORT_THEME_IDS' | 'EXPAND_THEME_IDS', readonly string[]>;
  return {
    primitives,
    themesFull:
      ids.BUILTIN_THEME_IDS.length + ids.PORT_THEME_IDS.length + ids.EXPAND_THEME_IDS.length,
    themesCore: ids.PORT_THEME_IDS.length,
    publishedPackages: manifests.filter((manifest) => manifest.name !== '@texuli/examples').length,
    release: byName.get('texuli')?.version ?? '',
  };
}

/** Checks one file's text against the facts; `file` is only for the report. */
export function checkText(file: string, text: string, facts: Facts): FactIssue[] {
  const issues: FactIssue[] = [];
  text.split('\n').forEach((content, index) => {
    if (content.includes(LINE_OPT_OUT)) return;
    const report = (claim: string, expected: string) =>
      issues.push({ file, line: index + 1, claim, expected });
    // "42 owned headless primitives" (but not "Svelte 5 primitives").
    for (const match of content.matchAll(
      /(?<!Svelte |[\w.])(\d{1,3}) (?:owned )?(?:headless )?primitives\b/g
    )) {
      if (Number(match[1]) !== facts.primitives) report(match[0], `${facts.primitives} primitives`);
    }
    for (const match of content.matchAll(/(?<![\w.])(\d{1,3})(\+?) themes\b/g)) {
      const value = Number(match[1]);
      const ok = match[2]
        ? value <= facts.themesFull
        : value === facts.themesFull || value === facts.themesCore;
      if (!ok)
        report(match[0], `${facts.themesFull} themes (${facts.themesCore} in the core library)`);
    }
    for (const match of content.matchAll(
      /(?<![\w.])(\d{1,3}) (?:published|packable) packages\b/g
    )) {
      if (Number(match[1]) !== facts.publishedPackages)
        report(match[0], `${facts.publishedPackages} published packages`);
    }
    for (const match of content.matchAll(/every one at `(\d+\.\d+\.\d+)`/g)) {
      if (match[1] !== facts.release) report(match[0], `every one at \`${facts.release}\``);
    }
  });
  return issues;
}

/** Every scanned, tracked text file outside the historical set. */
export function scannedFiles(root = ROOT): string[] {
  const listed = execFileSync('git', ['ls-files', '--', ...SCANNED], {
    cwd: root,
    encoding: 'utf8',
  });
  return listed
    .split('\n')
    .filter((file) => TEXT.test(file) && !HISTORICAL.some((pattern) => pattern.test(file)));
}

export async function checkFacts(root = ROOT): Promise<{ facts: Facts; issues: FactIssue[] }> {
  const facts = await deriveFacts(root);
  const issues = scannedFiles(root).flatMap((file) =>
    checkText(file, readFileSync(join(root, file), 'utf8'), facts)
  );
  return { facts, issues };
}

async function main(): Promise<void> {
  const { facts, issues } = await checkFacts();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ facts, issues }, null, 2)}\n`);
  } else {
    for (const issue of issues)
      console.error(`${issue.file}:${issue.line} — "${issue.claim}"; expected ${issue.expected}`);
    console.log(
      issues.length === 0
        ? `check-facts: every typed count matches the repository (${facts.primitives} primitives, ${facts.themesFull} themes, ${facts.publishedPackages} packages, ${facts.release}).`
        : `check-facts: ${issues.length} issue(s).`
    );
  }
  if (issues.length > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
