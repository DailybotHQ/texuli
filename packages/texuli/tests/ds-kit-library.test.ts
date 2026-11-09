/**
 * T-t4-library (kit API §5.3, §5.4, §11.3, §11.5): the design system's own components through
 * host snippets with their approval badges and hash checks, and the changes between two
 * versions (tokens, allow set, library, approval).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render } from '@testing-library/svelte';
import {
  type CompiledDesignSystem,
  compileDesignSystem,
  resolveDesignSystem,
} from '@texuli/tokens/design-system/compile';
import type { DesignSystem } from '@texuli/tokens/design-system/validate';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  designSystemContentHash,
  libraryEntryContentHash,
} from '../../spec/src/design-system/hash.ts';
import type { KitCatalog, KitLibrarySnippet } from '../src/ds-kit/index.ts';
import {
  changesModel,
  KitChanges,
  KitLibrary,
  kitEntryApproval,
  kitEntryContentHash,
  libraryModel,
} from '../src/ds-kit/library/index.ts';
import { kitContentHash } from '../src/ds-kit/shared/approval.ts';
import { KIT_LIMITS } from '../src/ds-kit/shared/limits.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const LIBRARY_DIR = join(ROOT, 'packages/texuli/src/ds-kit/library');
const json = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as T;

type Entry = NonNullable<DesignSystem['library']>[number];

const pricingCard: Entry = {
  id: 'pricing-card',
  name: 'Pricing card',
  purpose: 'One plan with its price and a call to action.',
  version: '0.3.0',
  status: 'draft',
  composes: ['card', 'button', 'data-grid', 'not-a-component'],
};
const statTile: Entry = {
  id: 'stat-tile',
  name: 'Stat tile',
  purpose: 'A metric with its trend.',
  version: '1.0.0',
  status: 'approved',
  composes: ['stat'],
};
const approved = (entry: Entry): Entry => ({
  ...entry,
  approval: {
    status: 'approved',
    approvedBy: 'Design reviewer',
    approvedAt: '2026-11-09T14:30:00Z',
    version: entry.version,
    contentHash: libraryEntryContentHash(entry),
  },
});

/** A small catalog: the ids the entries name, minus `not-a-component`. */
const catalog: KitCatalog = {
  catalogHash: 'test',
  components: ['button', 'card', 'data-grid', 'stat'].map((id) => ({
    id,
    label: id,
    summary: id,
    group: 'test',
    props: [],
  })),
};

let previous: DesignSystem;
let current: DesignSystem;
let previousCompiled: CompiledDesignSystem;
let currentCompiled: CompiledDesignSystem;

async function compile(doc: DesignSystem): Promise<CompiledDesignSystem> {
  const resolved = await resolveDesignSystem(doc, { trust: 'developer' });
  if (!resolved.ok) throw new Error(JSON.stringify(resolved.errors));
  const result = compileDesignSystem(resolved.document);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

beforeAll(async () => {
  // Two versions of acme: 2.1.0 approved, then 2.2.0 with a smaller radius, a narrower
  // button, data-grid allowed, card removed, a new library entry and a draft approval.
  const acme = json<DesignSystem>('packages/spec/fixtures/design-systems/acme.json');
  const base: DesignSystem = { ...acme, library: [approved(statTile)] };
  previous = {
    ...base,
    approval: {
      status: 'approved',
      approvedBy: 'Design reviewer',
      approvedAt: '2026-11-01T09:00:00Z',
      version: '2.1.0',
      contentHash: designSystemContentHash(base),
    },
  };
  current = {
    ...acme,
    version: '2.2.0',
    shape: { ...acme.shape, radius: 2 },
    allow: {
      button: { variants: ['default', 'outline'], sizes: ['sm', 'md', 'lg'] },
      'data-grid': { densities: ['compact'] },
    },
    library: [{ ...approved(statTile), version: '1.1.0' }, pricingCard],
    approval: { status: 'draft', version: '2.2.0' },
  };
  previousCompiled = await compile(previous);
  currentCompiled = await compile(current);
});

afterEach(() => cleanup());

/** A host preview: prints the context it received, as text. */
const preview: KitLibrarySnippet = createRawSnippet((ctx) => ({
  render: () => {
    const { id, entry, variant, mode } = ctx();
    const text = `${id}|${entry.name}|${variant ?? '-'}|${mode}`.replace(/[<>&"]/g, '');
    return `<span data-preview="${id}" data-mode="${mode}">${text}</span>`;
  },
}));

describe('library model', () => {
  it('hashes an entry by the spec rule (without its approval)', () => {
    for (const entry of [pricingCard, approved(statTile), null, 'x', { id: 'a', approval: 1 }])
      expect(kitEntryContentHash(entry)).toBe(libraryEntryContentHash(entry));
    expect(kitContentHash(previous)).toBe(designSystemContentHash(previous));
  });

  it('checks each entry approval: matches, differs, missing, none', () => {
    expect(kitEntryApproval(approved(statTile))).toMatchObject({
      present: true,
      status: 'approved',
      approvedBy: 'Design reviewer',
      hash: 'matches',
    });
    expect(kitEntryApproval({ ...approved(statTile), purpose: 'Edited.' }).hash).toBe('differs');
    expect(
      kitEntryApproval({ ...statTile, approval: { status: 'draft', version: '1.0.0' } })
    ).toMatchObject({ present: true, status: 'draft', hash: 'missing' });
    expect(kitEntryApproval(pricingCard)).toMatchObject({ present: false, hash: 'missing' });
  });

  it('marks composed ids allowed, not allowed or unknown, from the manifest or the document', () => {
    const doc = { ...current };
    const model = libraryModel(doc, undefined, catalog);
    expect(model.locked).toBe(true);
    expect(model.items.map((item) => item.id)).toEqual(['stat-tile', 'pricing-card']);
    expect(model.items[1]?.composes).toEqual([
      { id: 'card', state: 'not-allowed' },
      { id: 'button', state: 'allowed' },
      { id: 'data-grid', state: 'allowed' },
      { id: 'not-a-component', state: 'unknown' },
    ]);
    // A manifest wins over the document; an unlocked one allows every catalog id.
    const unlocked = libraryModel(doc, { version: '2.2.0' }, catalog);
    expect(unlocked.locked).toBe(false);
    expect(unlocked.items[1]?.composes.map((c) => c.state)).toEqual([
      'allowed',
      'allowed',
      'allowed',
      'unknown',
    ]);
  });

  it('is total and bounded over hostile input', () => {
    expect(libraryModel(null).items).toEqual([]);
    expect(libraryModel({ library: 'x' }).items).toEqual([]);
    const many = Array.from({ length: KIT_LIMITS.libraryEntries + 5 }, (_, i) => ({
      ...pricingCard,
      id: `e-${i}`,
    }));
    const model = libraryModel({ library: [...many, 1, { id: 'e-0' }] });
    expect(model.items).toHaveLength(KIT_LIMITS.libraryEntries);
    expect(model.clipped).toBe(true);
    const long = libraryModel({ library: [{ id: 'x', name: 'n'.repeat(5000), composes: [] }] });
    expect(long.items[0]?.name.length).toBe(200);
  });
});

describe('KitLibrary', () => {
  it('renders each entry through its snippet, once per mode, with { id, entry, variant, mode }', () => {
    const { container } = render(KitLibrary, {
      props: {
        document: current,
        catalog,
        library: { 'pricing-card': preview },
        variant: 'compact',
      },
    });
    const previews = [...container.querySelectorAll('[data-preview="pricing-card"]')];
    expect(previews.map((el) => el.getAttribute('data-mode'))).toEqual(['light', 'dark']);
    expect(previews[0]?.textContent).toBe('pricing-card|Pricing card|compact|light');
    // An entry without a snippet shows its metadata and the consumer note.
    const stat = container.querySelector('#tx-ds-kit-library-stat-tile');
    expect(stat?.querySelector('[data-tx-ds-kit-preview="none"]')?.textContent).toMatch(
      /code lives in the consumer/u
    );
    expect(stat?.textContent).toContain('A metric with its trend.');
  });

  it('shows one mode when asked, and marks the current item', () => {
    const { container } = render(KitLibrary, {
      props: {
        document: current,
        library: { 'pricing-card': preview },
        modeView: 'dark',
        currentItem: 'pricing-card',
        idPrefix: 'kit',
      },
    });
    expect(
      [...container.querySelectorAll('[data-preview]')].map((el) => el.getAttribute('data-mode'))
    ).toEqual(['dark']);
    expect(container.querySelector('#kit-library')).not.toBeNull();
    expect(container.querySelector('#kit-library-pricing-card')?.getAttribute('aria-current')).toBe(
      'true'
    );
  });

  it('badges each approval as declared, with the hash check, never as verified', () => {
    const { container } = render(KitLibrary, {
      props: {
        document: {
          ...current,
          library: [
            approved(statTile),
            { ...approved(pricingCard), name: 'Edited' },
            { ...pricingCard, id: 'plain-card' },
          ],
        },
      },
    });
    const badges = [...container.querySelectorAll('.tx-ds-kit__approval-badge')];
    expect(badges.map((b) => b.getAttribute('data-tx-ds-kit-approval'))).toEqual([
      'approved',
      'approved',
      'none',
    ]);
    expect(badges[0]?.textContent).toContain('declared by Design reviewer on 2026-11-09T14:30:00Z');
    expect(badges[0]?.querySelector('[data-tx-ds-kit-hash]')?.textContent).toBe('Hash matches');
    expect(badges[1]?.querySelector('[data-tx-ds-kit-hash]')?.textContent).toBe(
      'Hash differs: re-approve'
    );
    expect(badges[2]?.textContent).toContain('Not approved');
    expect(container.textContent).not.toMatch(/verified/iu);
  });

  it('keeps hostile text as text', () => {
    const { container } = render(KitLibrary, {
      props: {
        document: {
          library: [
            { ...pricingCard, name: '<img src=x onerror=alert(1)>', purpose: '\u202Eevil' },
          ],
        },
      },
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('changes between two versions', () => {
  it('lists the token, allow, library and approval changes', () => {
    const model = changesModel(
      { document: previous, compiled: previousCompiled },
      { document: current, compiled: currentCompiled }
    );
    expect(model).toMatchObject({
      from: '2.1.0',
      to: '2.2.0',
      identical: false,
      contentChanged: true,
    });
    expect(model.tokens?.identical).toBe(false);
    expect(model.tokens?.tokens.some((t) => t.variable.startsWith('--tx-radius'))).toBe(true);
    expect(model.allow).toEqual([
      {
        kind: 'changed',
        component: 'button',
        list: 'variants',
        added: [],
        removed: ['secondary', 'ghost'],
        before: ['default', 'secondary', 'outline', 'ghost'],
        after: ['default', 'outline'],
      },
      { kind: 'removed', component: 'card' },
      { kind: 'added', component: 'data-grid' },
    ]);
    expect(model.library).toEqual([
      { kind: 'added', id: 'pricing-card' },
      {
        kind: 'changed',
        id: 'stat-tile',
        fields: [{ field: 'version', before: '1.0.0', after: '1.1.0' }],
      },
    ]);
    expect(model.approval).toEqual([
      { field: 'status', before: 'approved', after: 'draft' },
      { field: 'version', before: '2.1.0', after: '2.2.0' },
      { field: 'approvedBy', before: 'Design reviewer' },
      { field: 'approvedAt', before: '2026-11-01T09:00:00Z' },
      { field: 'contentHash', before: designSystemContentHash(previous) },
    ]);
  });

  it('reports locking and unlocking, list openings, and identical versions', () => {
    const unlocked = { ...current, allow: undefined };
    expect(changesModel({ document: unlocked }, { document: current }).allow.slice(0, 2)).toEqual([
      { kind: 'locked' },
      { kind: 'added', component: 'button' },
    ]);
    expect(changesModel({ document: current }, { document: unlocked }).allow).toEqual([
      { kind: 'unlocked' },
    ]);
    const opened = changesModel(
      { document: { allow: { button: { sizes: ['sm'] } } } },
      { document: { allow: { button: {} } } }
    );
    expect(opened.allow).toEqual([
      {
        kind: 'changed',
        component: 'button',
        list: 'sizes',
        added: [],
        removed: ['sm'],
        before: ['sm'],
      },
    ]);
    const same = changesModel(
      { document: current, compiled: currentCompiled },
      { document: structuredClone(current), compiled: currentCompiled }
    );
    expect(same.identical).toBe(true);
    // Approving changes only the approval: the content is the same.
    const stamped = {
      ...current,
      approval: { ...current.approval, status: 'approved' },
    } as DesignSystem;
    const approval = changesModel({ document: current }, { document: stamped });
    expect(approval).toMatchObject({ contentChanged: false, identical: false });
    expect(approval.tokens).toBeUndefined();
  });

  it('renders the grouped list, version A → B, and asks to compile when a version is not', () => {
    const { container } = render(KitChanges, {
      props: {
        previous: { document: previous, compiled: previousCompiled },
        document: current,
        compiled: currentCompiled,
      },
    });
    expect(container.querySelector('[data-tx-ds-kit-versions]')?.textContent).toContain(
      'From 2.1.0 to 2.2.0'
    );
    for (const group of ['tokens', 'allow', 'library', 'approval'])
      expect(container.querySelector(`#tx-ds-kit-changes-${group}`), group).not.toBeNull();
    const allow = container.querySelector('[data-tx-ds-kit-changes="allow"]')?.textContent ?? '';
    expect(allow).toContain('default, secondary, outline, ghost → default, outline');
    expect(allow).toMatch(/Removed · card/u);
    expect(allow).toMatch(/Added · data-grid/u);
    expect(container.querySelector('[data-tx-ds-kit-content-changed]')).not.toBeNull();

    cleanup();
    const bare = render(KitChanges, {
      props: { previous: { document: previous }, document: current },
    });
    expect(
      bare.container.querySelector('[data-tx-ds-kit-changes="tokens"]')?.textContent
    ).toContain('Compile both versions to compare tokens.');
  });
});

describe('library sources', () => {
  it('are static and sink-free, with logical CSS', () => {
    const files = readdirSync(LIBRARY_DIR);
    expect(files).toEqual(
      expect.arrayContaining([
        'model.ts',
        'changes-model.ts',
        'KitLibrary.svelte',
        'KitChanges.svelte',
        'ApprovalBadge.svelte',
      ])
    );
    for (const file of files) {
      const source = readFileSync(join(LIBRARY_DIR, file), 'utf8');
      expect(source, file).not.toMatch(/\{@html|innerHTML|set:html|eval\(|new Function|fetch\(/u);
      if (file.endsWith('.css'))
        expect(source, file).not.toMatch(
          /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/u
        );
    }
  });
});
