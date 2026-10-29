import type { Snippet } from 'svelte';
import type { HTMLAttributes, HTMLButtonAttributes, HTMLInputAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { TagsInputLabels } from './labels.ts';
import type { TagRejection } from './tags.ts';

type Part<Attributes> = Omit<Attributes, 'children'> & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
  ref?: HTMLElement | null;
};

export interface TagsInputInvalidDetail {
  tag: string;
  reason: TagRejection;
  message?: string;
}

export interface TagsInputRootProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The tags. Bindable. */
  value?: string[];
  onValueChange?: (value: string[]) => void;
  /** Called for every tag that is refused, with the reason. */
  onInvalid?: (detail: TagsInputInvalidDetail) => void;
  /** Splits typed and pasted text. A one-character string also adds a tag when typed. Default `,`. */
  delimiter?: string | RegExp;
  /** Split pasted text into tags. Default `true`. */
  addOnPaste?: boolean;
  /** Add the typed text when the input loses focus. Default `false`. */
  addOnBlur?: boolean;
  allowDuplicates?: boolean;
  max?: number;
  /** Return `false` or a message to refuse a tag. */
  validate?: (tag: string, tags: readonly string[]) => boolean | string;
  disabled?: boolean;
  /** Submit one field per tag under this name. */
  name?: string;
  form?: string;
  /** At least one tag is needed before the form submits. */
  required?: boolean;
  labels?: Partial<TagsInputLabels>;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet<[{ tags: string[] }]>;
  ref?: HTMLElement | null;
}

export type TagsInputListProps = Part<HTMLAttributes<HTMLUListElement>>;

export interface TagsInputTagProps extends Part<HTMLAttributes<HTMLLIElement>> {
  index: number;
}

export interface TagsInputTagRemoveProps extends Part<HTMLButtonAttributes> {
  index: number;
}

export type TagsInputInputProps = Omit<Part<HTMLInputAttributes>, 'value'> & {
  /** The draft text (bindable). Cleared when the typed text becomes tags. */
  value?: string;
  /** Called with each draft change the input makes (typing, clearing). */
  onValueChange?: (value: string) => void;
};
