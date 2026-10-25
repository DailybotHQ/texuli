/**
 * Layout catalog and resolution (owned by Texuli; no zod, no @protoyard).
 * Data-only so CLI, docs and DevTools can read it without rendering.
 */

export const LAYOUT_IDS = [
  'sidebar',
  'rail',
  'top-nav',
  'dual-sidebar',
  'master-detail',
  'dashboard-grid',
  'docs',
  'blog',
  'editorial',
  'marketing',
  'mobile-tabs',
  'mobile-drawer',
  'wizard',
  'auth-split',
  'custom',
] as const;

export type LayoutId = (typeof LAYOUT_IDS)[number];

/** The host renders no shared chrome; the app owns the frame. */
export const DEFAULT_LAYOUT: LayoutId = 'custom';

export type LayoutPlatform = 'desktop' | 'mobile' | 'responsive';

/**
 * Flat, data-only knobs a layout reads (never code).
 * Keys: camelCase or kebab-case, ≤40 chars. At most 32 entries.
 * Values: string ≤120, finite number, or boolean.
 */
export type LayoutOptions = Readonly<Record<string, string | number | boolean>>;

export type LayoutSettings = {
  /** Layout the app opens in. */
  id?: LayoutId;
  /** Layouts the app may switch between. */
  supported?: readonly LayoutId[];
  options?: LayoutOptions;
};

export type LayoutSpec = {
  readonly id: LayoutId;
  readonly label: string;
  readonly platforms: readonly LayoutPlatform[];
  /** Narrowest width (CSS px) the layout works at as designed. */
  readonly minWidth: number;
  /** Layout used below `minWidth`; absent when the layout adapts itself. */
  readonly fallback?: LayoutId;
};

const WIDE: readonly LayoutPlatform[] = ['desktop', 'responsive'];
const NARROW: readonly LayoutPlatform[] = ['mobile', 'responsive'];
const ANY: readonly LayoutPlatform[] = ['desktop', 'mobile', 'responsive'];

function spec(
  id: LayoutId,
  label: string,
  platforms: readonly LayoutPlatform[],
  minWidth = 0,
  fallback?: LayoutId
): LayoutSpec {
  return Object.freeze(
    fallback ? { id, label, platforms, minWidth, fallback } : { id, label, platforms, minWidth }
  );
}

/** Every layout, in picker order. Frozen. */
export const LAYOUTS: readonly LayoutSpec[] = Object.freeze([
  spec('sidebar', 'Sidebar', WIDE, 768, 'mobile-drawer'),
  spec('rail', 'Icon rail', WIDE, 640, 'mobile-tabs'),
  spec('top-nav', 'Top navigation', WIDE, 768, 'mobile-drawer'),
  spec('dual-sidebar', 'Dual sidebar', ['desktop'], 1024, 'sidebar'),
  spec('master-detail', 'Master-detail', WIDE, 900, 'mobile-drawer'),
  spec('dashboard-grid', 'Dashboard grid', WIDE, 768, 'mobile-drawer'),
  spec('docs', 'Docs', ANY),
  spec('blog', 'Blog', ANY),
  spec('editorial', 'Editorial', ANY),
  spec('marketing', 'Marketing page', ANY),
  spec('mobile-tabs', 'Mobile tab bar', NARROW),
  spec('mobile-drawer', 'Mobile drawer', NARROW),
  spec('wizard', 'Wizard', ANY),
  spec('auth-split', 'Auth split', ANY),
  spec('custom', 'Custom', ANY),
]);

const LAYOUT_ID_SET = new Set<string>(LAYOUT_IDS);

export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === 'string' && LAYOUT_ID_SET.has(value);
}

export function getLayout(id: LayoutId): LayoutSpec | undefined {
  return LAYOUTS.find((layout) => layout.id === id);
}

/**
 * Layouts an app can switch between: its `id` first, then `supported`
 * (or every shared layout when it declares none and is not `custom`).
 */
export function layoutChoices(settings?: Partial<LayoutSettings>): readonly LayoutId[] {
  const id = settings?.id ?? DEFAULT_LAYOUT;
  if (settings?.supported) {
    const rest = settings.supported.filter((s) => s !== id && isLayoutId(s));
    return [id, ...rest];
  }
  if (id === 'custom') return ['custom'];
  return LAYOUT_IDS.filter((layout) => layout !== 'custom');
}

/**
 * The layout to render at `width`, following each `fallback` below its `minWidth`.
 * Pure: no DOM. Callers supply width from a ResizeObserver (never at import time).
 */
export function layoutForWidth(id: LayoutId, width: number): LayoutId {
  let current: LayoutId = isLayoutId(id) ? id : DEFAULT_LAYOUT;
  // Width ≤ 0 means "not measured yet" (SSR / before ResizeObserver). Keep the
  // requested layout so the host never reads window at init and does not flash
  // a mobile fallback on a wide first paint.
  if (!Number.isFinite(width) || width <= 0) return current;
  for (let hops = 0; hops < LAYOUT_IDS.length; hops += 1) {
    const layout = getLayout(current);
    if (!layout?.fallback || width >= layout.minWidth) return current;
    current = layout.fallback;
  }
  return current;
}

const OPTION_KEY = /^[a-z][a-zA-Z0-9-]*$/;

/**
 * Validate layout options without zod. Returns a cleaned record or `undefined`
 * when the input is not a plain object.
 */
export function normalizeLayoutOptions(value: unknown): LayoutOptions | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [rawKey, rawVal] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(out).length >= 32) break;
    if (typeof rawKey !== 'string' || rawKey.length === 0 || rawKey.length > 40) continue;
    if (!OPTION_KEY.test(rawKey)) continue;
    if (typeof rawVal === 'boolean') {
      out[rawKey] = rawVal;
      continue;
    }
    if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
      out[rawKey] = rawVal;
      continue;
    }
    if (typeof rawVal === 'string' && rawVal.length <= 120) {
      out[rawKey] = rawVal;
    }
  }
  return Object.freeze(out);
}
