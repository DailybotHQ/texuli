/**
 * Component labels through `@texuli/core/i18n` (ADR-016). A host puts one
 * `I18n` in context with `setI18nContext`; every component label then
 * resolves instance prop → that catalog → its English default, and updates
 * when the locale changes (lazy locales included).
 */
import {
  createLabels,
  englishMessages,
  I18N_CONTEXT,
  type I18n,
  type LabelDictionary,
  type MessageLookup,
} from '@texuli/core/i18n';
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

/** Options for `setTexuliLabels`. */
export interface TexuliLabelsOptions {
  /** The dictionary's BCP 47 locale (`es`, `es-CO`): plural rules and number formatting. Default `en`. */
  locale?: string;
}

/**
 * Translate every built-in Texuli label below this component at once
 * (ADR-026): pass one dictionary of message ids (`TEXULI_MESSAGES_EN`,
 * `PRIMITIVES_MESSAGES_EN` and each domain package's catalog list them).
 * Precedence per label: the component's own prop, then this dictionary,
 * then the English default. Called inside another dictionary's scope, it
 * layers over it (its ids win, the rest fall through). Call it in a
 * component's script, near the root; it is SSR-safe (context only, no
 * globals). Returns the `I18n` it put in context.
 */
export function setTexuliLabels(labels: LabelDictionary, options: TexuliLabelsOptions = {}): I18n {
  return setI18nContext(
    createLabels(labels, {
      ...(options.locale ? { locale: options.locale } : {}),
      parent: getI18nContext() ?? null,
    })
  );
}
