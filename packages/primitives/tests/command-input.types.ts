/**
 * Compile-time contract for `Command.Input` props (checked by the package
 * typecheck, not run by vitest): native input attributes are typed; the
 * attributes the part owns are rejected.
 */
import type { CommandInputProps } from '../src/command/index.ts';

export const typed: CommandInputProps = {
  maxlength: 80,
  minlength: 2,
  placeholder: 'Search…',
  spellcheck: false,
  inputmode: 'search',
  enterkeyhint: 'search',
  name: 'q',
  'aria-label': 'Search commands',
  value: 'open',
  onValueChange: (next: string) => void next,
};

// @ts-expect-error the part sets role="combobox" itself
export const ownedRole: CommandInputProps = { role: 'textbox' };
// @ts-expect-error the part owns aria-activedescendant
export const ownedActive: CommandInputProps = { 'aria-activedescendant': 'x' };
// @ts-expect-error the part handles input itself; use onValueChange
export const ownedInput: CommandInputProps = { oninput: () => {} };
// @ts-expect-error maxlength is a number
export const wrongType: CommandInputProps = { maxlength: 'eighty' };
