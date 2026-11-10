/**
 * T-017-kit: Svelte-free kit models live in `@texuli/spec/design-system` and
 * `texuli/ds-kit` re-exports them; KitAllowManifest.library matches the compiled
 * `{ id, status, version }` entries; the matrix groups a large allow into
 * collapsible, lazily mounted sections.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render } from '@testing-library/svelte';
import {
  changesModel as specChangesModel,
  kitApproval as specKitApproval,
} from '@texuli/spec/design-system';
import { compileAllowManifest } from '@texuli/tokens/design-system/compile-core';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  changesModel,
  type KitAllowManifest,
  KitMatrix,
  kitApproval,
  MATRIX_LAZY_THRESHOLD,
  matrixGroupOpenByDefault,
  matrixGroups,
  matrixModel,
} from '../src/ds-kit/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

afterEach(() => cleanup());

const catalogOf = (count: number) => ({
  catalogHash: 'test',
  components: Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    label: `Item ${i}`,
    summary: `Item ${i}`,
    group: `group-${Math.floor(i / 10)}`,
    props: [],
  })),
});

const allowOf = (count: number): KitAllowManifest => ({
  version: '1.0.0',
  allow: Object.fromEntries(Array.from({ length: count }, (_, i) => [`item-${i}`, {}])),
});

describe('Svelte-free kit models', () => {
  it('exports changesModel and kitApproval from @texuli/spec/design-system, re-exported by texuli/ds-kit', () => {
    const kit = readFileSync(resolve(ROOT, 'packages/spec/src/design-system/kit.ts'), 'utf8');
    expect(kit).not.toMatch(/from ['"]svelte['"]/);
    const specIndex = readFileSync(
      resolve(ROOT, 'packages/spec/src/design-system/index.ts'),
      'utf8'
    );
    expect(specIndex).toContain('changesModel');
    expect(specIndex).toContain('kitApproval');
    expect(
      readFileSync(resolve(ROOT, 'packages/texuli/src/ds-kit/shared/approval.ts'), 'utf8')
    ).toContain('@texuli/spec/design-system');
    expect(
      readFileSync(resolve(ROOT, 'packages/texuli/src/ds-kit/library/changes-model.ts'), 'utf8')
    ).toContain('@texuli/spec/design-system');
    const doc = { version: '1.0.0', approval: { status: 'draft', version: '1.0.0' } };
    expect(kitApproval(doc)).toEqual(specKitApproval(doc));
    expect(changesModel({ document: doc }, { document: doc }).allow).toEqual(
      specChangesModel({ document: doc }, { document: doc }).allow
    );
  });
});

describe('KitAllowManifest.library', () => {
  it('matches the compiled allowManifest.library entries ({ id, status, version })', () => {
    const compiled = compileAllowManifest({
      version: '2.0.0',
      library: [
        { id: 'pricing-card', name: 'Pricing card', version: '0.3.0', status: 'draft' },
        { id: 'stat-tile', name: 'Stat tile', version: '1.0.0', status: 'approved' },
      ],
    });
    const library: KitAllowManifest['library'] = compiled.library;
    expect(library).toEqual([
      { id: 'pricing-card', version: '0.3.0', status: 'draft' },
      { id: 'stat-tile', version: '1.0.0', status: 'approved' },
    ]);
    const manifest: KitAllowManifest = {
      version: compiled.version,
      contentHash: compiled.contentHash,
      library,
    };
    expect(manifest.library?.[0]).toEqual({
      id: 'pricing-card',
      version: '0.3.0',
      status: 'draft',
    });
  });
});

describe('lazy collapsible matrix groups', () => {
  it('keeps a small allow fully open and crawlable', () => {
    const catalog = catalogOf(8);
    const allow = allowOf(8);
    const model = matrixModel(catalog, allow);
    expect(model.enabled).toHaveLength(8);
    expect(model.enabled.length).toBeLessThanOrEqual(MATRIX_LAZY_THRESHOLD);
    const groups = matrixGroups(model);
    expect(groups.every((_, i) => matrixGroupOpenByDefault(model, i))).toBe(true);
    const { container } = render(KitMatrix, { props: { catalog, allow, modeView: 'light' } });
    expect(container.querySelectorAll('[data-tx-ds-kit-group]')).toHaveLength(groups.length);
    expect(container.querySelectorAll('[data-tx-ds-kit-group-open="true"]')).toHaveLength(
      groups.length
    );
    expect(
      [...container.querySelectorAll('[data-tx-ds-kit-component]')].map((el) =>
        el.getAttribute('data-tx-ds-kit-component')
      )
    ).toEqual(model.enabled.map((c) => c.id));
  });

  it('closes groups beyond the threshold on a 251-key allow and mounts on open', async () => {
    const catalog = catalogOf(251);
    const allow = allowOf(251);
    const model = matrixModel(catalog, allow);
    expect(model.enabled).toHaveLength(251);
    const groups = matrixGroups(model);
    expect(groups.length).toBeGreaterThan(1);
    expect(matrixGroupOpenByDefault(model, 0)).toBe(true);
    expect(matrixGroupOpenByDefault(model, 1)).toBe(false);
    const { container } = render(KitMatrix, { props: { catalog, allow, modeView: 'light' } });
    expect(
      container
        .querySelector('[data-tx-ds-kit-group="group-0"]')
        ?.getAttribute('data-tx-ds-kit-group-open')
    ).toBe('true');
    expect(
      container
        .querySelector('[data-tx-ds-kit-group="group-1"]')
        ?.getAttribute('data-tx-ds-kit-group-open')
    ).toBe('false');
    const openIds = [...container.querySelectorAll('[data-tx-ds-kit-component]')].map((el) =>
      el.getAttribute('data-tx-ds-kit-component')
    );
    expect(openIds).toEqual(groups[0]?.components.map((c) => c.id));
    expect(container.querySelector('[data-tx-ds-kit-component="item-10"]')).toBeNull();
    const closed = container.querySelector('[data-tx-ds-kit-group="group-1"]');
    expect(closed).toBeInstanceOf(HTMLDetailsElement);
    if (!(closed instanceof HTMLDetailsElement)) throw new Error('group-1');
    closed.open = true;
    closed.dispatchEvent(new Event('toggle'));
    await tick();
    expect(
      container
        .querySelector('[data-tx-ds-kit-group="group-1"]')
        ?.getAttribute('data-tx-ds-kit-group-open')
    ).toBe('true');
    expect(container.querySelector('[data-tx-ds-kit-component="item-10"]')).not.toBeNull();
    expect(container.querySelector('[data-tx-ds-kit-component="item-19"]')).not.toBeNull();
  });
});
