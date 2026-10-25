import { safeHref, safeImageSrc, safeMediaSrc } from '@texuli/core/url-policy';
import { looksExecutable } from '../render/hostile/run.ts';

/**
 * Sink checks on the raw draft, before the renderer cleans it: a tree that
 * tries an HTML string, a script URL or a style is refused even though the
 * sink-free renderer would have made it inert. Moved here from the golden
 * scorer so every host runs the same scan.
 */

/** One sink-like value, with its path from `tree`. */
export interface SinkFinding {
  path: string;
  message: string;
}

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

const HTML_TAG = /<\s*\/?\s*[a-z][a-z0-9-]*(?:\s[^<>]*)?>/i;
// Bidi overrides and isolates (U+202A–U+202E, U+2066–U+2069), written as escapes.
const BIDI_CONTROL = /[\u202a-\u202e\u2066-\u2069]/;
const MAX_DEPTH = 32;

/** The URL policy tier a scan judges URL-keyed values with. */
export type SinkUrlTier = 'developer' | 'untrusted';

function isUrlKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower === 'href' ||
    lower === 'src' ||
    lower === 'poster' ||
    lower.endsWith('href') ||
    lower.endsWith('src') ||
    lower.endsWith('url')
  );
}

/**
 * Whether the tier's URL policy for this kind of key keeps the value (the
 * policy returns `undefined` for a refused URL). Link keys (`href`, `…Href`,
 * `…Url`) use the link policy; `src`, `…Src` and `poster` use the image or
 * media policy, the same split the player applies at paint.
 */
function urlKept(key: string, value: string, tier: SinkUrlTier): boolean {
  const lower = key.toLowerCase();
  if (lower === 'href' || lower.endsWith('href') || lower.endsWith('url')) {
    return safeHref(value, tier) !== undefined;
  }
  return safeImageSrc(value, tier) !== undefined || safeMediaSrc(value, tier) !== undefined;
}

function checkString(
  value: string,
  path: string,
  key: string,
  out: SinkFinding[],
  tier: SinkUrlTier
): void {
  if (looksExecutable(value)) out.push({ path, message: 'an executable string' });
  else if (HTML_TAG.test(value)) out.push({ path, message: 'an HTML string' });
  if (BIDI_CONTROL.test(value)) out.push({ path, message: 'a bidi control character' });
  if (isUrlKey(key) && !urlKept(key, value, tier)) {
    out.push({ path, message: `a URL the ${tier} URL policy refuses` });
  }
}

function checkValue(
  value: unknown,
  path: string,
  key: string,
  out: SinkFinding[],
  depth: number,
  tier: SinkUrlTier
): void {
  if (depth > MAX_DEPTH) {
    out.push({ path, message: 'nested too deep to check' });
    return;
  }
  if (typeof value === 'string') {
    checkString(value, path, key, out, tier);
    return;
  }
  if (typeof value === 'function') {
    out.push({ path, message: 'a function' });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      checkValue(item, `${path}[${index}]`, key, out, depth + 1, tier);
    });
    return;
  }
  if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) {
      const here = `${path}.${childKey}`;
      if (FORBIDDEN_KEYS.has(childKey.toLowerCase())) {
        out.push({ path: here, message: `a forbidden "${childKey}" key` });
      } else if (/^on[a-z]/i.test(childKey)) {
        out.push({ path: here, message: 'an event handler key' });
      }
      checkValue(child, here, childKey, out, depth + 1, tier);
    }
  }
}

/**
 * Every sink-like value in a tree (any shape), with its path. URL-keyed
 * values are judged by the given tier's policy (default `untrusted`), the
 * tier `validateDraft` validates with; the player still applies the
 * untrusted policy again at paint, whatever the tier.
 */
export function scanSinks(tree: unknown, tier: SinkUrlTier = 'untrusted'): SinkFinding[] {
  const out: SinkFinding[] = [];
  const visit = (node: unknown, path: string, depth: number): void => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return;
    if (Array.isArray(node)) {
      node.forEach((root, index) => {
        visit(root, `${path}[${index}]`, depth + 1);
      });
      return;
    }
    const record = node as { id?: unknown; props?: unknown; children?: unknown };
    if (typeof record.id === 'string') checkString(record.id, `${path}.id`, 'id', out, tier);
    checkValue(record.props, `${path}.props`, 'props', out, 0, tier);
    if (Array.isArray(record.children)) {
      record.children.forEach((child, index) => {
        visit(child, `${path}.children[${index}]`, depth + 1);
      });
    }
  };
  visit(tree, 'tree', 0);
  return out;
}
