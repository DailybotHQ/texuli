import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';

export type SliderOrientation = 'horizontal' | 'vertical';

export interface SliderThumbItem {
  index: number;
  value: number;
}

export interface SliderTickItem {
  index: number;
  value: number;
}

/** What the root's `children` snippet receives, to render one thumb per value. */
export interface SliderRootSnippetProps {
  thumbItems: SliderThumbItem[];
  tickItems: SliderTickItem[];
}

/** The root's own shared props; the native attributes stay a separate constituent. */
interface RootOwn {
  min?: number;
  max?: number;
  /** Step between values. Default `1`. */
  step?: number;
  /** How far PageUp and PageDown move. Default `10 × step`. */
  largeStep?: number;
  /** Minimum gap between neighboring thumbs, in steps. Default `0`. */
  minStepsBetweenThumbs?: number;
  orientation?: SliderOrientation;
  /** Text direction for horizontal sliders. Default: the root's resolved direction. */
  dir?: 'ltr' | 'rtl';
  disabled?: boolean;
  /** Spoken value, for example "40 percent" or "$200". */
  getValueText?: (value: number, index: number) => string;
  /** Submit one field per thumb under this name. */
  name?: string;
  form?: string;
  required?: boolean;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet<[SliderRootSnippetProps]>;
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
type RootShared = Omit<HTMLAttributes<HTMLElement>, 'children' | 'dir'> & RootOwn;

export type SliderSingleRootProps = RootShared & {
  type?: 'single';
  /** Bindable. Defaults to `min`. */
  value?: number;
  onValueChange?: (value: number) => void;
  /** After a keyboard change, and when a pointer drag ends. */
  onValueCommit?: (value: number) => void;
};

export type SliderMultipleRootProps = RootShared & {
  type: 'multiple';
  /** Bindable, ascending. Defaults to `[min]`. */
  value?: number[];
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
};

export type SliderRootProps = SliderSingleRootProps | SliderMultipleRootProps;

type PartProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
  ref?: HTMLElement | null;
};

export type SliderRangeProps = PartProps;

export interface SliderThumbProps extends PartProps {
  /** Which value this thumb controls. Default `0`. */
  index?: number;
}

export interface SliderTickProps extends PartProps {
  index: number;
}
