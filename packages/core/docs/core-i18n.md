# Core i18n

> **Status: unreleased, planned for 0.8.0** (ADR-016). English is the only
> language Texuli ships; translations beyond English are planned. Hosts
> can load their own catalogs today.

`@texuli/core/i18n` is the message catalog every component label resolves
through. It is framework-free: `texuli` and `@texuli/primitives` read an
`I18n` from Svelte context under `I18N_CONTEXT` and re-read their labels
when it changes. English defaults stay next to each component (so tree
shaking keeps working); the catalog only holds translations.

```ts
import { createI18n } from '@texuli/core/i18n';
import { setI18nContext } from 'texuli';

const i18n = createI18n({
  locale: 'en',
  loaders: { 'pt-BR': () => import('./locales/pt-BR.ts') }, // loads only when active
});
setI18nContext(i18n); // in the root component's script
await i18n.setLocale('pt-BR');
```

## Resolution order

For one label, `resolveLabel(instance, i18n, id, english, values)`:

1. the **instance prop** when the caller set one (`closeLabel="Shut"`, or a
   key of a `labels` or `messages` object): existing props keep working;
2. the **catalog from context**: the active locale, then its base language
   (`pt-BR`, then `pt`);
3. the **English default** the component passes.

`englishMessages` is the `Translate` function with no catalog (step 3 only).
Components get a `MessageLookup` (a `Translate` that can also answer
`has(id)`) from context.

Components with a label object (`labels` or `messages` props) resolve it
with `localizeLabels(lookup, prefix, defaults)`: every string label becomes
`lookup(`${prefix}.${key-in-kebab-case}`, english)`; a function label (such
as `remove: (tag) => …`) stays as is unless the catalog has its id, whose
message then receives the arguments as `{0}`, `{1}`… The caller spreads
the instance overrides on top, so they still win.

## Catalogs

A `MessageCatalog` is `{ locale, messages }`. Message ids are namespaced
(`MESSAGE_ID`: two to seven dot-separated segments, such as
`texuli.dialog.close` or `primitives.pagination.next`), and the locale is a
BCP 47 tag (`LOCALE_TAG`). A `Message` is one of:

- a string with `{name}` placeholders: `"Remove {label}"`;
- a `PluralMessage`: `{ "plural": "count", "=0": "No files", "one": "# file", "other": "# files" }`,
  chosen through `Intl.PluralRules` (exact `=n` cases first; `#` is the
  formatted count);
- a `SelectMessage`: `{ "select": "tone", "danger": "Danger", "other": "Notice" }`.

`MessageValues` are strings (inserted as is) and numbers (formatted for the
locale). Translation files are data from outside the app, so
`parseCatalog(input)` (a `CatalogParse` with `CatalogIssue`s) checks them:
every id, every message (`checkMessage`, a `MessageCheck`), prototype keys
and the caps in `CATALOG_LIMITS` (5,000 messages, 2,000 characters per
message, 16 cases). Bad messages are dropped with an issue; the rest load.

## Formatting

`formatMessage(message, values, locale)` and `interpolate(template,
values, locale)` make one left-to-right pass with no recursion: a value is
never scanned again, so a value containing `{name}` stays literal, and an
unknown or malformed placeholder stays as written. Placeholder names are
at most 64 characters, so runs of braces stay linear. The output is always
text: components render it as text, never as markup.
`fillPlaceholders(template, values)` is the small English-path formatter
behind `englishMessages`: `{name}` placeholders only, values inserted with
`String()` (no locale number formatting), one bounded regex pass. It keeps
the cost of a component with no catalog in context to a few hundred bytes.

## The runtime

`createI18n(options)` (`I18nOptions`: `locale`, `catalogs`, `loaders`,
`onIssues`) returns an `I18n`:

| Member | What it does |
| --- | --- |
| `locale`, `version` | The active locale (changes only once its catalog loaded) and a change counter |
| `t(id, english, values)` | A `Translate`: resolve `id`, else format `english` |
| `has(id)` | Whether the active locale or its base language has `id` |
| `setLocale(locale)` | Load (a `LocaleLoader`, once) and activate; resolves `false` when it could not load, and a later call wins over an earlier one still loading |
| `registerLocale(locale, loader)` | Register a lazy loader (`() => import(…)`; a module's `default` export works) |
| `addCatalog(catalog)` | Add or merge a catalog; returns its issues |
| `subscribe(listener)` | Change notifications; returns the unsubscribe function |

## Pseudo-locale

Activating `PSEUDO_LOCALE` (`en-XA`) passes every resolved string, catalog
or default, through `pseudoLocalize` (`⟦Çlósé⟧`): text that did not go
through the catalog stays plain English and stands out, and the longer
strings show clipping. `isPseudoLocalized(text)` checks the brackets; the
component packages' coverage tests use it.

## Native labels

The Kotlin twin reads the same catalog format (`TexuliMessages` in
`texuli-compose`, string messages only) with the same `{name}` rules;
`packages/core/tests/fixtures/i18n-vectors.json` holds the vectors both
targets are tested against.

## Relation to `resolveMessages`

`dir-locale`'s `DEFAULT_MESSAGES` and `resolveMessages` are an older flat
English label set; they keep working. Component labels resolve through
this catalog instead, with ids per component.
