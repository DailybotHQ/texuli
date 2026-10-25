import type { ChildSnippet } from '../internal/child.ts';

/** Props a Toggle root (or child snippet root) receives. */
export type ToggleRootAttrs = {
  type: 'button';
  role: 'button';
  'aria-pressed': boolean;
  'data-state': 'on' | 'off';
  'data-disabled'?: '';
  disabled: boolean | undefined;
  tabindex: number;
  onclick: (event: MouseEvent) => void;
  onkeydown: (event: KeyboardEvent) => void;
  onkeyup: (event: KeyboardEvent) => void;
  class?: string;
};

export type ToggleRootProps = {
  /** Controlled pressed state (`bind:pressed`). */
  pressed?: boolean;
  /** Uncontrolled initial pressed state. */
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  disabled?: boolean;
  /** When set, renders the child snippet instead of a default button. */
  child?: ChildSnippet<ToggleRootAttrs>;
  class?: string;
  children?: import('svelte').Snippet;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
};

export type ToggleGroupType = 'single' | 'multiple';
export type ToggleGroupOrientation = 'horizontal' | 'vertical';

export type ToggleGroupRootProps = {
  type?: ToggleGroupType;
  /** Controlled value: one string (single) or string[] (multiple). */
  value?: string | string[];
  /** Uncontrolled initial value. */
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  disabled?: boolean;
  loop?: boolean;
  orientation?: ToggleGroupOrientation;
  /** When true (default), arrow keys move focus between items. */
  rovingFocus?: boolean;
  class?: string;
  children?: import('svelte').Snippet;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

export type ToggleGroupItemAttrs = ToggleRootAttrs & {
  'data-roving-item'?: '';
  value: string;
};

export type ToggleGroupItemProps = {
  value: string;
  disabled?: boolean;
  child?: ChildSnippet<ToggleGroupItemAttrs>;
  class?: string;
  children?: import('svelte').Snippet;
  id?: string;
  'aria-label'?: string;
};
