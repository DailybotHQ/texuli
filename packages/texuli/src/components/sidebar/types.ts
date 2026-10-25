import type { IconComponent } from '../icons/types.ts';

/**
 * App navigation item for Sidebar / AppNav.
 * `href` is filtered with `safeHref` before rendering.
 */
/**
 * Nested navigation entry, one level under a `SidebarItem`. Rendered as an
 * indented list when the sidebar is expanded; hidden on the collapsed rail
 * (the parent's tooltip stands in). Deeper nesting is not supported.
 */
export type SidebarChildItem = Omit<SidebarItem, 'children'> & {
  children?: never;
};

export type SidebarItem = {
  /** Stable key; defaults to `href + label`. */
  id?: string;
  label: string;
  href?: string;
  /** Marks the current page (`aria-current="page"`). */
  active?: boolean;
  /**
   * Finer current state: `page` is the current page (`aria-current="page"`);
   * `section` means the current page is below this item (`aria-current="true"`),
   * for docs navigation where `/components/button/` sits under `/components/`.
   * Either one draws the item as active. Overrides `active` when set.
   */
  current?: 'page' | 'section';
  /** Count or status chip; collapsed mode shows a dot + sr-only text. */
  badge?: string | number;
  disabled?: boolean;
  /** Two-letter fallback when collapsed and no icon snippet is provided. */
  shortLabel?: string;
  /**
   * Built-in nav icon name (string) or a Svelte icon component. Layouts pass this
   * through `itemIcon` so AppNav/Sidebar can render glyphs instead of initials.
   */
  icon?: string | IconComponent;
  /** One level of nested entries under this item (indented when expanded). */
  children?: readonly SidebarChildItem[];
};

export type SidebarSection = {
  /** Optional heading; hidden (replaced by a rule) when collapsed. */
  label?: string;
  items: readonly SidebarItem[];
};
