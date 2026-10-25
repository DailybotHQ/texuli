import { getContext, setContext } from 'svelte';

/**
 * What the parts of one table share. `stacked` is true when the table can
 * stack into cards: CSS `display` changes drop native table semantics in some
 * browsers, so the parts then state their roles explicitly.
 */
export interface TableContext {
  readonly stacked: boolean;
  /** The caption registers its id so a scrollable table can be named by it. */
  setCaptionId(id: string | undefined): void;
}

const KEY = Symbol('tx-table');

export function setTableContext(context: TableContext): void {
  setContext(KEY, context);
}

/** The enclosing table's context, or `undefined` when a part is used alone. */
export function getTableContext(): TableContext | undefined {
  return getContext<TableContext | undefined>(KEY);
}

/** The explicit role a part takes when its table can stack, else `undefined`. */
export function stackedRole(context: TableContext | undefined, role: string): string | undefined {
  return context?.stacked ? role : undefined;
}
