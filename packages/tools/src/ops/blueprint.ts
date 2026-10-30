/**
 * `blueprint.validate`: the catalog's draft validation (`validateDraft` from
 * `@texuli/catalog/validate`) as an operation, so an agent can check a
 * blueprint through any door. It runs at the tier the caller names (never
 * the tier the draft declares), against the catalog `catalog.search`
 * reports, with the deep block schemas and the document validator.
 */
import { DEFAULT_TREE_LIMITS } from '@texuli/catalog/render/limits';
import { type RenderCatalog, renderCatalogFromBuild } from '@texuli/catalog/render/renderer';
import {
  DRAFT_TEXT_ALLOWANCE,
  type DraftDocumentCheck,
  type DraftValidation,
  validateDraft,
} from '@texuli/catalog/validate';
import { validateDocument } from '@texuli/document/schema';
import { checkFamilyBlock } from '../internal/static-draft.ts';
import { loadBlockShapes } from './block-shapes-loader.ts';
import { loadOpsCatalog } from './catalog.ts';
import { defineOperation } from './registry.ts';
import type { Operation } from './types.ts';

/** The catalog's default tree caps, which `validateDraft` enforces. */
const MAX_NODES = DEFAULT_TREE_LIMITS.maxNodes;
const MAX_TREE_BYTES = DEFAULT_TREE_LIMITS.maxBytes;

let renderCatalog: Promise<{ catalog: RenderCatalog; hash: string }> | undefined;
function viewOfCatalog(): Promise<{ catalog: RenderCatalog; hash: string }> {
  renderCatalog ??= loadOpsCatalog().then((built) => ({
    catalog: renderCatalogFromBuild(built.catalog),
    hash: built.hash,
  }));
  return renderCatalog;
}

/** `validateDocument` at the draft's tier, in the shape `validateDraft` injects. */
const checkDocument: DraftDocumentCheck = (doc, tier) => {
  const result = validateDocument(doc, { trust: tier });
  const issues = result.issues.map((issue) => ({ ...issue, path: issue.jsonPath }));
  return result.ok ? { ok: true, document: result.document, issues } : { ok: false, issues };
};

/** The spec version an envelope declares (an envelope without `spec` is 0.2.0). */
function declaredSpec(draft: unknown): string | undefined {
  if (typeof draft !== 'object' || draft === null || Array.isArray(draft)) return undefined;
  const record = draft as Record<string, unknown>;
  if (record.format !== 'texuli-blueprint') return undefined;
  return typeof record.spec === 'string' ? record.spec : '0.2.0';
}

// From tests/fixtures/golden/01-landing-page.json: the page root and its hero heading.
const VALID_DRAFT = {
  id: 'layout-page',
  props: {
    title: 'Harborline: shared boards for small teams',
    description: 'Plan the week together, see who is blocked, and ship on time.',
  },
  children: [
    {
      id: 'blocks-text',
      props: {
        block: {
          type: 'heading',
          level: 2,
          eyebrow: 'New: weekly digests',
          text: 'One board for the whole team',
          subtitle: 'Boards, check-ins and reports in one place. Free for teams up to five.',
        },
      },
    },
  ],
};
// From tests/fixtures/hostile/corpus.json (script-javascript-href) under a page root.
const INVALID_DRAFT = {
  id: 'layout-page',
  props: { title: 'Fictional page' },
  children: [
    { id: 'card', props: { title: 'Click me', href: 'javascript:alert(document.domain)' } },
  ],
};

export const blueprintValidate: Operation = defineOperation({
  name: 'blueprint.validate',
  title: 'Validate a blueprint draft',
  summary:
    "Validate a blueprint draft (a catalog tree, an array of trees, or a texuli-blueprint envelope, migrated first) with the catalog's draft checks: structure, sinks, tree limits, component ids, tiers and prop schemas, deep block and document schemas, grammar and the frame root. Returns valid, status, tier, migratedFrom and diagnostics with the catalog's stable codes.",
  input: {
    type: 'object',
    properties: {
      draft: {
        type: ['object', 'array'],
        maxItems: MAX_NODES,
        description: `The blueprint: a catalog tree { id, props, children }, an array of trees, or a texuli-blueprint envelope (format, version, id, catalog hash from catalog.search, status, createdAt, updatedAt, generator, tree). At most ${MAX_NODES} nodes. schema-form, canvas and spreadsheet nodes and data-source bindings are refused: this server has no validator for them.`,
      },
      tier: {
        type: 'string',
        enum: ['untrusted', 'developer'],
        default: 'untrusted',
        description:
          'The tier to validate at: untrusted (agent output, the default) or developer (app-authored). A tier the draft declares is ignored.',
      },
      fragment: {
        type: 'boolean',
        default: false,
        description:
          'Accept any roots (a fragment). Default false: one frame root (layout-page, layout-doc, layout-deck, document, canvas or data-dashboard).',
      },
    },
    required: ['draft'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      status: { type: 'string', enum: ['valid', 'invalid', 'parse', 'over-limits'] },
      tier: { type: 'string', enum: ['untrusted', 'developer'] },
      migratedFrom: { type: 'string' },
      diagnostics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            check: { type: 'string' },
            code: { type: 'string' },
            severity: { type: 'string', enum: ['error', 'warning'] },
            path: { type: 'string' },
            message: { type: 'string' },
            id: { type: 'string' },
          },
          required: ['check', 'code', 'severity', 'path', 'message'],
        },
      },
    },
    required: ['valid', 'status', 'tier', 'diagnostics'],
  },
  annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
  runtime: 'edge',
  limits: { inputBytes: MAX_TREE_BYTES + DRAFT_TEXT_ALLOWANCE, items: MAX_NODES, timeMs: 5000 },
  examples: [
    { title: 'A valid page with a hero heading', input: { draft: VALID_DRAFT } },
    { title: 'A hostile card with a script link', input: { draft: INVALID_DRAFT } },
  ],
  async handler(input) {
    const [{ catalog, hash }] = await Promise.all([viewOfCatalog(), loadBlockShapes()]);
    const tier = input.tier === 'developer' ? 'developer' : 'untrusted';
    const result: DraftValidation = validateDraft(input.draft, {
      catalog,
      catalogHash: hash,
      tier,
      ...(input.fragment === true ? { frameRoots: false as const } : {}),
      checkBlock: checkFamilyBlock,
      checkDocument,
    });
    const declared = declaredSpec(input.draft);
    const migratedFrom =
      declared !== undefined && result.envelope && result.envelope.spec !== declared
        ? declared
        : undefined;
    return {
      valid: result.ok,
      status: result.status,
      tier: result.tier,
      ...(migratedFrom ? { migratedFrom } : {}),
      diagnostics: result.diagnostics.map((diagnostic) => ({
        check: diagnostic.check,
        code: diagnostic.code,
        severity: diagnostic.severity,
        path: diagnostic.path,
        message: diagnostic.message,
        ...(diagnostic.id ? { id: diagnostic.id } : {}),
      })),
    };
  },
});
