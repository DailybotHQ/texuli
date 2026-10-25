/**
 * Generation-side CSP coverage check over the built site (apps/website/dist).
 *
 * Independent of `src/components/security/csp.ts`: it re-parses every built
 * HTML page with its own tag scanner (not the integration's regexes),
 * recomputes the SHA-256 hashes of every inline script, style element and
 * style attribute, and proves each one is covered by the page's generated
 * policy — in `dist/_headers` and in `dist/csp-manifest.json` — with no
 * `unsafe-inline`.
 *
 * Run after `pnpm --filter @texuli/website build`:
 *   pnpm --filter @texuli/website exec tsx tests/csp-coverage.mts
 *
 * Exits 1 with one FINDING line per gap; exits 0 with a coverage summary.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const DIST = join(import.meta.dirname, '..', 'dist');

function fail(message: string): never {
  console.error(`FINDING: ${message}`);
  process.exit(1);
}

async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return htmlFiles(path);
      return entry.isFile() && entry.name.endsWith('.html') ? [path] : [];
    })
  );
  return files.flat();
}

/** The public URL for one built HTML file (same rule as the integration). */
function pageRoute(out: string, file: string): string {
  const path = relative(out, file).split(sep).join('/');
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'index.html'.length)}`;
  return `/${path}`;
}

function sha256(value: string): string {
  return `'sha256-${createHash('sha256').update(value).digest('base64')}'`;
}

/** An opening tag: lower-case name and its raw attribute string. */
interface OpenTag {
  name: string;
  attributes: string;
}

/**
 * Read one opening tag starting at `open` (an exact `<`). Returns undefined
 * for closing tags, declarations and malformed markup. Attribute values may
 * be quoted; the scan honours the quotes when locating the tag's `>`.
 */
function readOpenTag(html: string, open: number): OpenTag | undefined {
  if (html[open + 1] === '/' || html[open + 1] === '!' || html[open + 1] === '?') return undefined;
  const name = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(html.slice(open + 1, open + 40))?.[0];
  if (!name) return undefined;
  let cursor = open + 1 + name.length;
  while (cursor < html.length) {
    const char = html[cursor];
    if (char === "'" || char === '"') {
      const closingQuote = html.indexOf(char, cursor + 1);
      if (closingQuote < 0) return undefined;
      cursor = closingQuote + 1;
      continue;
    }
    if (char === '>')
      return { name: name.toLowerCase(), attributes: html.slice(open + 1 + name.length, cursor) };
    cursor += 1;
  }
  return undefined;
}

/** Index of the `</name>` close tag at or after `from`, or -1. */
function indexOfCloseTag(html: string, from: number, name: string): number {
  return html.toLowerCase().indexOf(`</${name}`, from);
}

/** Inline script, style and style-attribute sources of one finished page. */
export function extractSources(html: string): {
  scripts: string[];
  styles: string[];
  attributes: string[];
} {
  const scripts: string[] = [];
  const styles: string[] = [];
  const attributes: string[] = [];
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open < 0) break;
    if (html.startsWith('<!--', open)) {
      const end = html.indexOf('-->', open + 4);
      index = end < 0 ? html.length : end + 3;
      continue;
    }
    const tag = readOpenTag(html, open);
    if (!tag) {
      index = open + 1;
      continue;
    }
    if (tag.name === 'script' || tag.name === 'style') {
      // Raw-text element: everything up to its close tag is content, even
      // when that content contains markup.
      const contentStart = html.indexOf('>', open) + 1;
      const close = indexOfCloseTag(html, contentStart, tag.name);
      if (close < 0) {
        index = contentStart;
        continue;
      }
      const body = html.slice(contentStart, close);
      if (tag.name === 'script') {
        // A script with both src and a body executes the src only: its body
        // needs no hash.
        if (!/\ssrc\s*=/i.test(tag.attributes)) scripts.push(body);
      } else {
        styles.push(body);
      }
      index = close;
      continue;
    }
    // Style attributes live inside this tag's attribute string only.
    for (const match of tag.attributes.matchAll(/\sstyle\s*=\s*(['"])([\s\S]*?)\1/gi)) {
      attributes.push(match[2] ?? '');
    }
    index = open + 1;
  }
  return {
    scripts: [...new Set(scripts)],
    styles: [...new Set(styles)],
    attributes: [...new Set(attributes)],
  };
}

type HeaderRule = Map<string, string>;

/** Parse the Cloudflare-Pages-style `_headers` file into route → header map. */
function parseHeaders(text: string): Map<string, HeaderRule> {
  const rules = new Map<string, HeaderRule>();
  let route: string | undefined;
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      route = undefined;
      continue;
    }
    if (!/^\s/.test(line)) {
      route = line.trim();
      rules.set(route, new Map());
      continue;
    }
    const header = line.indexOf(':');
    if (route === undefined || header < 0) fail(`malformed _headers line: ${JSON.stringify(line)}`);
    rules.get(route)?.set(line.slice(0, header).trim(), line.slice(header + 1).trim());
  }
  return rules;
}

function directive(policy: string, name: string): string | undefined {
  return policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `) || part === name)
    ?.slice(name.length)
    .trim();
}

function hasToken(policyDirective: string | undefined, token: string): boolean {
  return (policyDirective ?? '').split(/\s+/).includes(token);
}

function missing(have: string | undefined, need: readonly string[]): string[] {
  return need.filter((token) => !hasToken(have, token));
}

const MANIFEST_PATH = join(DIST, 'csp-manifest.json');
const HEADERS_PATH = join(DIST, '_headers');

async function isFile(path: string): Promise<boolean> {
  return (await stat(path).catch(() => null))?.isFile() ?? false;
}

if (!(await isFile(HEADERS_PATH))) {
  fail('dist/_headers is missing — run pnpm --filter @texuli/website build first.');
}
if (!(await isFile(MANIFEST_PATH))) {
  fail('dist/csp-manifest.json is missing — the build must emit a host-neutral CSP manifest.');
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as {
  reporting?: { group: string; endpoint: string; header: string };
  pages: Array<{
    route: string;
    enforcing: string;
    reportOnly: string;
    hashes: { scriptSrc: string[]; styleSrc: string[]; styleSrcAttr: string[] };
  }>;
};
const headers = parseHeaders(await readFile(HEADERS_PATH, 'utf8'));
const files = await htmlFiles(DIST);
const out = DIST;

let pages = 0;
let scriptHashes = 0;
let styleHashes = 0;
let attributeHashes = 0;

const manifestRoutes = new Set(manifest.pages.map((page) => page.route));
for (const file of files) {
  const route = pageRoute(out, file);
  const page = manifest.pages.find((entry) => entry.route === route);
  const rule = headers.get(route);
  if (!page) fail(`${route}: no manifest entry for the built page.`);
  if (!rule) fail(`${route}: no _headers rule for the built page.`);
  const enforcing = rule.get('Content-Security-Policy');
  const reportOnly = rule.get('Content-Security-Policy-Report-Only');
  if (!enforcing || !reportOnly) fail(`${route}: missing an enforcing or report-only header.`);

  // The manifest must mirror the headers exactly: one artifact per host shape.
  if (page.enforcing !== enforcing)
    fail(`${route}: manifest enforcing policy differs from _headers.`);
  if (page.reportOnly !== reportOnly)
    fail(`${route}: manifest report-only policy differs from _headers.`);
  // A bound report endpoint (manifest `reporting`) adds report-uri and a Reporting-Endpoints header.
  const bound = manifest.reporting?.endpoint;
  const expectedReportOnly = `${enforcing}; report-to texuli-csp${bound ? `; report-uri ${bound}` : ''}`;
  if (reportOnly !== expectedReportOnly) {
    fail(`${route}: report-only policy is not the enforcing policy plus its reporting directives.`);
  }
  if ((rule.get('Reporting-Endpoints') ?? null) !== (bound ? `texuli-csp="${bound}"` : null)) {
    fail(`${route}: Reporting-Endpoints header does not match the manifest reporting binding.`);
  }

  const sources = extractSources(await readFile(file, 'utf8'));
  const checks: Array<[string, string[], string[]]> = [
    ['script-src', sources.scripts.map(sha256).sort(), page.hashes.scriptSrc],
    ['style-src', sources.styles.map(sha256).sort(), page.hashes.styleSrc],
    ['style-src-attr', sources.attributes.map(sha256).sort(), page.hashes.styleSrcAttr],
  ];
  for (const [name, needed, manifestHashes] of checks) {
    const uncovered = missing(directive(enforcing, name), needed);
    if (uncovered.length) {
      fail(`${route}: ${name} does not cover ${uncovered.length} source(s), e.g. ${uncovered[0]}.`);
    }
    for (const token of needed) {
      if (!manifestHashes.includes(token)) {
        fail(`${route}: manifest ${name} is missing ${token}.`);
      }
    }
  }

  // Directives that must never weaken the policy.
  for (const policy of [enforcing, reportOnly]) {
    if (hasToken(directive(policy, 'script-src'), "'unsafe-inline'")) {
      fail(`${route}: script-src allows unsafe-inline.`);
    }
    if (hasToken(directive(policy, 'style-src'), "'unsafe-inline'")) {
      fail(`${route}: style-src allows unsafe-inline.`);
    }
    if (hasToken(directive(policy, 'script-src'), "'unsafe-eval'")) {
      fail(`${route}: script-src allows unsafe-eval.`);
    }
    if (hasToken(directive(policy, 'style-src'), "'unsafe-hashes'")) {
      fail(`${route}: unsafe-hashes must stay on style-src-attr, not style-src.`);
    }
  }

  manifestRoutes.delete(route);
  if (route.endsWith('/')) manifestRoutes.delete(`${route}index.html`);
  pages += 1;
  scriptHashes += sources.scripts.length;
  styleHashes += sources.styles.length;
  attributeHashes += sources.attributes.length;
}

if (manifestRoutes.size) {
  fail(`manifest has entries for unbuilt routes: ${[...manifestRoutes].sort().join(', ')}`);
}
const headerRoutes = [...headers.keys()].filter(
  (route) => !manifest.pages.some((page) => page.route === route)
);
if (headerRoutes.length) {
  fail(`_headers has rules without manifest entries: ${headerRoutes.sort().join(', ')}`);
}

console.log(
  `csp coverage: ${pages} pages, ${scriptHashes} script, ${styleHashes} style and ${attributeHashes} attribute hashes — all covered by _headers and csp-manifest.json, no unsafe-inline.`
);
