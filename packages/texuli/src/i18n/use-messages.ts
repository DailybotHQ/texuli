/**
 * Component labels through `@texuli/core/i18n` (ADR-016). A host puts one
 * `I18n` in context with `setI18nContext`; every component label then
 * resolves instance prop → that catalog → its English default, and updates
 * when the locale changes (lazy locales included).
 */
import { englishMessages, I18N_CONTEXT, type I18n, type MessageLookup } from '@texuli/core/i18n';
import { getContext, hasContext, setContext } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';

/** Put `i18n` in context for every Texuli component below (call in a component's script). */
export function setI18nContext(i18n: I18n): I18n {
  setContext(I18N_CONTEXT, i18n);
  return i18n;
}

/** The `I18n` in context, if any. */
export function getI18nContext(): I18n | undefined {
  return hasContext(I18N_CONTEXT) ? getContext<I18n | undefined>(I18N_CONTEXT) : undefined;
}

/**
 * The message lookup for a component: reactive inside `$derived` and
 * markup (it re-runs when the locale or catalogs change); English only
 * when no `I18n` is in context. Call during component initialization.
 */
export function useMessages(): MessageLookup {
  const i18n = getContext<I18n | undefined>(I18N_CONTEXT);
  if (!i18n) return englishMessages;
  const track = createSubscriber((update) => i18n.subscribe(update));
  const lookup: MessageLookup = (id, english, values) => {
    track();
    return i18n.t(id, english, values);
  };
  lookup.has = (id) => {
    track();
    return i18n.has(id);
  };
  return lookup;
}
