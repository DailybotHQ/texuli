/**
 * The message runtime (ADR-016). An `I18n` holds the catalogs of the
 * locales it has loaded, loads a locale lazily the first time it becomes
 * active (`registerLocale(locale, () => import('./pt-BR.ts'))`), and
 * resolves an id against the active locale, then its base language
 * (`pt-BR` → `pt`), then the English default the component passes. It is
 * framework-free: components read it from context (`I18N_CONTEXT`) and
 * re-read their labels when `subscribe` reports a change.
 */
import { type CatalogIssue, LOCALE_TAG, type MessageCatalog, parseCatalog } from './catalog.ts';
import {
  fillPlaceholders,
  formatMessage,
  interpolate,
  type Message,
  type MessageValues,
} from './format.ts';
import { pseudoLocalize } from './pseudo.ts';

/** What a lazy locale loader resolves to: a catalog, or a module whose default export is one. */
export type LocaleLoader = () => Promise<MessageCatalog | { default: MessageCatalog }>;

/** The context key components read an `I18n` from (`setContext(I18N_CONTEXT, i18n)`); one per realm. */
export const I18N_CONTEXT: unique symbol = Symbol.for('texuli.i18n') as never;

/** The pseudo-locale (`en-XA`): every resolved string is accented and bracketed, so unlocalized text stands out. */
export const PSEUDO_LOCALE = 'en-XA';

export interface I18nOptions {
  /** The active locale. Default `en`. */
  locale?: string;
  /** Catalogs available at once (no loading). */
  catalogs?: readonly MessageCatalog[];
  /** Lazy loaders by locale; only the active locale loads. */
  loaders?: Readonly<Record<string, LocaleLoader>>;
  /** Called with the issues of a loaded catalog that `parseCatalog` reported, or a load failure. */
  onIssues?: (locale: string, issues: readonly CatalogIssue[]) => void;
}

/** Resolve a message id to text. */
export type Translate = (id: string, english: Message, values?: MessageValues) => string;

export interface I18n {
  /** The active locale. Changes only once its catalog is loaded. */
  readonly locale: string;
  /** Bumped on every change (locale switch, catalog added); handy as a reactive key. */
  readonly version: number;
  /** Resolve `id` (active locale, then base language), else format `english`. */
  t: Translate;
  /** Whether the active locale (or its base language) has `id`. */
  has(id: string): boolean;
  /** Load (if needed) and activate `locale`. Resolves `false` when it could not load (the locale stays). */
  setLocale(locale: string): Promise<boolean>;
  /** Register a lazy loader. Loading happens when the locale becomes active. */
  registerLocale(locale: string, loader: LocaleLoader): void;
  /** Add or merge a catalog (checked with `parseCatalog`); returns its issues. */
  addCatalog(catalog: MessageCatalog | unknown): readonly CatalogIssue[];
  /** Listen for changes; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/** The base language of a tag: `pt-BR` → `pt`; `undefined` for a bare language. */
function baseLanguage(locale: string): string | undefined {
  const dash = locale.indexOf('-');
  return dash > 0 ? locale.slice(0, dash) : undefined;
}

function normalizeLocale(locale: string): string {
  return LOCALE_TAG.test(locale) ? locale : 'en';
}

/** Create a message runtime. Never throws on bad catalogs; bad messages are dropped with issues. */
export function createI18n(options: I18nOptions = {}): I18n {
  const catalogs = new Map<string, Record<string, Message>>();
  const loaders = new Map<string, LocaleLoader>(Object.entries(options.loaders ?? {}));
  const loading = new Map<string, Promise<boolean>>();
  const listeners = new Set<() => void>();
  let locale = normalizeLocale(options.locale ?? 'en');
  let version = 0;
  let request = 0;

  const notify = () => {
    version += 1;
    for (const listener of [...listeners]) listener();
  };

  const add = (input: unknown, silent: boolean): readonly CatalogIssue[] => {
    const parsed = parseCatalog(input);
    if (!parsed.catalog) return parsed.issues;
    const target = catalogs.get(parsed.catalog.locale) ?? Object.create(null);
    Object.assign(target, parsed.catalog.messages);
    catalogs.set(parsed.catalog.locale, target);
    if (!silent) notify();
    return parsed.issues;
  };

  for (const catalog of options.catalogs ?? []) {
    const issues = add(catalog, true);
    if (issues.length > 0) options.onIssues?.((catalog as MessageCatalog).locale ?? '', issues);
  }

  const lookup = (id: string): Message | undefined => {
    const own = catalogs.get(locale);
    if (own && Object.hasOwn(own, id)) return own[id];
    const base = baseLanguage(locale);
    const parent = base ? catalogs.get(base) : undefined;
    return parent && Object.hasOwn(parent, id) ? parent[id] : undefined;
  };

  const load = (tag: string): Promise<boolean> => {
    if (catalogs.has(tag) || tag === PSEUDO_LOCALE) return Promise.resolve(true);
    const pending = loading.get(tag);
    if (pending) return pending;
    const loader = loaders.get(tag);
    if (!loader) return Promise.resolve(false);
    const promise = Promise.resolve()
      .then(loader)
      .then((module) => {
        const catalog =
          module && typeof module === 'object' && 'default' in module ? module.default : module;
        const issues = add(
          catalog && typeof catalog === 'object' ? { ...catalog, locale: tag } : catalog,
          true
        );
        if (issues.length > 0) options.onIssues?.(tag, issues);
        return catalogs.has(tag);
      })
      .catch((error: unknown) => {
        options.onIssues?.(tag, [
          { id: '', message: error instanceof Error ? error.message : 'the locale failed to load' },
        ]);
        return false;
      })
      .finally(() => loading.delete(tag));
    loading.set(tag, promise);
    return promise;
  };

  const i18n: I18n = {
    get locale() {
      return locale;
    },
    get version() {
      return version;
    },
    t(id, english, values) {
      const found = lookup(id);
      const text = formatMessage(found ?? english, values, locale);
      return locale === PSEUDO_LOCALE ? pseudoLocalize(text) : text;
    },
    has(id) {
      return lookup(id) !== undefined;
    },
    async setLocale(next) {
      if (!LOCALE_TAG.test(next)) return false;
      const ticket = ++request;
      const base = baseLanguage(next);
      const [own, parent] = await Promise.all([load(next), base ? load(base) : false]);
      // A later call wins. A locale with neither its own nor a base catalog
      // activates only when it is English (the defaults are English).
      if (ticket !== request) return false;
      if (!own && !parent && next !== 'en' && base !== 'en') return false;
      if (locale !== next) {
        locale = next;
        notify();
      }
      return true;
    },
    registerLocale(tag, loader) {
      if (!LOCALE_TAG.test(tag) || typeof loader !== 'function') return;
      loaders.set(tag, loader);
    },
    addCatalog(catalog) {
      return add(catalog, false);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  // A loader registered for the starting locale loads right away.
  if (!catalogs.has(locale) && loaders.has(locale)) {
    void load(locale).then((ok) => {
      if (ok) notify();
    });
  }
  return i18n;
}

/**
 * The resolution order for one label (ADR-016): the instance prop when the
 * caller set one, then the catalog from context, then the English default.
 */
export function resolveLabel(
  instance: string | null | undefined,
  i18n: Pick<I18n, 't'> | null | undefined,
  id: string,
  english: Message,
  values?: MessageValues
): string {
  if (typeof instance === 'string') return values ? interpolate(instance, values) : instance;
  if (i18n) return i18n.t(id, english, values);
  return formatMessage(english, values);
}

/** The English-only `Translate`: what components use with no `I18n` in context. */
export const englishMessages: Translate = (_id, english, values) =>
  fillPlaceholders(typeof english === 'string' ? english : english.other, values);

/** A `Translate` that can also tell whether the catalog has an id (what components get from context). */
export type MessageLookup = Translate & { has?: (id: string) => boolean };

/** `pageLabel` → `page-label`: the id segment of a label key. */
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/**
 * Resolve a component's English label object through the catalog: every
 * string label becomes `messages(`${prefix}.${kebab(key)}`, english)`. A
 * function label (`remove: (tag) => …`) stays as is unless the catalog has
 * its id, whose message then receives the arguments as `{0}`, `{1}`…
 * Callers spread their instance overrides on top (the instance prop wins).
 */
export function localizeLabels<T extends object>(
  messages: MessageLookup,
  prefix: string,
  defaults: T
): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(defaults)) {
    const id = `${prefix}.${kebab(key)}`;
    if (typeof value === 'string') out[key] = messages(id, value);
    else if (typeof value === 'function' && messages.has?.(id)) {
      out[key] = (...args: unknown[]) =>
        messages(
          id,
          '',
          Object.fromEntries(args.map((arg, index) => [String(index), arg as string]))
        );
    } else out[key] = value;
  }
  return out as T;
}
