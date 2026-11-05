/**
 * Label dictionaries (ADR-026): one flat `{ [messageId]: Message }` map a
 * host passes once, near the root, to translate every built-in label of
 * every Texuli package. Framework-free: the Svelte packages put the `I18n`
 * this builds in context (`setTexuliLabels`, `LabelsProvider`), and every
 * component resolves instance prop → this dictionary → its English default.
 */
import { LOCALE_TAG } from './catalog.ts';
import type { Message } from './format.ts';
import { createI18n, type I18n, type I18nOptions } from './i18n.ts';

/**
 * A label dictionary: message ids to messages, every id optional. Packages
 * export their id unions (`TexuliMessageId`, `BlocksMessageId`…) so a host
 * types its dictionary with `LabelDictionary<TexuliMessageId | BlocksMessageId>`.
 */
export type LabelDictionary<Id extends string = string> = { readonly [K in Id]?: Message };

/**
 * Merge dictionaries left to right (a later one wins per id). `undefined`
 * dictionaries and `undefined` values are skipped, so partial and
 * conditional dictionaries compose. The result is a fresh, frozen,
 * prototype-free object.
 */
export function mergeLabels<Id extends string>(
  ...dictionaries: readonly (LabelDictionary<Id> | null | undefined)[]
): LabelDictionary<Id> {
  const out: Record<string, Message> = Object.create(null);
  for (const dictionary of dictionaries) {
    if (!dictionary || typeof dictionary !== 'object') continue;
    for (const [id, message] of Object.entries(dictionary)) {
      if (message !== undefined && message !== null) out[id] = message as Message;
    }
  }
  return Object.freeze(out) as LabelDictionary<Id>;
}

/**
 * Stack two runtimes: an id `top` has resolves through `top`, any other
 * through `base`. The locale, `setLocale`, `registerLocale` and
 * `addCatalog` act on `top`; `subscribe` hears both. A nested provider uses
 * it so an inner dictionary overrides only the ids it sets.
 */
export function layerI18n(top: I18n, base: I18n): I18n {
  return {
    get locale() {
      return top.locale;
    },
    get version() {
      return top.version + base.version;
    },
    t(id, english, values) {
      return top.has(id) || !base.has(id)
        ? top.t(id, english, values)
        : base.t(id, english, values);
    },
    has(id) {
      return top.has(id) || base.has(id);
    },
    setLocale: (locale) => top.setLocale(locale),
    registerLocale: (locale, loader) => top.registerLocale(locale, loader),
    addCatalog: (catalog) => top.addCatalog(catalog),
    subscribe(listener) {
      const offTop = top.subscribe(listener);
      const offBase = base.subscribe(listener);
      return () => {
        offTop();
        offBase();
      };
    },
  };
}

export interface CreateLabelsOptions extends Pick<I18nOptions, 'onIssues'> {
  /**
   * The BCP 47 locale of the dictionary (`es`, `es-CO`), used for plural
   * rules and number formatting in messages. Default `en`; an invalid tag
   * falls back to `en`.
   */
  locale?: string;
  /** An outer runtime the dictionary layers over (its ids fill the gaps). */
  parent?: I18n | null;
}

/**
 * The runtime for one label dictionary: `createI18n` with the dictionary
 * as the catalog of `locale` (checked by `parseCatalog`; bad ids and
 * messages are dropped and reported through `onIssues`), layered over
 * `parent` when one is given.
 */
export function createLabels(
  labels: LabelDictionary | null | undefined,
  options: CreateLabelsOptions = {}
): I18n {
  const locale =
    typeof options.locale === 'string' && LOCALE_TAG.test(options.locale) ? options.locale : 'en';
  const own = createI18n({
    locale,
    catalogs: [{ locale, messages: { ...mergeLabels(labels) } as Record<string, Message> }],
    ...(options.onIssues ? { onIssues: options.onIssues } : {}),
  });
  return options.parent ? layerI18n(own, options.parent) : own;
}
