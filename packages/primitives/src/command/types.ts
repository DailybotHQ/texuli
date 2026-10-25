import type { HTMLInputAttributes } from 'svelte/elements';

export type CommandSearch = (query: string) => void | Promise<void>;

/** Attributes the input part sets itself, so they are not props. */
export type CommandInputOwnedAttribute =
  | 'value'
  | 'oninput'
  | 'onkeydown'
  | 'role'
  | 'autocomplete'
  | 'aria-autocomplete'
  | 'aria-expanded'
  | 'aria-controls'
  | 'aria-activedescendant'
  | 'children';

/**
 * `Command.Input` props: every native input attribute except the ones the
 * part owns, plus the query value.
 */
export type CommandInputProps = Omit<HTMLInputAttributes, CommandInputOwnedAttribute> & {
  value?: string;
  onValueChange?: (value: string) => void;
};
