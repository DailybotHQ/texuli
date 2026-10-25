import type { SidebarSection } from '../../components/sidebar/types.ts';
import { navBadge, navPath, type ResolvedNavSection } from '../host/nav-model.ts';

/**
 * Read the current hash path only after component setup, so SSR starts at a
 * stable root path and browser globals are never accessed during import.
 */
export function currentHashPath(): string {
  try {
    if (typeof location === 'undefined') return '/';
    return navPath(location.hash || '/');
  } catch {
    return '/';
  }
}

/** Convert navigation data to the Sidebar's smaller, data-only item contract. */
export function appSidebarSections(sections: readonly ResolvedNavSection[]): SidebarSection[] {
  return sections.map((section) => ({
    label: section.label,
    items: section.items.map((item) => {
      const badge = navBadge(item.badge);
      return {
        id: item.id,
        label: item.label,
        href: item.href,
        active: item.active || item.inTrail,
        ...(item.icon === undefined ? {} : { icon: item.icon }),
        ...(badge === undefined ? {} : { badge }),
      };
    }),
  }));
}
