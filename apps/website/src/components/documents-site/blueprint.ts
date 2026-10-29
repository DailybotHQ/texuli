/**
 * Documents as agent data on /documents-page/ (spec 0.7.0, ADR-011): a
 * `document` blueprint an agent writes, a bounded patch that edits it by
 * node key, and a hostile patch the patcher refuses. The host side wires
 * the `@texuli/document` validator and patcher into the catalog's
 * `patchDocument` seam, validating every result at the untrusted tier.
 * Fictional data only (Harbor, example.com). Checked by
 * apps/website/tests/site-documents.test.ts.
 */
import type { DocumentPatcher, DocumentPatchOp, EditOp } from '@texuli/catalog/edit';
import type { TexuliDocument } from '@texuli/document/model';
import { applyDocumentPatch, type DocumentPatch } from '@texuli/document/ops';
import { validateDocument } from '@texuli/document/schema';

/** The spec version that admits `document` nodes, node keys and `patchDocument`. */
export const DOCUMENT_SPEC = '0.7.0';

/** The key the agent gave the document node; patches address it by key. */
export const DOCUMENT_KEY = 'launch-brief';

const CATALOG_PIN = '0'.repeat(64);

const words = (value: string) => [{ type: 'text', text: value, marks: [] }];

/** The document the agent wrote (the `doc` prop of the node). */
const LAUNCH_BRIEF = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Launch brief', locale: 'en', authors: ['Harbor assistant'] },
  blocks: [
    { id: 'title', type: 'heading', level: 1, content: words('Launch brief') },
    {
      id: 'intro',
      type: 'paragraph',
      content: words('The fictional example.com beta opens to every team next week.'),
    },
    { id: 'goals', type: 'heading', level: 2, content: words('Goals') },
    {
      id: 'goal-list',
      type: 'list',
      kind: 'bullet',
      items: [
        {
          id: 'goal-1',
          blocks: [
            { id: 'goal-1-text', type: 'paragraph', content: words('Invite 40 pilot teams') },
          ],
        },
        {
          id: 'goal-2',
          blocks: [
            {
              id: 'goal-2-text',
              type: 'paragraph',
              content: words('Answer feedback within a day'),
            },
          ],
        },
      ],
    },
    {
      id: 'numbers',
      type: 'block',
      family: 'data',
      block: 'stat',
      props: { items: [{ label: 'Pilot teams', value: '40' }] },
    },
    {
      id: 'trend',
      type: 'embed',
      kind: 'component',
      title: 'Sign-ups per week',
      inline: {
        id: 'charts-sparkline',
        props: { label: 'Sign-ups per week', values: [12, 18, 25, 31, 40] },
      },
    },
    {
      id: 'risk',
      type: 'callout',
      tone: 'warning',
      blocks: [{ id: 'risk-text', type: 'paragraph', content: words('The beta ends on Friday.') }],
    },
  ],
} as const;

/** The blueprint tree: one keyed `document` node. */
export const DOCUMENT_TREE: Readonly<Record<string, unknown>> = {
  key: DOCUMENT_KEY,
  id: 'document',
  props: { label: 'Launch brief', doc: LAUNCH_BRIEF },
};

/** The envelope around a tree (the header an agent service writes). */
export function documentEnvelope(tree: unknown): Record<string, unknown> {
  return {
    format: 'texuli-blueprint',
    version: 1,
    spec: DOCUMENT_SPEC,
    id: 'document-launch-brief',
    catalog: CATALOG_PIN,
    status: 'draft',
    createdAt: '2026-10-29T09:00:00Z',
    updatedAt: '2026-10-29T09:00:00Z',
    generator: { kind: 'agent', name: 'Harbor assistant', model: 'example-model' },
    tier: 'untrusted',
    profile: 'web',
    tree,
  };
}

/** The blueprint the agent emitted. */
export const DOCUMENT_BLUEPRINT = documentEnvelope(DOCUMENT_TREE);

/**
 * A bounded patch (RFC 6902 inside one `patchDocument` op): guard the title
 * with `test`, rename the document, add a goal and soften the risk. All or
 * none: a failing `test` changes nothing.
 */
export const DOCUMENT_PATCH: EditOp = {
  op: 'patchDocument',
  key: DOCUMENT_KEY,
  patch: [
    { op: 'test', path: '/meta/title', value: 'Launch brief' },
    { op: 'replace', path: '/meta/title', value: 'Launch brief, revised' },
    { op: 'replace', path: '/blocks/0/content/0/text', value: 'Launch brief, revised' },
    {
      op: 'add',
      path: '/blocks/3/items/-',
      value: {
        id: 'goal-3',
        blocks: [
          { id: 'goal-3-text', type: 'paragraph', content: words('Publish the pilot report') },
        ],
      },
    },
    {
      op: 'replace',
      path: '/blocks/6/blocks/0/content/0/text',
      value: 'The beta ends on Friday; pilots keep their data.',
    },
  ],
};

/** A hostile patch: a prototype path. The patcher refuses it and nothing changes. */
export const HOSTILE_PATCH: EditOp = {
  op: 'patchDocument',
  key: DOCUMENT_KEY,
  patch: [{ op: 'add', path: '/__proto__/polluted', value: true }],
};

/**
 * The host's `DocumentPatcher` for `applyEditOps`: validate the document,
 * apply the patch all or none, and validate the result again at the
 * untrusted tier (agent content).
 */
export const patchDocumentHost: DocumentPatcher = (doc, patch) => {
  const checked = validateDocument(doc, { trust: 'untrusted' });
  if (!checked.ok) return { ok: false, message: 'The document does not validate.' };
  const result = applyDocumentPatch(
    checked.document as TexuliDocument,
    patch as unknown as DocumentPatch
  );
  if (!result.ok)
    return { ok: false, message: `Patch operation ${result.index}: ${result.reason}` };
  const after = validateDocument(result.document, { trust: 'untrusted' });
  if (!after.ok) return { ok: false, message: 'The patched document does not validate.' };
  return {
    ok: true,
    document: result.document,
    inverse: result.inverse as unknown as readonly DocumentPatchOp[],
  };
};

/** Pretty JSON for the static code samples (text, never HTML). */
export const DOCUMENT_BLUEPRINT_JSON = JSON.stringify(DOCUMENT_BLUEPRINT, null, 2);
export const DOCUMENT_PATCH_JSON = JSON.stringify(DOCUMENT_PATCH, null, 2);
export const HOSTILE_PATCH_JSON = JSON.stringify(HOSTILE_PATCH, null, 2);
