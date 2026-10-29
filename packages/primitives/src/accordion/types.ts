import type { Snippet } from 'svelte';
import type { HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/index.ts';

export type AccordionType = 'single' | 'multiple';
export type AccordionOrientation = 'vertical' | 'horizontal';
export type AccordionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type Base<Attributes> = Omit<Attributes, 'children'> & {
  /** Render your own element: spread `props` on its root. */
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

/** The root's own shared props; the native attributes stay a separate constituent. */
interface RootOwn {
  /** Disable every item. */
  disabled?: boolean;
  /** Which arrow keys move between triggers. Default `vertical`. */
  orientation?: AccordionOrientation;
  /** Arrow keys wrap from the last trigger to the first. Default `true`. */
  loop?: boolean;
  /** Text direction for horizontal arrows. Default: the root's resolved `dir`. */
  dir?: 'ltr' | 'rtl';
  ref?: HTMLElement | null;
}

/**
 * Why the members are written as `RootShared & { … }` with an inline object
 * type (T-std-consumers): a consumer's checker evaluates `keyof` of this union
 * for the component's bindings (`Component<Props, {}, 'ref' | 'value'>`), which
 * is the intersection of each member's key union. Those unions hold several
 * hundred native attribute keys plus the `data-${string}` pattern, so unless
 * both members yield the very same union TypeScript multiplies them and fails
 * with TS2590 ("union type that is too complex to represent"). Interfaces, or
 * named aliases for the member-specific part, give each key union a distinct
 * origin and trigger it. Keep the inline parts and the same key set in both
 * members; `tests/root-props.types.ts` checks it.
 */
type RootShared = Base<HTMLAttributes<HTMLDivElement>> & RootOwn;

export type AccordionSingleRootProps = RootShared & {
  /** One item open at a time. */
  type: 'single';
  /** The open item's value, or `''` when none is open. Bindable. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Whether the open item can be closed again, leaving none open. Default `true`. */
  collapsible?: boolean;
};

export type AccordionMultipleRootProps = RootShared & {
  /** Any number of items open. */
  type: 'multiple';
  /** The open items' values. Bindable. */
  value?: string[];
  onValueChange?: (value: string[]) => void;
  collapsible?: never;
};

export type AccordionRootProps = AccordionSingleRootProps | AccordionMultipleRootProps;

export interface AccordionItemProps extends Base<HTMLAttributes<HTMLDivElement>> {
  /** Unique within the root. */
  value: string;
  disabled?: boolean;
  ref?: HTMLElement | null;
}

export interface AccordionHeaderProps extends Base<HTMLAttributes<HTMLHeadingElement>> {
  /** Heading level of the trigger's heading (APG). Default `3`. */
  level?: AccordionHeadingLevel;
  ref?: HTMLElement | null;
}

export interface AccordionTriggerProps extends Base<HTMLButtonAttributes> {
  ref?: HTMLElement | null;
}

export interface AccordionContentProps extends Base<HTMLAttributes<HTMLDivElement>> {
  /**
   * Keep the content in the DOM while closed (it gets `hidden`), for example
   * for find-in-page or a CSS-only animation. Default `false`.
   */
  forceMount?: boolean;
  ref?: HTMLElement | null;
}
