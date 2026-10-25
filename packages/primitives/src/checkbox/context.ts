import { getContext, setContext } from 'svelte';

const GROUP_KEY = Symbol('texuli.checkbox.group');

export type CheckedState = boolean | 'indeterminate';

export interface CheckboxGroupContext {
  readonly name: string | undefined;
  readonly disabled: boolean;
  readonly required: boolean;
  isChecked: (value: string) => boolean;
  toggle: (value: string) => void;
}

export function setCheckboxGroupContext(context: CheckboxGroupContext): void {
  setContext(GROUP_KEY, context);
}

export function getCheckboxGroupContext(): CheckboxGroupContext | undefined {
  return getContext<CheckboxGroupContext | undefined>(GROUP_KEY);
}
