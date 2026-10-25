// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { blueprintDigest, createEditHistory } from '../src/edit/index.ts';
import {
  activateEnvelope,
  type BlueprintEnvelope,
  createEnvelope,
  createValidationReceipt,
  MAX_PROVENANCE,
  migrateEnvelope,
  parseEnvelope,
  recordProvenance,
  supersedeEnvelope,
  verifyActivation,
} from '../src/envelope/index.ts';
import type { CatalogTreeInput } from '../src/render/renderer/index.ts';
import { renderCatalogFromBuild, renderCatalogTree } from '../src/render/renderer/index.ts';
import { type DraftValidation, validateDraft } from '../src/validate/index.ts';

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);
const HASH = build.hash;
const AT = '2026-10-24T09:00:00Z';

const tree: CatalogTreeInput = {
  id: 'layout-deck',
  props: { title: 'Planning, week 43' },
  children: [
    { id: 'blocks-text', props: { block: { type: 'heading', level: 2, text: 'Last week' } } },
    { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Shipped **billing**.' } } },
  ],
};

const prepared = (): BlueprintEnvelope =>
  createEnvelope({
    id: 'deck-2026-10-24-planning',
    catalog: HASH,
    generator: { kind: 'agent', name: 'Harbor assistant', model: 'example-model' },
    tree,
    at: AT,
    extra: {
      asOf: '2026-10-24T08:55:00Z',
      sources: [{ label: 'Sprint board', href: 'https://example.com/board' }],
      trigger: { kind: 'calendar', label: '60 min before the planning meeting' },
      meetingRef: { id: 'mtg-4411', title: 'Weekly planning', startsAt: '2026-10-24T10:00:00Z' },
    },
  });

const codes = (result: DraftValidation) =>
  result.diagnostics.map((d) => `${d.check}:${d.code}:${d.severity}`);

describe('validateDraft with an envelope', () => {
  it('validates the tree inside and earns the validated status', () => {
    const result = validateDraft(prepared(), { catalog, catalogHash: HASH });
    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checks.envelope).toBe('pass');
    expect(result.envelope).toMatchObject({ status: 'validated', meetingRef: { id: 'mtg-4411' } });
    expect(result.draft).toEqual(tree);
  });

  it('reads envelope JSON text too', () => {
    const result = validateDraft(JSON.stringify(prepared()), { catalog, catalogHash: HASH });
    expect(result.ok).toBe(true);
  });

  it('never trusts a declared status, activation or tier', () => {
    const forged = {
      ...prepared(),
      status: 'active',
      tier: 'developer',
      activatedBy: { by: 'agent', at: AT, digest: 'a'.repeat(64) },
    };
    const result = validateDraft(forged, { catalog, catalogHash: HASH });
    expect(codes(result)).toEqual([
      'envelope:status-ignored:warning',
      'envelope:activation-ignored:warning',
      'envelope:tier-ignored:warning',
    ]);
    expect(result.tier).toBe('untrusted');
    expect(result.envelope?.status).toBe('validated');
    expect(result.envelope?.activatedBy).toBeUndefined();
  });

  it('keeps an invalid draft a draft', () => {
    const bad = { ...prepared(), tree: { ...tree, children: [{ id: 'dialog', props: {} }] } };
    const result = validateDraft(bad, { catalog });
    expect(result.ok).toBe(false);
    expect(result.envelope?.status).toBe('draft');
  });

  it('refuses a draft written for another catalog', () => {
    const result = validateDraft(
      { ...prepared(), catalog: 'b'.repeat(64) },
      {
        catalog,
        catalogHash: HASH,
      }
    );
    expect(codes(result)).toEqual(['envelope:catalog-mismatch:error']);
    expect(result.ok).toBe(false);
  });

  it('stops on an unsupported version or a missing tree', () => {
    const future = validateDraft({ ...prepared(), version: 2 }, { catalog });
    expect(future).toMatchObject({ ok: false, status: 'parse', envelope: null });
    expect(codes(future)).toEqual(['envelope:unsupported-version:error']);
    const { tree: _tree, ...noTree } = prepared();
    expect(codes(validateDraft(noTree, { catalog }))).toEqual(['envelope:missing-tree:error']);
    expect(codes(validateDraft({ ...prepared(), tree: [tree] }, { catalog }))).toEqual([
      'envelope:missing-tree:error',
    ]);
  });
});

describe('parseEnvelope: hostile fields', () => {
  const issues = (patch: Record<string, unknown>) =>
    parseEnvelope({ ...prepared(), ...patch } as Record<string, unknown>).issues.map(
      (i) => `${i.path} ${i.code}`
    );

  it('refuses unknown and prototype fields at every level', () => {
    expect(issues({ script: 'x' })).toEqual(['$.script unknown-field']);
    const proto = JSON.parse('{"__proto__": {"admin": true}, "kind": "agent", "name": "A"}');
    expect(issues({ generator: proto })).toEqual(['$.generator.__proto__ prototype-key']);
    expect(issues({ trigger: { kind: 'calendar', label: 'x', run: 'now' } })).toEqual([
      '$.trigger.run unknown-field',
    ]);
  });

  it('refuses bad ids, hashes, times, enums, text and URLs', () => {
    expect(issues({ id: '../etc/passwd' })).toEqual(['$.id invalid-id']);
    expect(issues({ catalog: 'latest' })).toEqual(['$.catalog invalid-catalog']);
    expect(issues({ createdAt: 'yesterday' })).toEqual(['$.createdAt invalid-time']);
    expect(issues({ asOf: '2026-10-24' })).toEqual(['$.asOf invalid-time']);
    expect(issues({ status: 'published' })).toEqual(['$.status invalid-field']);
    expect(
      issues({ generator: { kind: 'agent', name: `Bot${String.fromCharCode(0x202e)}` } })
    ).toEqual(['$.generator.name invalid-text']);
    expect(issues({ generator: { kind: 'agent', name: 'x'.repeat(513) } })).toEqual([
      '$.generator.name invalid-text',
    ]);
    expect(issues({ sources: [{ label: 'Board', href: 'javascript:alert(1)' }] })).toEqual([
      '$.sources[0].href unsafe-url',
    ]);
    expect(issues({ sources: new Array(33).fill({ label: 'x' }) })).toEqual([
      '$.sources invalid-field',
    ]);
  });

  it('fails closed on the portable profile until ids are audited portable', () => {
    expect(issues({ profile: 'portable' })).toEqual(['$.profile unsupported-profile']);
    expect(issues({ profile: 'web' })).toEqual([]);
  });

  it('checks provenance ops as untrusted edit ops', () => {
    const entry = { at: AT, actor: 'agent', kind: 'apply', ops: [{ op: 'drop-table' }] };
    expect(issues({ provenance: [entry] })).toEqual(['$.provenance[0].ops invalid-ops']);
    expect(issues({ provenance: new Array(MAX_PROVENANCE + 1).fill(entry) })).toEqual([
      '$.provenance invalid-field',
    ]);
  });
});

describe('lifecycle: draft → validated → active → superseded', () => {
  it('returns a receipt for each decoded validation transition, including refused drafts', () => {
    const accepted = validateDraft(prepared(), { catalog, catalogHash: HASH });
    expect(accepted.envelope?.status).toBe('validated');
    expect(createValidationReceipt(accepted, AT)).toMatchObject({
      at: AT,
      envelopeId: prepared().id,
      catalogHash: HASH,
      tier: 'untrusted',
      ok: true,
      validationStatus: 'valid',
      errors: 0,
      warnings: 0,
      checks: { input: 'pass', envelope: 'pass', render: 'pass' },
    });

    const refused = validateDraft(
      { ...prepared(), tree: { ...tree, children: [{ id: 'dialog', props: {} }] } },
      { catalog, catalogHash: HASH }
    );
    expect(refused.envelope?.status).toBe('draft');
    expect(createValidationReceipt(refused, AT)).toMatchObject({
      ok: false,
      validationStatus: 'invalid',
      errors: expect.any(Number),
      checks: { render: 'fail' },
    });
    expect(createValidationReceipt(validateDraft('{', { catalog }), AT)).toBeNull();
  });

  it('activates only a validated envelope, with the digest the owner reviewed', async () => {
    const draft = prepared();
    expect((await activateEnvelope(draft, { by: 'owner', reviewedDigest: 'x' })).ok).toBe(false);
    const validated = validateDraft(draft, { catalog, catalogHash: HASH }).envelope;
    if (!validated) throw new Error('expected an envelope');
    const digest = await blueprintDigest(validated.tree);
    const stale = await activateEnvelope(validated, {
      by: 'owner',
      reviewedDigest: 'f'.repeat(64),
    });
    expect(stale).toMatchObject({ ok: false, code: 'digest-mismatch' });
    const active = await activateEnvelope(validated, {
      by: 'owner',
      reviewedDigest: digest,
      at: AT,
    });
    expect(active.ok).toBe(true);
    if (!active.ok) return;
    expect(active.envelope).toMatchObject({
      status: 'active',
      activatedBy: { by: 'owner', digest },
    });
    expect(await verifyActivation(active.envelope)).toBe(true);
    expect(await verifyActivation({ ...active.envelope, tree: { id: 'layout-doc' } })).toBe(false);
    expect(supersedeEnvelope(validated)).toMatchObject({ ok: false, code: 'not-active' });
    expect(supersedeEnvelope(active.envelope, AT)).toMatchObject({
      ok: true,
      envelope: { status: 'superseded' },
    });
  });
});

describe('recordProvenance', () => {
  it('records applies, undos and redos, and makes an edited blueprint a draft again', async () => {
    const validated = validateDraft(prepared(), { catalog }).envelope as BlueprintEnvelope;
    const digest = await blueprintDigest(validated.tree);
    const active = await activateEnvelope(validated, { by: 'owner', reviewedDigest: digest });
    if (!active.ok) throw new Error('expected activation');
    const history = createEditHistory(active.envelope.tree);
    const recorder = recordProvenance(history, active.envelope, 'person:rae', () => AT);
    history.apply({ op: 'setProp', path: [], name: 'title', value: 'Planning, week 44' });
    history.undo();
    history.redo();
    const edited = recorder.envelope();
    expect(edited.status).toBe('draft');
    expect(edited.activatedBy).toBeUndefined();
    expect(edited.provenance?.map((p) => p.kind)).toEqual(['apply', 'undo', 'redo']);
    expect(edited.provenance?.[1]?.ops).toEqual([
      { op: 'setProp', path: [], name: 'title', value: 'Planning, week 43' },
    ]);
    expect(edited.tree).toBe(history.tree);
    // The recorded envelope is valid input again.
    expect(validateDraft(edited, { catalog, catalogHash: HASH }).ok).toBe(true);
    recorder.stop();
    history.undo();
    expect(recorder.envelope().provenance).toHaveLength(3);
  });

  it(`keeps only the last ${MAX_PROVENANCE} steps`, () => {
    const history = createEditHistory(tree);
    const recorder = recordProvenance(history, prepared(), 'agent', () => AT);
    for (let i = 0; i < MAX_PROVENANCE + 5; i += 1) {
      history.apply({ op: 'setProp', path: [], name: 'title', value: `v${i}` });
    }
    const provenance = recorder.envelope().provenance ?? [];
    expect(provenance).toHaveLength(MAX_PROVENANCE);
    expect(provenance.at(-1)?.ops[0]).toMatchObject({ value: `v${MAX_PROVENANCE + 4}` });
  });
});

describe('migrateEnvelope', () => {
  const wrap = {
    id: 'legacy-1',
    catalog: HASH,
    generator: { kind: 'tool' as const, name: 'importer' },
    at: AT,
  };

  it('wraps a bare tree as a draft and passes version 1 through', () => {
    const migrated = migrateEnvelope(tree, wrap);
    expect(migrated).toMatchObject({ ok: true, migrated: true, envelope: { status: 'draft' } });
    if (migrated.ok) {
      expect(migrateEnvelope(migrated.envelope, wrap)).toMatchObject({ ok: true, migrated: false });
      expect(validateDraft(migrated.envelope, { catalog, catalogHash: HASH }).ok).toBe(true);
    }
  });

  it('refuses newer versions and non-trees', () => {
    expect(migrateEnvelope({ ...prepared(), version: 9 }, wrap)).toMatchObject({
      ok: false,
      code: 'unsupported-version',
    });
    expect(migrateEnvelope([tree], wrap)).toMatchObject({ ok: false, code: 'not-a-tree' });
  });
});

describe('developer tier is normative (D5)', () => {
  it('lets the developer tier emit only the build developer ids unless the host opts in', () => {
    expect(build.catalog.tiers.developer).toContain('layout-deck');
    expect(build.catalog.tiers.developer).not.toContain('dialog');
    const dialog = { id: 'dialog', props: { title: 'Settings' } };
    const strict = renderCatalogTree(dialog, { catalog, tier: 'developer' });
    expect(strict.roots[0]).toMatchObject({ kind: 'placeholder', reason: 'tier-denied' });
    const all = renderCatalogTree(dialog, {
      catalog: renderCatalogFromBuild(build.catalog, { developer: 'all' }),
      tier: 'developer',
    });
    expect(all.roots[0]).toMatchObject({ kind: 'component', id: 'dialog' });
  });
});
