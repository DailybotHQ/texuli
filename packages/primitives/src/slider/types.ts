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

interface RootShared extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'dir'> {
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

export interface SliderSingleRootProps extends RootShared {
  type?: 'single';
  /** Bindable. Defaults to `min`. */
  value?: number;
  onValueChange?: (value: number) => void;
  /** After a keyboard change, and when a pointer drag ends. */
  onValueCommit?: (value: number) => void;
}

export interface SliderMultipleRootProps extends RootShared {
  type: 'multiple';
  /** Bindable, ascending. Defaults to `[min]`. */
  value?: number[];
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
}

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
