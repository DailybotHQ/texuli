/**
 * Catalog manifest for documents as data (spec 0.7.0, ADR-011): one
 * `document` id whose `doc` prop carries a Texuli document (the
 * `@texuli/document` format). Its blocks reuse the catalog's vocabulary: a
 * `block` node wraps a `@texuli/blocks` block, checked as the matching
 * `blocks-<family>` catalog id, and an inline `component` embed is a
 * one-node catalog blueprint, checked as that catalog id at the same tier.
 * `validateDraft` refuses a `document` node unless the host supplies the
 * document validator (`checkDocument`), so documents never pass on
 * structure alone. `@texuli/player` hands a validated document to its
 * `documentHost` (`@texuli/pages` provides one around the reader).
 * Build-time only; a subpath group the catalog root does not re-export.
 */
import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import type { GrammarComponentMeta } from '../../render/grammar/types.ts';

/** The catalog id of a document root (spec 0.7.0). */
export const DOCUMENT_CATALOG_ID = 'document' as const;

export const documentManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: DOCUMENT_CATALOG_ID,
  package: '@texuli/pages',
  label: 'Document',
  summary:
    'A block document (a brief, a report, notes or a page) as data: headings, paragraphs, lists, callouts, columns, content blocks and embedded components.',
  tier: 'content',
  agentEmittable: true,
  useWhen: [
    'Write a document people read, export (Markdown, DOCX, PDF) or keep editing',
    'Edit an existing document with a bounded patch (patchDocument) instead of rewriting it',
  ],
  dontUseWhen: [
    'An interface with controls, state or flows: use layout-page or layout-doc with catalog nodes',
    'A slide presentation: use layout-deck',
  ],
  a11y: [
    'Painted as an article named by the document title, with anchored headings and an outline',
    'Text is data, never HTML; links and media pass the URL policy at the host tier',
    'Embedded components are validated again as catalog nodes at the same tier',
  ],
  props: [
    {
      name: 'doc',
      kind: 'object',
      required: true,
      description:
        'A Texuli document: { format: "texuli-document", formatVersion: 1, meta: { title }, blocks }. Blocks: paragraph, heading, code, list, quote, divider, media, callout, toggle, columns, page-link, block ({ family, block, props }: a @texuli/blocks block) and embed ({ kind: "component", inline: { id, props } }: one catalog node).',
      schema: { $ref: '#/$defs/document' },
    },
    {
      name: 'label',
      kind: 'string',
      trust: 'untrusted',
      description: 'Accessible name; defaults to the document title.',
    },
    {
      name: 'outline',
      kind: 'boolean',
      default: true,
      description: 'Show the "On this page" outline when the document has two or more headings.',
    },
  ],
  examples: [
    {
      id: 'brief',
      title: 'Project brief',
      props: {
        doc: {
          format: 'texuli-document',
          formatVersion: 1,
          meta: { title: 'Project brief', locale: 'en' },
          blocks: [
            {
              id: 'title',
              type: 'heading',
              level: 1,
              content: [{ type: 'text', text: 'Project brief', marks: [] }],
            },
            {
              id: 'intro',
              type: 'paragraph',
              content: [
                { type: 'text', text: 'A fictional plan for the example.com launch.', marks: [] },
              ],
            },
            {
              id: 'risk',
              type: 'callout',
              tone: 'warning',
              blocks: [
                {
                  id: 'risk-text',
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'The beta ends on Friday.', marks: [] }],
                },
              ],
            },
          ],
        },
      },
    },
  ],
  related: ['layout-doc', 'layout-page', 'blocks-text'],
});

export const DOCUMENTS_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  documentManifest,
]);

/** A document is an article landmark of its own; its headings stay inside it. */
export const DOCUMENTS_GRAMMAR_ROLES: readonly GrammarComponentMeta[] =
  /* @__PURE__ */ Object.freeze([{ id: DOCUMENT_CATALOG_ID, role: 'static' }]);
