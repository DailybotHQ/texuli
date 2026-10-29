/**
 * Static copy for /output-page/: the status, the pieces, the sections, the
 * rules and the docs of multi-target output (email, print and PDF, and the
 * i18n message catalog). Plain data, so the page and its tests share one
 * source (labels are text, never HTML).
 */

/** The release these targets are planned for. None is in the published 0.7.0. */
export const OUTPUT_RELEASE = '0.8.0';

export const OUTPUT_STATUS = `Unreleased, coming in ${OUTPUT_RELEASE}: not in the published 0.7.0.`;

export const OUTPUT_PIECES: readonly { readonly name: string; readonly role: string }[] = [
  { name: 'tools/email', role: 'email-safe HTML and plain text' },
  { name: 'tools/print', role: 'blueprint to document to PDF' },
  { name: 'player print mode', role: 'the static form the browser prints' },
  { name: 'core/i18n', role: 'the message catalog, lazy locales' },
];

export interface OutputSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
}

export const OUTPUT_SECTIONS: readonly OutputSection[] = [
  {
    id: 'email',
    title: 'Email from a blueprint',
    summary:
      'renderEmail validates a blueprint at the untrusted tier, then writes a complete email: tables and inline styles mail clients understand, every value escaped, links and images through the untrusted URL policy, and a plain-text part. Content with no email form falls back to its text with a warning; a draft with anything executable is refused whole.',
  },
  {
    id: 'print',
    title: 'Print and PDF',
    summary:
      'Two ways to print the same blueprint. In the browser the player has a print mode, a static paint with page-break rules for its frames, tables and code; the print dialog prints this whole page with the digest on it. Headless, @texuli/tools/print maps the blueprint to a validated document and the owned PDF writer draws it, with no JavaScript, forms or embedded files in the file.',
  },
  {
    id: 'i18n',
    title: 'Every label from one message catalog',
    summary:
      'Component labels resolve through @texuli/core/i18n: an instance prop first, then the catalog in context, then the English default next to the component. Locales load lazily, plurals and selects follow Intl, and catalogs from outside are validated. English is the only language Texuli ships; translations beyond English are planned, and hosts can load their own catalogs today.',
  },
  {
    id: 'safety',
    title: 'What keeps it safe',
    summary: 'Static outputs are built, not templated. These hold by construction.',
  },
];

export const OUTPUT_RULES: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'Validation first',
    body: 'Email and print run validateDraft at the untrusted tier with the deep block schemas and the sink scan before mapping anything; only the sink-free render tree is ever read.',
  },
  {
    title: 'Escaped by construction',
    body: 'Email HTML is built with the markup builders of @texuli/core: element and attribute names are allowlisted, every value is escaped, and there is no raw-markup API. No scripts, style elements, forms, frames or event handlers.',
  },
  {
    title: 'Links and images through the URL policy',
    body: 'Links must end up absolute https or mailto, images absolute https, at the untrusted tier. A refused link keeps its text; a refused image keeps its alt text.',
  },
  {
    title: 'Messages are text',
    body: 'formatMessage makes one pass with no recursion: a value is never scanned again, so a value holding {name} stays literal. Translation files are checked by parseCatalog: bad ids, prototype keys and oversized messages are dropped with an issue.',
  },
];

export const OUTPUT_DOCS: readonly { readonly label: string; readonly path: string }[] = [
  { label: 'Email', path: 'packages/tools/docs/email.md' },
  { label: 'Print and PDF', path: 'packages/tools/docs/print.md' },
  { label: 'Player print mode', path: 'packages/player/docs/embedding.md' },
  { label: 'Message catalog', path: 'packages/core/docs/core-i18n.md' },
  { label: 'Primitive labels', path: 'packages/primitives/docs/i18n.md' },
];

/**
 * A translation file from outside, with problems `parseCatalog` drops
 * (fictional). JSON text, so `__proto__` is an own key, as it would be in
 * a downloaded file.
 */
export const HOSTILE_CATALOG_JSON = `{
  "locale": "es",
  "messages": {
    "texuli.dialog.close-label": "Cerrar",
    "texuli.rating.label": "Valoración",
    "not an id": "Hola",
    "__proto__": "polluted",
    "texuli.copy-button.label": "${'x'.repeat(2_001)}",
    "texuli.tag.remove-label": { "plural": "count" },
    "texuli.toaster.label": 42
  }
}`;
