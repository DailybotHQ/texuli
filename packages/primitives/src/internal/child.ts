import type { Snippet } from 'svelte';

/** Props supplied to a child snippet so it can render the primitive's trigger node. */
export interface ChildSnippetArgs<Props extends Record<string, unknown>> {
  props: Props;
}

/** A Svelte snippet that renders the trigger and spreads the supplied props on its root. */
export type ChildSnippet<Props extends Record<string, unknown>> = Snippet<
  [ChildSnippetArgs<Props>]
>;

type Props = Record<string, unknown>;
type EventHandler = (...args: unknown[]) => unknown;

function isEventHandler(key: string, value: unknown): value is EventHandler {
  return /^on[a-z]/.test(key) && typeof value === 'function';
}

function isPrevented(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'defaultPrevented' in value &&
    value.defaultPrevented === true
  );
}

/**
 * Merge trigger behavior into child props. Consumer handlers run first and may
 * prevent primitive behavior; state and accessibility attributes stay owned by
 * the primitive. Classes are concatenated in primitive-then-consumer order.
 */
export function composeChildProps<Base extends Props, Child extends Partial<Base>>(
  base: Base,
  child: Child
): Base & Child {
  const merged: Props = { ...base, ...child };
  const baseClass = typeof base.class === 'string' ? base.class : '';
  const childClass = typeof child.class === 'string' ? child.class : '';
  if (baseClass || childClass) merged.class = `${baseClass} ${childClass}`.trim();

  for (const key of Object.keys(base)) {
    const baseHandler = base[key];
    const childHandler = child[key];
    if (!isEventHandler(key, baseHandler) || !isEventHandler(key, childHandler)) continue;
    merged[key] = ((...args: unknown[]) => {
      childHandler(...args);
      if (!isPrevented(args[0])) baseHandler(...args);
    }) as EventHandler;
  }

  for (const key of [
    'data-state',
    'data-disabled',
    'aria-expanded',
    'aria-haspopup',
    'aria-controls',
  ]) {
    if (key in base) merged[key] = base[key];
  }
  return merged as Base & Child;
}
