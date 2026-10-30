/**
 * @texuli/core/i18n: message catalogs, lazy locales and label resolution
 * (ADR-016). Framework-free; components read an `I18n` from context.
 */
export {
  CATALOG_LIMITS,
  type CatalogIssue,
  type CatalogParse,
  checkMessage,
  LOCALE_TAG,
  MESSAGE_ID,
  type MessageCatalog,
  type MessageCheck,
  parseCatalog,
} from './catalog.ts';
export {
  fillPlaceholders,
  formatMessage,
  interpolate,
  type Message,
  type MessageValues,
  type PluralMessage,
  type SelectMessage,
} from './format.ts';
export {
  createI18n,
  englishMessages,
  I18N_CONTEXT,
  type I18n,
  type I18nOptions,
  type LocaleLoader,
  localizeLabels,
  type MessageLookup,
  PSEUDO_LOCALE,
  resolveLabel,
  type Translate,
} from './i18n.ts';
export { isPseudoLocalized, pseudoLocalize } from './pseudo.ts';
