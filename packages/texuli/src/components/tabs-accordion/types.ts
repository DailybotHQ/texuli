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
  /** A decorative icon before the label: a built-in name or a Svelte SVG component. */
  icon?: IconRef;
};
