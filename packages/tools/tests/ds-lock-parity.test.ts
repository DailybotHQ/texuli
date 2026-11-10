/**
 * The runtime lock matches the static one (PLAN_016 T-0172-lock, amendment r32, from the
 * Protoyard 0.17.1 adoption findings):
 *
 * 1. for EVERY catalog id, the render mapper and the static usage check resolve the same
 *    parent, from the declared catalog relation (a part ships in its parent's public module),
 *    never from a hyphen prefix: alert-dialog, icon-button, avatar-group-grid, text-counter,
 *    code-field, form-field and form-submit are their own ids;
 * 2. `mapLockedRenderPage` forwards the whole `DsMapAllowManifest` (`composed` included) to
 *    the host's `map`;
 * 3. an axis list that is not an array is read in its declared shape (a single value or an
 *    object), never as "nothing enabled", by both checks.
 */
import { Window } from 'happy-dom';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { IMPORTS_BY_ID } from '../../catalog/src/manifest/imports.ts';
import { CATALOG_PART_PARENTS, partParentMap } from '../../catalog/src/manifest/parts.ts';
import { loadMergedCatalog } from '../src/ds-check/extensions.ts';
import { mapLockedRenderPage } from '../src/ds-check/locked-render.ts';
import { checkLockedUsage, type LockedCatalog } from '../src/ds-check/locked-static.ts';
import {
  DS_MAP_COMPOUND_PARENTS,
  DS_MAP_PART_PARENTS,
  dsAllowAxisValues,
  dsCatalogPartParent,
  mapDesignSystemTree,
} from '../src/ds-check/map.ts';
import type { DsCheckPage } from '../src/ds-check/render.ts';
import { DS_CHECK_GLOBAL } from '../src/ds-check/types.ts';

const OWN_IDS = [
  'alert-dialog',
  'icon-button',
  'avatar-group-grid',
  'text-counter',
  'code-field',
  'form-field',
  'form-submit',
] as const;

let catalog: LockedCatalog;
let ids: string[];
beforeAll(async () => {
  catalog = (await loadMergedCatalog([])).catalog as unknown as LockedCatalog;
  ids = catalog.components.map((component) => component.id);
});

let window: Window | undefined;
afterEach(async () => {
  await window?.happyDOM.close();
  window = undefined;
});

function tree(markup: string): HTMLElement {
  window ??= new Window();
  const scope = window.document.createElement('main');
  // Test fixture markup (fictional, built from catalog ids), parsed by happy-dom.
  scope.innerHTML = markup;
  window.document.body.append(scope);
  return scope as unknown as HTMLElement;
}

const runtimeOk = (markup: string, allow: Record<string, unknown>) =>
  mapDesignSystemTree(tree(markup), { allowManifest: { allow } }).ok;
const staticOk = (component: string, allow: Record<string, Record<string, unknown>>, props = {}) =>
  checkLockedUsage([{ component, props, location: { path: '$' } }], {
    catalog,
    allowManifest: { allow },
  }).ok;

/** Every catalog id `id` starts with plus `-`: the candidates a hyphen rule would pick. */
const hyphenCandidates = (id: string) => ids.filter((other) => id.startsWith(`${other}-`));

describe('every catalog id resolves the same parent in the render and the static check', () => {
  it('reads one declared relation, shared by the catalog and the render mapper', () => {
    expect(ids.length).toBeGreaterThan(150);
    expect(DS_MAP_PART_PARENTS).toEqual(CATALOG_PART_PARENTS);
    expect([...DS_MAP_COMPOUND_PARENTS]).toEqual(
      [...new Set(Object.values(CATALOG_PART_PARENTS))].sort()
    );
    const declared = partParentMap(ids);
    for (const id of ids) expect(dsCatalogPartParent(id), id).toBe(declared[id]);
    // Each declared part ships in its parent's public subpath module (the static check's data).
    const modules = (id: string) =>
      new Set(
        (IMPORTS_BY_ID[id] ?? []).map((entry) => entry.module).filter((m) => m.includes('/'))
      );
    for (const [part, parent] of Object.entries(declared)) {
      const shared = [...modules(part)].filter((module) => modules(parent).has(module));
      expect(shared.length, `${part} → ${parent}`).toBeGreaterThan(0);
    }
  });

  it('covers an id by a parent in both checks exactly when the relation declares it', () => {
    let declaredPairs = 0;
    let refusedPairs = 0;
    for (const id of ids) {
      const declared = dsCatalogPartParent(id);
      const parents = new Set([...hyphenCandidates(id), ...(declared ? [declared] : [])]);
      for (const parent of parents) {
        const allow = { [parent]: {} };
        const expected = parent === declared;
        const alone = runtimeOk(`<div data-tx-component="${id}"></div>`, allow);
        const nested = runtimeOk(
          `<div data-tx-component="${parent}"><div data-tx-component="${id}"></div></div>`,
          allow
        );
        const checked = staticOk(id, allow);
        expect([alone, nested, checked], `${id} under ${parent}`).toEqual([
          expected,
          expected,
          expected,
        ]);
        if (expected) declaredPairs++;
        else refusedPairs++;
      }
    }
    expect(declaredPairs).toBe(Object.keys(CATALOG_PART_PARENTS).length);
    expect(refusedPairs).toBeGreaterThanOrEqual(OWN_IDS.length);
  });

  it('keeps the seven reported ids their own: no parent, refused under the hyphen prefix', () => {
    const wrong: Record<string, string> = {
      'alert-dialog': 'alert',
      'icon-button': 'icon',
      'avatar-group-grid': 'avatar',
      'text-counter': 'text',
      'code-field': 'code',
      'form-field': 'form',
      'form-submit': 'form',
    };
    for (const id of OWN_IDS) {
      expect(ids, id).toContain(id);
      expect(dsCatalogPartParent(id), id).toBeUndefined();
      expect(partParentMap(ids)[id], id).toBeUndefined();
      const allow = { [wrong[id] as string]: {} };
      expect(runtimeOk(`<div data-tx-component="${id}"></div>`, allow), id).toBe(false);
      expect(staticOk(id, allow), id).toBe(false);
      // Their own allow key still covers them in both checks.
      expect(runtimeOk(`<div data-tx-component="${id}"></div>`, { [id]: {} }), id).toBe(true);
      expect(staticOk(id, { [id]: {} }), id).toBe(true);
    }
  });

  it('resolves a namespaced part to its namespaced parent', () => {
    expect(dsCatalogPartParent('acme:select-trigger')).toBe('acme:select');
    expect(dsCatalogPartParent('acme:alert-dialog')).toBeUndefined();
    expect(
      runtimeOk('<div data-tx-component="acme:select-trigger"></div>', { 'acme:select': {} })
    ).toBe(true);
    expect(
      runtimeOk('<div data-tx-component="acme:alert-dialog"></div>', { 'acme:alert': {} })
    ).toBe(false);
  });

  it('never reads an inherited composed key', () => {
    const report = mapDesignSystemTree(tree('<div data-tx-component="constructor"></div>'), {
      allowManifest: { allow: { card: {} }, composed: {} },
    });
    expect(report.codes).toEqual(['not-allowed']);
  });
});

describe('mapLockedRenderPage forwards the whole allow manifest to host.map', () => {
  function fakePage(received: unknown[]): DsCheckPage {
    const host = {
      map(input: unknown) {
        received.push(input);
        return { ok: true, codes: [], errors: [] };
      },
    };
    const page = {
      waitForFunction: async () => undefined,
      evaluate: async (fn: (arg: unknown) => unknown, arg: unknown) => {
        const saved = (globalThis as Record<string, unknown>)[DS_CHECK_GLOBAL];
        (globalThis as Record<string, unknown>)[DS_CHECK_GLOBAL] = host;
        try {
          return fn(arg);
        } finally {
          if (saved === undefined) delete (globalThis as Record<string, unknown>)[DS_CHECK_GLOBAL];
          else (globalThis as Record<string, unknown>)[DS_CHECK_GLOBAL] = saved;
        }
      },
    };
    return page as unknown as DsCheckPage;
  }

  it('passes composed with allow, and nothing it was not given', async () => {
    const received: unknown[] = [];
    const manifest = { allow: { 'acme:kpi-strip': {} }, composed: { kpi: 'acme:kpi-strip' } };
    await mapLockedRenderPage(fakePage(received), manifest);
    await mapLockedRenderPage(fakePage(received), { allow: { card: {} } });
    await mapLockedRenderPage(fakePage(received));
    expect(received).toEqual([manifest, { allow: { card: {} } }, {}]);
  });
});

describe('an axis list is read in its declared shape by both checks', () => {
  const SHAPES: readonly [string, unknown, readonly string[] | undefined][] = [
    ['a list', ['ghost'], ['ghost']],
    ['a single value', 'ghost', ['ghost']],
    ['an object with values', { values: ['ghost'] }, ['ghost']],
    ['a value map', { ghost: true, default: false }, ['ghost']],
    ['an empty list (none)', [], []],
    ['an empty object (omitted)', {}, undefined],
    ['a number (omitted)', 3, undefined],
  ];

  it.each(SHAPES)('%s', (_name, listed, enabled) => {
    expect(dsAllowAxisValues(listed)).toEqual(enabled);
    const allow = { button: { variants: listed } };
    for (const variant of ['ghost', 'default']) {
      const expected = enabled === undefined || enabled.includes(variant);
      const painted = runtimeOk(
        `<div data-tx-component="button" data-tx-variant="${variant}"></div>`,
        allow
      );
      const checked = staticOk('button', allow, { variant });
      expect([painted, checked], `${variant}`).toEqual([expected, expected]);
    }
  });

  it('a single value or a map is never read as nothing enabled', () => {
    expect(dsAllowAxisValues('sm')).toEqual(['sm']);
    expect(dsAllowAxisValues({ sm: true })).toEqual(['sm']);
    const report = mapDesignSystemTree(
      tree('<div data-tx-component="button" data-tx-size="sm"></div>'),
      { allowManifest: { allow: { button: { sizes: 'sm' } } } }
    );
    expect(report.ok).toBe(true);
  });
});
