import { navPath, type ResolvedNavItem, type ResolvedNavSection } from '../host/nav-model.ts';

/**
 * Framework-free model of the mobile layouts (T-layouts-mobile): which
 * top-level items fit in the tab bar, and the stacked-navigation header for
 * the current path (a title and, below a tab's root, a back target).
 */

/** Tabs a phone tab bar shows before the rest move to a More sheet. */
export const MOBILE_TAB_LIMIT = 5;

/** Top-level items of every section, in order: the tabs of a tab bar. */
export function topLevelItems(sections: readonly ResolvedNavSection[]): ResolvedNavItem[] {
  return sections.flatMap((section) => [...section.items]);
}

/**
 * Splits items into tabs and the More sheet. Up to `limit` fit as tabs; with
 * more, the first `limit - 1` stay and the More tab takes the last slot.
 */
export function splitTabs<T>(
  items: readonly T[],
  limit = MOBILE_TAB_LIMIT
): { tabs: T[]; more: T[] } {
  const max = Number.isFinite(limit) ? Math.max(2, Math.floor(limit)) : MOBILE_TAB_LIMIT;
  if (items.length <= max) return { tabs: [...items], more: [] };
  return { tabs: items.slice(0, max - 1), more: items.slice(max - 1) };
}

export interface StackHeader {
  /** The current screen's name: the deepest matching item, `title`, or the brand. */
  title: string;
  /** Levels below the tab's root (0 on a tab's root screen). */
  depth: number;
  /** Where Back goes: the nearest ancestor screen; absent at depth 0. */
  back?: { href: string; label: string };
}

function trail(items: readonly ResolvedNavItem[]): ResolvedNavItem[] {
  const out: ResolvedNavItem[] = [];
  let level: readonly ResolvedNavItem[] = items;
  for (;;) {
    const next = level.find((item) => item.inTrail);
    if (!next) return out;
    out.push(next);
    level = next.children;
  }
}

/**
 * The stacked-navigation header for `currentPath`. The trail of matching nav
 * items gives the stack; a path deeper than the deepest item (a detail
 * screen such as `#/deals/42` under `#/deals`) adds one level whose title
 * comes from `title` (the app's screen title) when given. Back always goes to
 * the nearest ancestor that is a real screen.
 */
export function stackHeader(
  sections: readonly ResolvedNavSection[],
  currentPath: string,
  fallbackTitle: string,
  title?: string
): StackHeader {
  const path = navPath(currentPath);
  const items = trail(topLevelItems(sections));
  const deepest = items[items.length - 1];
  if (!deepest) return { title: title || fallbackTitle, depth: 0 };
  const atItem = navPath(deepest.href) === path;
  if (atItem) {
    const parent = items[items.length - 2];
    return {
      title: deepest.label,
      depth: items.length - 1,
      ...(parent ? { back: { href: parent.href, label: parent.label } } : {}),
    };
  }
  // Deeper than any nav item: a detail screen below the deepest match, so
  // Back returns to that item's screen.
  return {
    title: title || deepest.label,
    depth: items.length,
    back: { href: deepest.href, label: deepest.label },
  };
}

/**
 * `aria-current` of a nav link: `page` only when the link is the current
 * screen itself, `true` when the current screen is below it (a detail
 * screen, or a child item), nothing otherwise.
 */
export function navCurrent(
  item: ResolvedNavItem,
  currentPath: string
): 'page' | 'true' | undefined {
  if (item.active && navPath(item.href) === navPath(currentPath)) return 'page';
  return item.inTrail ? 'true' : undefined;
}

/** The current hash path, read only when called (never at import). */
export function currentHashPath(node?: Node | null): string {
  const win =
    node?.ownerDocument?.defaultView ?? (typeof window !== 'undefined' ? window : undefined);
  try {
    return navPath(win?.location.hash || '#/');
  } catch {
    return '/';
  }
}
