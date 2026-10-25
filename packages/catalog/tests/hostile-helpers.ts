import { safeParseBlock } from '@texuli/blocks/core';
import { safeHref, safeImageSrc, safeMediaSrc } from '@texuli/core/url-policy';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { createPlayer, type PaintAdapter, type PlayerLoader } from '../src/player/index.ts';
import { assertInertRoots, looksExecutable } from '../src/render/hostile/index.ts';
import { type RenderCatalog, renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import { scanSinks, validateDraft } from '../src/validate/index.ts';

/**
 * One definition of "invalid or inert" for the hostile corpus and the fuzz
 * rounds: whatever a hostile input is, validateDraft never throws, a valid
 * draft carries nothing executable, and the player paints nothing that could
 * reach a sink, by default (refuse) or with invalidPolicy "preview".
 */

export const build = await buildCatalog(await discoverManifestGroups());
export const catalog = renderCatalogFromBuild(build.catalog);

const FORBIDDEN_KEYS = new Set([
  'class',
  'classname',
  'style',
  'styles',
  'innerhtml',
  'outerhtml',
  'srcdoc',
  'dangerouslysetinnerhtml',
]);
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isUrlKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower === 'href' || lower === 'src' || lower === 'poster' || /(href|src|url)$/.test(lower);
}

/** Key-aware, like the sink scan and the player's paint-time policy. */
function urlAccepted(key: string, value: string): boolean {
  const lower = key.toLowerCase();
  if (lower === 'href' || lower.endsWith('href') || lower.endsWith('url')) {
    return safeHref(value, 'untrusted') !== undefined;
  }
  return (
    safeImageSrc(value, 'untrusted') !== undefined || safeMediaSrc(value, 'untrusted') !== undefined
  );
}

/**
 * Problems in painted or rendered data, at any depth: forbidden or handler
 * keys, functions, URL-keyed values the untrusted policy refuses, script
 * schemes in URL keys, and (when `strict`) prototype keys.
 */
export function unsafeData(value: unknown, path = '$', strict = true, depth = 0): string[] {
  if (depth > 200) return [`${path}: nests deeper than 200`];
  if (typeof value === 'function') return [`${path}: a function`];
  if (value === null || typeof value !== 'object') return [];
  const out: string[] = [];
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value);
  for (const [key, child] of entries) {
    const here = `${path}.${key}`;
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(lower)) out.push(`${here}: forbidden key`);
    if (!Array.isArray(value) && /^on[a-z]/i.test(key)) out.push(`${here}: handler key`);
    if (strict && PROTOTYPE_KEYS.has(key)) out.push(`${here}: prototype key`);
    if (
      typeof child === 'string' &&
      isUrlKey(key) &&
      (!urlAccepted(key, child) || looksExecutable(child))
    ) {
      out.push(`${here}: URL the untrusted policy refuses`);
    }
    out.push(...unsafeData(child, here, strict, depth + 1));
  }
  return out;
}

type Painted =
  | { id: string; props: Readonly<Record<string, unknown>>; children: Painted[] }
  | { placeholder: string };
const adapter: PaintAdapter<Painted> = {
  component: (node, _c, children) => ({ id: node.id, props: node.props, children: [...children] }),
  placeholder: (node) => ({ placeholder: node.id }),
  skeleton: (node) => ({ placeholder: node.id }),
};
const loaders: Record<string, PlayerLoader> = Object.fromEntries(
  build.catalog.entries.map((e) => [e.id, async () => e.id])
);

export interface Verdict {
  valid: boolean;
  failures: string[];
}

/** Run one hostile input through validateDraft and both player policies. */
export async function invalidOrInert(
  input: unknown,
  options: {
    frameRoots?: false;
    tier?: 'untrusted' | 'developer';
    renderCatalog?: RenderCatalog;
  } = {}
): Promise<Verdict> {
  const failures: string[] = [];
  const renderCatalog = options.renderCatalog ?? catalog;
  const tier = options.tier ?? 'untrusted';
  let validation: ReturnType<typeof validateDraft>;
  try {
    validation = validateDraft(input, {
      catalog: renderCatalog,
      tier,
      checkBlock: safeParseBlock,
      ...(options.frameRoots === false ? { frameRoots: false as const } : {}),
    });
  } catch (error) {
    return { valid: false, failures: [`validateDraft threw: ${(error as Error).message}`] };
  }
  if (validation.ok) {
    failures.push(...assertInertRoots(validation.roots));
    // Validated data follows the host's tier; the paint checks below are
    // always held to the untrusted policy.
    if (tier === 'untrusted') failures.push(...unsafeData(validation.roots, 'roots'));
    const sinks = scanSinks(validation.draft, tier).filter(
      (f) => f.message !== 'a bidi control character'
    );
    failures.push(...sinks.map((f) => `draft ${f.path}: ${f.message}`));
  }
  for (const invalidPolicy of ['refuse', 'preview'] as const) {
    const player = createPlayer({
      blueprint: input,
      catalog: renderCatalog,
      tier,
      checkBlock: safeParseBlock,
      loaders,
      invalidPolicy,
      ...(options.frameRoots === false ? { frameRoots: false as const } : {}),
    });
    const painted = await player.paint(adapter);
    if (invalidPolicy === 'refuse' && !validation.ok && painted.length > 0) {
      failures.push('refuse policy painted an invalid draft');
    }
    // Preview paints invalid drafts too: block internals may keep unknown
    // keys there (the block component parses them), so only valid drafts
    // are held to the strict prototype rule.
    failures.push(...unsafeData(painted, `painted:${invalidPolicy}`, validation.ok).map((f) => f));
  }
  const probe = {} as Record<string, unknown>;
  if (probe.polluted !== undefined || probe.isAdmin !== undefined)
    failures.push('Object.prototype polluted');
  return { valid: validation.ok, failures };
}
