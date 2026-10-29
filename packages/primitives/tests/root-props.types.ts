/**
 * Compile-time contract for the discriminated root props of Accordion and
 * Slider (checked by the package typecheck, not run by vitest). A consumer's
 * type checker evaluates `keyof` of these unions whenever it checks a
 * `Component<Props, Record<string, never>, Bindings>` declaration (the bindings must extend
 * `keyof Props`). When each member flattened the native attributes into its
 * own interface, that `keyof` crossed two unions of several hundred keys and
 * failed with TS2590 ("union type that is too complex to represent") in the
 * packed `accordion/index.d.ts` and `slider/index.d.ts`.
 */
import type { Component } from 'svelte';
import type {
  AccordionMultipleRootProps,
  AccordionRootProps,
  AccordionSingleRootProps,
} from '../src/accordion/index.ts';
import type {
  SliderMultipleRootProps,
  SliderRootProps,
  SliderSingleRootProps,
} from '../src/slider/index.ts';

export type AccordionRootKey = keyof AccordionRootProps;
export type SliderRootKey = keyof SliderRootProps;

export declare const AccordionRootComponent: Component<
  AccordionRootProps,
  Record<string, never>,
  'ref' | 'value'
>;
export declare const SliderRootComponent: Component<
  SliderRootProps,
  Record<string, never>,
  'ref' | 'value'
>;

export const accordionKeys: AccordionRootKey[] = ['type', 'value', 'ref', 'class', 'data-state'];
export const sliderKeys: SliderRootKey[] = ['value', 'min', 'max', 'ref', 'class', 'data-x'];

export const single: AccordionSingleRootProps = {
  type: 'single',
  value: 'a',
  collapsible: false,
  onValueChange: (next: string) => void next,
  'aria-label': 'FAQ',
};
export const multiple: AccordionMultipleRootProps = {
  type: 'multiple',
  value: ['a', 'b'],
  onValueChange: (next: string[]) => void next,
};
// @ts-expect-error a single accordion holds one value
export const wrongValue: AccordionRootProps = { type: 'single', value: ['a'] };
// @ts-expect-error only a single accordion can be collapsible
export const wrongCollapsible: AccordionRootProps = { type: 'multiple', collapsible: true };

export const sliderSingle: SliderSingleRootProps = {
  value: 40,
  onValueCommit: (v: number) => void v,
};
export const sliderMultiple: SliderMultipleRootProps = { type: 'multiple', value: [10, 90] };
// @ts-expect-error a multiple slider holds an array
export const wrongSlider: SliderRootProps = { type: 'multiple', value: 10 };
// @ts-expect-error the root owns `dir` as 'ltr' | 'rtl'
export const wrongDir: SliderRootProps = { dir: 'auto' };
