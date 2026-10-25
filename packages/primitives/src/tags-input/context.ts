import { createPrimitiveContext } from '../internal/context.ts';
import type { TagsInputLabels } from './labels.ts';

export interface TagsInputContext {
  readonly tags: readonly string[];
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly labels: TagsInputLabels;
  /** The one-character delimiter that adds a tag when typed, if any. */
  readonly delimiterKey: string | undefined;
  readonly addOnPaste: boolean;
  readonly addOnBlur: boolean;
  /** Adds the tags in `text`; returns whether the text was used up. */
  add(text: string): boolean;
  /** Removes a tag, then moves focus: to a neighbor tag or the input. */
  remove(index: number, focus: 'previous' | 'next' | 'input'): void;
  focusTag(index: number): void;
  focusInput(): void;
  setInput(node: HTMLInputElement | null): void;
  clearInvalid(): void;
  /** What the form-bridge field reflects: `required`, `disabled`, `form` and whether there are tags. */
  readonly constraint: {
    required: boolean;
    disabled: boolean;
    form: string | undefined;
    filled: boolean;
  };
  /** Restores the starting tags (after a form reset). */
  resetTags(): void;
}

export const tagsInputContext = createPrimitiveContext<TagsInputContext>('TagsInput.Root');

/** Visually hidden, still read by screen readers; set through CSSOM so a strict CSP allows it. */
export function visuallyHidden(node: HTMLElement): void {
  node.style.cssText =
    'position:absolute;inline-size:1px;block-size:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0';
}

/** Whether `node` reads right to left: its nearest `dir` attribute, else its computed direction. */
export function isRtl(node: Element): boolean {
  const attribute = node.closest('[dir]')?.getAttribute('dir');
  if (attribute === 'rtl' || attribute === 'ltr') return attribute === 'rtl';
  return node.ownerDocument.defaultView?.getComputedStyle(node).direction === 'rtl';
}
