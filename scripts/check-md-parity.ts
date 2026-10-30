/**
 * Markdown twin parity for the built texuli.com (PLAN_011 T-ar-twins): every
 * HTML page in `apps/website/dist` has a Markdown twin beside it, except the
 * routes in the explicit allowlist (`TWIN_EXEMPTIONS` in
 * `apps/website/src/components/docs/twins.ts`) and redirect stubs. For each
 * twin it checks:
 *
 * - the file exists at the page URL plus `.md` (`/` → `/index.md`);
 * - its header block parses (`# Title`, `Language:`, `Canonical:`,
 *   `Markdown:` with the `Accept: text/markdown` hint, `Last Updated:` as
 *   `YYYY-MM-DD`, the `---` rule, content after it);
 * - `Canonical:` is the page URL and the `Markdown:` line names the twin;
 * - the page head links it (`<link rel="alternate" type="text/markdown">`);
 * - `md-manifest.json` maps the page to it.
 *
 * Usage (after `pnpm build`):
 *   pnpm exec tsx scripts/check-md-parity.ts            # report, exit 0
 *   pnpm exec tsx scripts/check-md-parity.ts --strict   # exit 1 on any problem
 *   … --dist <dir> --origin <https://host>
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  isRedirectStub,
  parseTwinHeader,
  twinExemption,
  twinPathFor,
} from '../apps/website/src/components/docs/twins.ts';

/** One HTML page of a build: its route and its HTML. */
export interface BuiltPage {
  route: string;
  html: string;
}

/** What the check found. */
export interface MdParityReport {
  /** HTML pages scanned. */
  pages: number;
  /** Pages whose twin passed every check. */
  twins: number;
  /** Pages skipped by the allowlist or as redirect stubs, with the reason. */
  exempt: { route: string; reason: string }[];
  /** One line per failed check. */
  problems: string[];
}

/** The public route of a built HTML file (`guides/theming/index.html` → `/guides/theming/`). */
export function routeOf(dist: string, file: string): string {
  const path = relative(dist, file).split(sep).join('/');
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'index.html'.length)}`;
  return `/${path}`;
}

/** Whether the page head links `twin` as its Markdown alternate. */
export function linksTwin(html: string, twin: string): boolean {
  const head = html.slice(0, Math.max(0, html.search(/<\/head>/i)) || html.length);
  return [...head.matchAll(/<link\b[^>]*>/gi)].some(([tag]) => {
    return (
      /\srel="alternate"/i.test(tag) &&
      /\stype="text\/markdown"/i.test(tag) &&
      tag.includes(`href="${twin}"`)
    );
  });
}

/**
 * The check over a build, pure apart from the two readers (so tests run on
 * fixtures): `readTwin` returns a twin's text or `undefined` when missing.
 */
export function checkMdParity(input: {
  pages: readonly BuiltPage[];
  readTwin: (path: string) => string | undefined;
  manifest: Record<string, string> | undefined;
  origin: string;
}): MdParityReport {
  const report: MdParityReport = { pages: input.pages.length, twins: 0, exempt: [], problems: [] };
  if (!input.manifest) report.problems.push('md-manifest.json is missing or has no twins map');
  for (const { route, html } of [...input.pages].sort((a, b) => a.route.localeCompare(b.route))) {
    const exemption = twinExemption(route);
    if (exemption) {
      report.exempt.push({ route, reason: exemption.reason });
      continue;
    }
    if (isRedirectStub(html)) {
      report.exempt.push({ route, reason: 'redirect stub (meta refresh)' });
      continue;
    }
    const twin = twinPathFor(route);
    if (!twin) {
      report.problems.push(`${route}: not a page route a twin can be named for`);
      continue;
    }
    const before = report.problems.length;
    const markdown = input.readTwin(twin);
    if (markdown === undefined) {
      report.problems.push(`${route}: no twin at ${twin}`);
      continue;
    }
    const parsed = parseTwinHeader(markdown);
    if (!parsed.ok) {
      for (const problem of parsed.problems) report.problems.push(`${twin}: ${problem}`);
    } else {
      if (parsed.header.canonical !== `${input.origin}${route}`)
        report.problems.push(
          `${twin}: Canonical is "${parsed.header.canonical}", expected "${input.origin}${route}"`
        );
      if (!parsed.header.markdown.includes(`${input.origin}${twin}`))
        report.problems.push(`${twin}: the Markdown line does not name ${input.origin}${twin}`);
    }
    if (!linksTwin(html, twin))
      report.problems.push(
        `${route}: the head has no <link rel="alternate" type="text/markdown" href="${twin}">`
      );
    if (input.manifest && input.manifest[route] !== twin)
      report.problems.push(`${route}: md-manifest.json does not map it to ${twin}`);
    if (report.problems.length === before) report.twins += 1;
  }
  return report;
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && entry.name.endsWith('.html') ? [path] : [];
  });
}

/** Reads a build directory into the check's input. */
export function readBuild(dist: string, origin: string): Parameters<typeof checkMdParity>[0] {
  const pages = htmlFiles(dist).map((file) => ({
    route: routeOf(dist, file),
    html: readFileSync(file, 'utf8'),
  }));
  let manifest: Record<string, string> | undefined;
  try {
    const parsed = JSON.parse(readFileSync(join(dist, 'md-manifest.json'), 'utf8')) as {
      twins?: Record<string, string>;
    };
    manifest = parsed.twins && typeof parsed.twins === 'object' ? parsed.twins : undefined;
  } catch {
    manifest = undefined;
  }
  return {
    pages,
    manifest,
    origin,
    readTwin: (path) => {
      const file = join(dist, path.slice(1));
      return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
    },
  };
}

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? (process.argv[index + 1] as string) : fallback;
}

function main(): number {
  const strict = process.argv.includes('--strict');
  const dist = resolve(arg('--dist', join(import.meta.dirname, '../apps/website/dist')));
  const origin = arg('--origin', 'https://texuli.com');
  if (!existsSync(join(dist, 'index.html'))) {
    console.error(`md parity ✗ no build at ${dist}: run \`pnpm build\` first`);
    return 1;
  }
  const report = checkMdParity(readBuild(dist, origin));
  const exempt = report.exempt.map((entry) => `${entry.route} (${entry.reason})`).join('; ');
  if (report.problems.length === 0) {
    console.log(
      `md parity ✓ ${report.twins} of ${report.pages} HTML pages have a valid Markdown twin; ${report.exempt.length} exempt: ${exempt || 'none'}`
    );
    return 0;
  }
  console.error(
    `md parity ✗ ${report.problems.length} problem(s) over ${report.pages} HTML pages (${report.twins} valid twins):`
  );
  for (const problem of report.problems.slice(0, 50)) console.error(`  ${problem}`);
  if (report.problems.length > 50) console.error(`  … and ${report.problems.length - 50} more`);
  return strict ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exit(main());
