import { safeHref, safeImageSrc, safeImageSrcset, safeMediaSrc } from '@texuli/core/url-policy';

/** A URL the paint-time policy removed, with its path inside the props. */
export interface PaintUrlIssue {
  path: string;
  message: string;
}

const MAX_DEPTH = 32;

function isUrlKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower === 'href' ||
    lower === 'src' ||
    lower === 'poster' ||
    lower.endsWith('href') ||
    lower.endsWith('src') ||
    lower.endsWith('srcset') ||
    lower.endsWith('url')
  );
}

/** The value the untrusted policy keeps for a URL-bearing key, or `undefined`. */
function policed(key: string, value: string): string | undefined {
  const lower = key.toLowerCase();
  // Every srcset candidate URL passes the image policy, or the whole value goes.
  if (lower.endsWith('srcset')) return safeImageSrcset(value, 'untrusted');
  if (lower === 'href' || lower.endsWith('href') || lower.endsWith('url')) {
    return safeHref(value, 'untrusted') ?? undefined;
  }
  return safeImageSrc(value, 'untrusted') ?? safeMediaSrc(value, 'untrusted') ?? undefined;
}

/**
 * Props as they reach a component: every URL-bearing value, at any depth, is
 * passed through the **untrusted** URL policy again at paint time, whatever
 * tier validated the tree, and forbidden, event-handler and prototype keys
 * are dropped at any depth (defense in depth for previews of invalid drafts,
 * whose nested block data the renderer passes through). Removals are
 * reported. Returns new objects; the input is not mutated, and unchanged
 * branches are shared.
 */
export function paintProps(
  props: Readonly<Record<string, unknown>>,
  issues: PaintUrlIssue[],
  path = 'props'
): Readonly<Record<string, unknown>> {
  return policeValue(props, '', path, issues, 0) as Readonly<Record<string, unknown>>;
}

/** Keys a component never receives from blueprint data, at any depth. */
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

function droppedKey(key: string): string | null {
  if (PROTOTYPE_KEYS.has(key)) return 'A prototype key was dropped at paint.';
  if (FORBIDDEN_KEYS.has(key.toLowerCase())) return 'A forbidden key was dropped at paint.';
  if (/^on[a-z]/i.test(key)) return 'An event-handler key was dropped at paint.';
  return null;
}

function policeValue(
  value: unknown,
  key: string,
  path: string,
  issues: PaintUrlIssue[],
  depth: number
): unknown {
  if (typeof value === 'string') {
    if (!isUrlKey(key)) return value;
    const safe = policed(key, value);
    if (safe === undefined) {
      issues.push({ path, message: 'The untrusted URL policy refused this URL at paint.' });
    }
    return safe;
  }
  if (value === null || typeof value !== 'object') return value;
  if (depth > MAX_DEPTH) {
    // Too deep to police: never hand it to a component.
    issues.push({ path, message: 'A value nested too deep was dropped at paint.' });
    return undefined;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item, index) => {
      const out = policeValue(item, key, `${path}[${index}]`, issues, depth + 1);
      if (out !== item) changed = true;
      return out;
    });
    return changed ? next.filter((item) => item !== undefined) : value;
  }
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [childKey, child] of Object.entries(value)) {
    const dropped = droppedKey(childKey);
    if (dropped) {
      issues.push({ path: `${path}.${childKey}`, message: dropped });
      changed = true;
      continue;
    }
    const out = policeValue(child, childKey, `${path}.${childKey}`, issues, depth + 1);
    if (out !== child) changed = true;
    // defineProperty: a key is always an own data property, never a prototype setter.
    if (out !== undefined) {
      Object.defineProperty(next, childKey, {
        value: out,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  return changed ? next : value;
}
