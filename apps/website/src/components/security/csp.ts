/**
 * Build-time CSP for the static website. Each page gets enforcing and
 * report-only response-header hashes for exactly the inline scripts, styles,
 * and server-rendered style attributes in its finished HTML, plus the styles
 * its components inject at runtime (read from the built chunks it loads). The build writes
 * those policies twice: `dist/_headers` (Cloudflare Pages shape) and
 * `dist/csp-manifest.json` (host-neutral, one entry per route) so any static
 * host can apply them without re-parsing the HTML. The hosting adapter must
 * apply one of the two artifacts.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { apiHeaderRules } from '../../lib/api-surface.ts';
import { agentEndpoint } from '../agent-chat/client.ts';
import {
  DISCOVERY_PATHS,
  discoveryHeaderRules,
  discoveryLinks,
  formatLinkHeader,
  twinCandidate,
} from '../seo/agent-discovery.ts';

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const INLINE_STYLE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
const STYLE_ATTRIBUTE = /\sstyle=(['"])(.*?)\1/gi;

function hash(value: string): string {
  return `'sha256-${createHash('sha256').update(value).digest('base64')}'`;
}

function hashes(values: Iterable<string>): string {
  return [...new Set(Array.from(values, hash))].sort().join(' ');
}

/** The hashed tokens of one source list, in the form CSP policies quote them. */
function hashTokens(values: Iterable<string>): string[] {
  return [...new Set(Array.from(values, hash))].sort();
}

/** Inline script, style and style-attribute sources of one finished page. */
export interface PageSources {
  scripts: string[];
  styles: string[];
  attributes: string[];
}

/**
 * The `Vary: Accept` line a page's `_headers` rule carries when the page is
 * negotiable: its Markdown twin was built (every page since PLAN_011
 * T-ar-twins, `/` included). It lives here, next to the CSP, because
 * Cloudflare Pages applies `_headers` only to the asset response: the edge
 * middleware must pass that response through untouched, or the page loses
 * its CSP (PLAN_006 T-100 S-2, seen in production). `exists` answers for a
 * root-relative path in the finished build.
 */
export function varyHeaderLine(route: string, exists: (path: string) => boolean): string {
  const twin = twinCandidate(route);
  return twin && exists(twin) ? '\n  Vary: Accept' : '';
}

/**
 * The `Link` line of a page's `_headers` rule (PLAN_011 T-ar-discovery):
 * the discovery links every HTML page carries, plus the page's Markdown
 * twin when the build wrote one. `exists` answers for a root-relative path
 * in the finished build (`/openapi.json`, `/guides/theming.md`).
 */
export function linkHeaderLine(route: string, exists: (path: string) => boolean): string {
  const candidate = twinCandidate(route);
  const twin = candidate && exists(candidate) ? candidate : undefined;
  const value = formatLinkHeader(
    discoveryLinks({ openapi: exists(DISCOVERY_PATHS.openapi), twin })
  );
  return `\n  Link: ${value}`;
}

/** The deduplicated inline sources of one finished HTML document. */
export function pageSources(html: string): PageSources {
  return {
    scripts: [...html.matchAll(INLINE_SCRIPT)]
      .filter((match) => !/\ssrc\s*=/.test(match[1] ?? ''))
      .map((match) => match[2] ?? ''),
    styles: [...html.matchAll(INLINE_STYLE)].map((match) => match[1] ?? ''),
    attributes: [...html.matchAll(STYLE_ATTRIBUTE)].map((match) => match[2] ?? ''),
  };
}

/**
 * The Trusted Types policy public/umami-loader.js creates to set the
 * analytics script URL. Allowed only on pages that mount the loader tag,
 * so an analytics-off build keeps `trusted-types svelte-trusted-html`.
 */
export const ANALYTICS_TRUSTED_TYPES_POLICY = 'texuli-analytics';

/** The rendered loader tag (an escaped code sample never matches). */
const UMAMI_LOADER_TAG = /<script\b[^>]*\sdata-umami-loader(?=[\s=>/])/i;

/** The Trusted Types policy names one finished page may create. */
export function trustedTypesPolicies(html: string): string[] {
  return UMAMI_LOADER_TAG.test(html)
    ? ['svelte-trusted-html', ANALYTICS_TRUSTED_TYPES_POLICY]
    : ['svelte-trusted-html'];
}

export interface PagePolicyOptions {
  /** Extra `connect-src` origins (the configured agent service, on the agent chat page only). */
  connect?: readonly string[];
  /**
   * The CSS of `<style>` elements the page's scripts inject at runtime (see
   * {@link injectedStyleGraph}): hashed into `style-src` with the inline ones.
   */
  injectedStyles?: readonly string[];
}

// ---------------------------------------------------------------------------
// Styles injected at runtime

/**
 * Svelte components compiled with `<svelte:options css="injected" />` (the
 * site's lazily loaded demo frames and stages, so their CSS ships with their
 * chunk) append a `<style>` with their compiled CSS when they mount. That
 * element is not in the finished HTML, so its hash must come from the built
 * JavaScript: the compiler emits `{ hash: "svelte-…", code: "…" }`, and the
 * `code` string is exactly the text the browser hashes.
 */
const INJECTED_CSS =
  /\bhash:\s*(["'`])svelte-[a-z0-9]+\1\s*,\s*code:\s*(["'`])((?:\\[\s\S]|(?!\2)[^\\])*)\2/g;

/** Relative module specifiers inside a built chunk (`"./x.js"`, static or `import()`). */
const CHUNK_IMPORT = /["'`]\.\/([\w.$~-]+\.m?js)["'`]/g;

/** Built chunks a page names in its HTML (scripts, islands, preloads). */
const PAGE_CHUNK = /\/_astro\/([\w.$~-]+\.m?js)\b/g;

/** Decodes the body of a JS string literal, as the minifier wrote it. */
export function decodeJsString(body: string): string {
  return body.replace(
    /\\(u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|\r?\n|[\s\S])/g,
    (whole, sequence: string, codePoint?: string, unit?: string, byte?: string) => {
      const hex = codePoint ?? unit ?? byte;
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
      if (sequence === '\n' || sequence === '\r\n') return '';
      const simple: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        v: '\v',
        '0': '\0',
      };
      if (sequence in simple) return simple[sequence] as string;
      if (/^[0-9]$/.test(sequence)) throw new Error(`Unsupported escape ${whole} in injected CSS.`);
      return sequence;
    }
  );
}

/** The CSS a chunk injects, and the chunks it imports (statically or lazily). */
export interface InjectedChunk {
  styles: string[];
  imports: string[];
}

/** One chunk's injected CSS and imports, from its source text. */
export function readInjectedChunk(code: string): InjectedChunk {
  return {
    styles: [...code.matchAll(INJECTED_CSS)].map((match) => decodeJsString(match[3] ?? '')),
    imports: [...new Set([...code.matchAll(CHUNK_IMPORT)].map((match) => match[1] ?? ''))],
  };
}

/**
 * Every injected style a page can produce: the chunks its HTML names, and
 * every chunk those reach through their imports. A page that never loads a
 * component gets none of its hashes.
 */
export function pageInjectedStyles(
  html: string,
  chunks: ReadonlyMap<string, InjectedChunk>
): string[] {
  const seen = new Set<string>();
  const queue = [...html.matchAll(PAGE_CHUNK)].map((match) => match[1] ?? '');
  const styles = new Set<string>();
  while (queue.length > 0) {
    const name = queue.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    const chunk = chunks.get(name);
    if (!chunk) continue;
    for (const style of chunk.styles) styles.add(style);
    queue.push(...chunk.imports);
  }
  return [...styles];
}

/** Reads every chunk under `dist/_astro/` (empty when there is none). */
export async function injectedStyleGraph(out: string): Promise<Map<string, InjectedChunk>> {
  const dir = join(out, '_astro');
  const chunks = new Map<string, InjectedChunk>();
  if (!existsSync(dir)) return chunks;
  for (const name of await readdir(dir)) {
    if (!/\.m?js$/.test(name)) continue;
    chunks.set(name, readInjectedChunk(await readFile(join(dir, name), 'utf8')));
  }
  return chunks;
}

/** Policy for one finished HTML document, including Astro's island boot code. */
export function pagePolicy(html: string, options: PagePolicyOptions = {}): string {
  const { scripts, attributes } = pageSources(html);
  const styles = [...pageSources(html).styles, ...(options.injectedStyles ?? [])];
  return [
    "default-src 'none'",
    `script-src 'self' ${hashes(scripts)}`.trim(),
    `style-src 'self' ${hashes(styles)}`.trim(),
    // Static, generated style attributes need their exact hashes. No dynamic
    // style attribute gains permission from these page-specific values.
    `style-src-attr 'unsafe-hashes' ${hashes(attributes)}`.trim(),
    "img-src 'self' data: blob: https://example.com https://images.example.com https://media.example.test",
    "font-src 'self'",
    "media-src 'self' blob: https://example.com https://media.example.test",
    "manifest-src 'self'",
    ["connect-src 'self'", ...(options.connect ?? [])].join(' '),
    "worker-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "require-trusted-types-for 'script'",
    `trusted-types ${trustedTypesPolicies(html).join(' ')}`,
  ].join('; ');
}

/** The reporting group every report-only policy names. */
export const CSP_REPORT_GROUP = 'texuli-csp';

/**
 * The CSP report endpoint a build binds, from `PUBLIC_TEXULI_CSP_REPORT_URL`
 * (e.g. the agent service's `/v1/csp-reports`). Only an absolute `https:` URL,
 * or `http://localhost` / `127.0.0.1` for local development, is accepted.
 * Unset (the default, and today's production) binds nothing.
 */
export function cspReportEndpoint(value: unknown): string | null {
  return agentEndpoint(value);
}

/**
 * Report-only candidate: the enforcing policy plus `report-to texuli-csp`.
 * With a bound endpoint it also carries `report-uri`, the fallback for
 * browsers without the Reporting API.
 */
export function reportOnlyPolicy(enforcingPolicy: string, endpoint: string | null = null): string {
  const reportUri = endpoint ? `; report-uri ${endpoint}` : '';
  return `${enforcingPolicy}; report-to ${CSP_REPORT_GROUP}${reportUri}`;
}

/** The `Reporting-Endpoints` header value that binds the group to the endpoint. */
export function reportingEndpointsHeader(endpoint: string): string {
  return `${CSP_REPORT_GROUP}="${endpoint}"`;
}

/** The public URL for one built HTML file. */
export function pageRoute(out: string, file: string): string {
  const path = relative(out, file).split(sep).join('/');
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'index.html'.length)}`;
  return `/${path}`;
}

/** One manifest entry: a route and the policy a host must send for it. */
export interface CspManifestPage {
  route: string;
  enforcing: string;
  reportOnly: string;
  hashes: { scriptSrc: string[]; styleSrc: string[]; styleSrcAttr: string[] };
}

/**
 * The host-neutral manifest as deterministic JSON: pages sorted by route,
 * fixed key order, no timestamps — two builds of the same tree emit
 * identical bytes.
 */
export function buildCspManifest(
  pages: CspManifestPage[],
  reportEndpoint: string | null = null
): string {
  const sorted = [...pages].sort((a, b) => (a.route < b.route ? -1 : a.route > b.route ? 1 : 0));
  const manifest = {
    version: 1,
    policyKind: 'per-route-hash-csp',
    // Present only when a build binds a report endpoint (none is bound today).
    ...(reportEndpoint
      ? {
          reporting: {
            group: CSP_REPORT_GROUP,
            endpoint: reportEndpoint,
            header: reportingEndpointsHeader(reportEndpoint),
          },
        }
      : {}),
    pages: sorted.map((page) => ({
      route: page.route,
      enforcing: page.enforcing,
      reportOnly: page.reportOnly,
      hashes: {
        scriptSrc: [...page.hashes.scriptSrc].sort(),
        styleSrc: [...page.hashes.styleSrc].sort(),
        styleSrcAttr: [...page.hashes.styleSrcAttr].sort(),
      },
    })),
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
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

/**
 * The agent service origin a page may connect to: only the agent chat page,
 * and only when the build set `PUBLIC_TEXULI_AGENT_URL` (nothing is deployed
 * today, so production builds add nothing).
 */
export function agentConnectSources(html: string, configured: unknown): string[] {
  if (!html.includes('data-tx-agent-page')) return [];
  const endpoint = agentEndpoint(configured);
  return endpoint ? [new URL(endpoint).origin] : [];
}

export function cspIntegration(): AstroIntegration {
  return {
    name: 'texuli-csp',
    hooks: {
      // Keep this integration last: SEO and Copy page can edit HTML at build:done.
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const files = await htmlFiles(out);
        const rules: string[] = [];
        const builtFile = (path: string) => existsSync(join(out, path.slice(1)));
        const manifestPages: CspManifestPage[] = [];
        const reportEndpoint = cspReportEndpoint(process.env.PUBLIC_TEXULI_CSP_REPORT_URL);
        const reporting = reportEndpoint
          ? `\n  Reporting-Endpoints: ${reportingEndpointsHeader(reportEndpoint)}`
          : '';
        const chunks = await injectedStyleGraph(out);
        let injectedPages = 0;
        for (const file of files) {
          const route = pageRoute(out, file);
          const html = await readFile(file, 'utf8');
          const injectedStyles = pageInjectedStyles(html, chunks);
          if (injectedStyles.length > 0) injectedPages += 1;
          const sources = pageSources(html);
          sources.styles.push(...injectedStyles);
          const policy = pagePolicy(html, {
            connect: agentConnectSources(html, process.env.PUBLIC_TEXULI_AGENT_URL),
            injectedStyles,
          });
          const reportOnly = reportOnlyPolicy(policy, reportEndpoint);
          const rule = (path: string) =>
            `${path}\n  Content-Security-Policy: ${policy}\n  Content-Security-Policy-Report-Only: ${reportOnly}${reporting}${varyHeaderLine(path, builtFile)}${linkHeaderLine(path, builtFile)}`;
          rules.push(rule(route));
          manifestPages.push({
            route,
            enforcing: policy,
            reportOnly,
            hashes: {
              scriptSrc: hashTokens(sources.scripts),
              styleSrc: hashTokens(sources.styles),
              styleSrcAttr: hashTokens(sources.attributes),
            },
          });
          // A static host may expose both the directory URL and its index file.
          if (route.endsWith('/')) {
            const fileRoute = `${route}index.html`;
            rules.push(rule(fileRoute));
            manifestPages.push({
              route: fileRoute,
              enforcing: policy,
              reportOnly,
              hashes: {
                scriptSrc: hashTokens(sources.scripts),
                styleSrc: hashTokens(sources.styles),
                styleSrcAttr: hashTokens(sources.attributes),
              },
            });
          }
        }
        // The discovery files (content types, CORS on the public JSON) and the
        // JSON API (`/api/*`, `/openapi.json`) follow the page rules; their
        // paths never match an HTML route.
        await writeFile(
          join(out, '_headers'),
          `${[...rules.sort(), ...discoveryHeaderRules(), ...apiHeaderRules()].join('\n\n')}\n`
        );
        await writeFile(
          join(out, 'csp-manifest.json'),
          buildCspManifest(manifestPages, reportEndpoint)
        );
        logger.info(
          `Enforcing and report-only CSP headers written for ${files.length} HTML pages (${injectedPages} also hash the styles their components inject at runtime), plus the csp-manifest.json host contract.`
        );
      },
    },
  };
}
