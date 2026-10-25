import type { IconComponent } from '../../components/icons/types.ts';

/**
 * Navigation every layout renders: data, not markup, so one definition works
 * in a sidebar, rail, top bar, tab bar or drawer.
 */

/**
 * Lucide-style names a nav model can use. Layouts map them through `NavIcon`
 * or pass a Svelte icon component directly.
 */
export type NavIconName =
  | 'activity'
  | 'archive'
  | 'bell'
  | 'book-open'
  | 'bot'
  | 'briefcase'
  | 'building'
  | 'calendar'
  | 'chart-column'
  | 'chart-line'
  | 'chart-pie'
  | 'check-square'
  | 'clock'
  | 'code'
  | 'credit-card'
  | 'database'
  | 'file-text'
  | 'folder'
  | 'folder-kanban'
  | 'globe'
  | 'graduation-cap'
  | 'heart'
  | 'help'
  | 'home'
  | 'inbox'
  | 'kanban'
  | 'key'
  | 'layers'
  | 'layout-dashboard'
  | 'life-buoy'
  | 'list-todo'
  | 'mail'
  | 'map'
  | 'map-pin'
  | 'megaphone'
  | 'message-square'
  | 'package'
  | 'plug'
  | 'plus'
  | 'receipt'
  | 'search'
  | 'settings'
  | 'shield'
  | 'shopping-cart'
  | 'sparkles'
  | 'star'
  | 'store'
  | 'tag'
  | 'truck'
  | 'user'
  | 'users'
  | 'wallet'
  | 'workflow';

/** An icon by name (data-friendly) or any Lucide-compatible component. */
export type NavIconRef = NavIconName | IconComponent;

/** A badge value, or a getter so a live count stays current when read in markup. */
export type NavBadge = string | number | (() => string | number | undefined);

export type NavModelItem = {
  id: string;
  label: string;
  /** Hash or path href, e.g. `#/deals`. */
  href: string;
  icon?: NavIconRef;
  badge?: NavBadge;
  /** Only the exact path counts as active (`#/` always behaves this way). */
  exact?: boolean;
  children?: readonly NavModelItem[];
};

export type NavSection = {
  id: string;
  label?: string;
  items: readonly NavModelItem[];
};

export type NavAction = {
  id: string;
  label: string;
  icon?: NavIconRef;
  href?: string;
  onSelect?: () => unknown;
};

export type NavUser = {
  name: string;
  detail?: string;
  href?: string;
  image?: { src?: string | null; srcset?: string | null };
};

export type NavModel = {
  brand?: { label: string; href?: string; icon?: NavIconRef };
  sections: readonly NavSection[];
  actions?: readonly NavAction[];
  user?: NavUser;
};

export type ResolvedNavItem = Omit<NavModelItem, 'children'> & {
  active: boolean;
  inTrail: boolean;
  children: readonly ResolvedNavItem[];
};

export type ResolvedNavSection = Omit<NavSection, 'items'> & {
  items: readonly ResolvedNavItem[];
};

/** Normalize a hash or path: leading `/`, no trailing `/`, no `#` or query. */
export function navPath(hrefOrHash: string): string {
  let path = hrefOrHash.trim();
  if (path.startsWith('#')) path = path.slice(1);
  const query = path.indexOf('?');
  if (query !== -1) path = path.slice(0, query);
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** Active when the path matches exactly or is a descendant; `/` and `exact` match only exactly. */
export function isNavPathActive(href: string, currentPath: string, exact = false): boolean {
  const target = navPath(href);
  const current = navPath(currentPath);
  if (exact || target === '/') return current === target;
  return current === target || current.startsWith(`${target}/`);
}

export function navBadge(badge: NavBadge | undefined): string | number | undefined {
  return typeof badge === 'function' ? badge() : badge;
}

function flatten(items: readonly NavModelItem[]): NavModelItem[] {
  return items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}

/**
 * Marks the current page for `currentPath`. When several items match, the
 * deepest path wins so exactly one item is `active`; parents are `inTrail`.
 */
export function resolveNav(model: NavModel, currentPath: string): ResolvedNavSection[] {
  let best: NavModelItem | undefined;
  let bestLength = -1;
  for (const item of model.sections.flatMap((section) => flatten(section.items))) {
    if (!isNavPathActive(item.href, currentPath, item.exact)) continue;
    const length = navPath(item.href).length;
    if (length > bestLength) {
      best = item;
      bestLength = length;
    }
  }
  const resolve = (item: NavModelItem): ResolvedNavItem => {
    const children = (item.children ?? []).map(resolve);
    const active = item === best;
    return {
      ...item,
      active,
      inTrail: active || children.some((child) => child.inTrail),
      children,
    };
  };
  return model.sections.map((section) => ({ ...section, items: section.items.map(resolve) }));
}
