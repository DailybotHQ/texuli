import { getContext, setContext } from 'svelte';

export const SELECT_GROUP_CONTEXT = Symbol('texuli.select.group');

export type SelectGroupContext = {
  readonly labelId: string;
  setLabelId(id: string): void;
};

export function setSelectGroupContext(context: SelectGroupContext): void {
  setContext(SELECT_GROUP_CONTEXT, context);
}

export function getSelectGroupContext(): SelectGroupContext | undefined {
  return getContext<SelectGroupContext | undefined>(SELECT_GROUP_CONTEXT);
}
