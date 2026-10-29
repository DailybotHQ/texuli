import type { IconRef } from '../icons/types.ts';

export type AccordionItemDef = {
  value: string;
  title: string;
  content?: string;
  disabled?: boolean;
};

export type TabItem = {
  value: string;
  label: string;
  disabled?: boolean;
  badge?: string | number;
  /**
   * The badge's words in the tab's accessible name ("3 unread"). Defaults to
   * the badge itself, so a count is announced with the label ("Members 12").
   */
  badgeLabel?: string;
  /** A decorative icon before the label: a built-in name or a Svelte SVG component. */
  icon?: IconRef;
};
