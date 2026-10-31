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

/** One diagnostic as the operations return it. */
export interface BlueprintDiagnostic {
  check: string;
  code: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
  id?: string;
}

/** What `blueprint.validate` returns, plus the migrated envelope `blueprint.theme` builds on. */
export interface BlueprintVerdict {
  valid: boolean;
  status: DraftValidation['status'];
  tier: 'untrusted' | 'developer';
  migratedFrom?: string;
  diagnostics: BlueprintDiagnostic[];
}

/**
 * Validate a draft with the catalog's checks, the deep block and document
 * schemas, and the envelope's design system through the spec's
 * `checkDesignSystemReference` (loaded lazily with the design-system
 * operations): an inline document's codes and paths land under
 * `$.designSystem`.
 */
export async function validateBlueprintDraft(
  draft: unknown,
  tier: 'untrusted' | 'developer',
  fragment: boolean
): Promise<BlueprintVerdict & { envelope: DraftValidation['envelope'] }> {
  const [{ catalog, hash }, , { checkDesignSystemReference }] = await Promise.all([
    viewOfCatalog(),
    loadBlockShapes(),
    import('@texuli/tokens/design-system/validate'),
  ]);
  const result: DraftValidation = validateDraft(draft, {
    catalog,
    catalogHash: hash,
    tier,
    ...(fragment ? { frameRoots: false as const } : {}),
    checkBlock: checkFamilyBlock,
    checkDocument,
    checkDesignSystem: checkDesignSystemReference,
  });
  const declared = declaredSpec(draft);
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
    envelope: result.envelope,
  };
}

export const blueprintValidate: Operation = defineOperation({
  name: 'blueprint.validate',
  title: 'Validate a blueprint draft',
  summary:
    "Validate a blueprint draft (a catalog tree, an array of trees, or a texuli-blueprint envelope, migrated first) with the catalog's checks: structure, sinks, tree limits, component ids, tiers, prop, block and document schemas, the envelope's designSystem (codes under $.designSystem), grammar and the frame root. Returns valid, status, tier, migratedFrom and diagnostics with stable codes.",
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
    const { envelope: _envelope, ...verdict } = await validateBlueprintDraft(
      input.draft,
      input.tier === 'developer' ? 'developer' : 'untrusted',
      input.fragment === true
    );
    return verdict;
  },
});

const DIAGNOSTICS = {
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
} as const;

/** The timestamp a wrapped tree's envelope gets: fixed, so the output is deterministic. */
export const THEME_WRAP_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const REF =
  '^(texuli:[a-z][a-z0-9]*(-[a-z0-9]+)*|[a-z][a-z0-9]*(-[a-z0-9]+)*@(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*))$';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const blueprintTheme: Operation = defineOperation({
  name: 'blueprint.theme',
  title: 'Apply a design system to a blueprint',
  summary:
    'Set a blueprint envelope\'s designSystem to a reference ({ ref: "acme@2.1.0" } or a library theme "texuli:ocean") or an inline document, wrapping a bare tree in a draft envelope first, then validate the result as blueprint.validate does; an inline document is also compiled for the contrast, focus and target guarantees. Returns valid, the themed blueprint and diagnostics with stable codes.',
  input: {
    type: 'object',
    properties: {
      blueprint: {
        type: ['object', 'array'],
        maxItems: MAX_NODES,
        description:
          'A texuli-blueprint envelope, or a catalog tree (or array of trees) to wrap in a draft envelope for the current catalog.',
      },
      designSystem: {
        type: 'object',
        properties: {
          ref: {
            type: 'string',
            maxLength: 140,
            pattern: REF,
            description:
              'An exact id@x.y.z the host resolves, or texuli:<theme> for a library theme; never a range, URL or path.',
          },
          inline: {
            type: 'object',
            description: 'A whole design-system document carried in the blueprint.',
          },
        },
        additionalProperties: false,
        description: 'Exactly one of ref and inline.',
      },
      tier: {
        type: 'string',
        enum: ['untrusted', 'developer'],
        default: 'untrusted',
        description:
          'The tier to validate at: untrusted (agent output, the default; refuses data: URLs in an inline document) or developer.',
      },
      id: {
        type: 'string',
        maxLength: 128,
        pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]*$',
        description: 'A wrapped tree only: the envelope id (default "draft").',
      },
    },
    required: ['blueprint', 'designSystem'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      status: { type: 'string', enum: ['valid', 'invalid', 'parse', 'over-limits'] },
      tier: { type: 'string', enum: ['untrusted', 'developer'] },
      blueprint: { type: 'object' },
      diagnostics: DIAGNOSTICS,
    },
    required: ['valid', 'status', 'tier', 'blueprint', 'diagnostics'],
  },
  annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
  runtime: 'edge',
  limits: {
    inputBytes: MAX_TREE_BYTES + DRAFT_TEXT_ALLOWANCE + 1_048_576,
    items: MAX_NODES,
    timeMs: 10_000,
  },
  examples: [
    {
      title: 'Theme the hero page with a library theme',
      input: { blueprint: VALID_DRAFT, designSystem: { ref: 'texuli:ocean' } },
    },
    {
      title: 'Carry a small inline design system',
      input: {
        blueprint: VALID_DRAFT,
        designSystem: {
          inline: {
            format: 'texuli/design-system',
            formatVersion: 1,
            id: 'harborline',
            version: '1.0.0',
            name: 'Harborline',
            color: { brand: { seed: '#0e7490' } },
          },
        },
      },
    },
  ],
  async handler(input) {
    const tier = input.tier === 'developer' ? 'developer' : 'untrusted';
    const designSystem = input.designSystem as Record<string, unknown>;
    let blueprint: Record<string, unknown>;
    if (isRecord(input.blueprint) && input.blueprint.format === 'texuli-blueprint') {
      blueprint = { ...input.blueprint, designSystem };
    } else {
      const { hash } = await viewOfCatalog();
      blueprint = {
        format: 'texuli-blueprint',
        version: 1,
        id: typeof input.id === 'string' ? input.id : 'draft',
        catalog: hash,
        status: 'draft',
        createdAt: THEME_WRAP_TIMESTAMP,
        updatedAt: THEME_WRAP_TIMESTAMP,
        generator: { kind: 'tool', name: 'blueprint.theme' },
        designSystem,
        tree: input.blueprint,
      };
    }
    const { envelope, ...verdict } = await validateBlueprintDraft(blueprint, tier, false);
    // The migrated envelope (spec current), still a draft: only the host activates it.
    const themed = envelope ? { ...envelope, status: 'draft' } : blueprint;
    const diagnostics = [...verdict.diagnostics];
    const ref = typeof designSystem.ref === 'string' ? designSystem.ref : undefined;
    const ds = await import('./design-system-run.ts');
    if (ref?.startsWith('texuli:') && !(await ds.libraryThemeExists(ref.slice(7))))
      diagnostics.push({
        check: 'design-system',
        code: 'invalid-value',
        severity: 'error',
        path: '$.designSystem.ref',
        message: `No library theme "${ref.slice(7)}". Find ids with theme.search.`,
      });
    if (isRecord(designSystem.inline) && !diagnostics.some((d) => d.check === 'design-system')) {
      // The spec's rules passed: compile it too, for the guarantee codes.
      const check = await ds.runValidate({ document: designSystem.inline, trust: tier });
      for (const issue of check.errors)
        diagnostics.push({
          check: 'design-system',
          code: issue.code,
          severity: 'error',
          path: `$.designSystem.inline${issue.path.slice(1)}`,
          message: issue.hint ? `${issue.message} ${issue.hint}` : issue.message,
        });
    }
    const valid = verdict.valid && !diagnostics.some((d) => d.severity === 'error');
    return {
      valid,
      status: verdict.status === 'valid' && !valid ? 'invalid' : verdict.status,
      tier: verdict.tier,
      blueprint: themed,
      diagnostics,
    };
  },
});
