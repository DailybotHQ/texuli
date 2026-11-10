/**
 * PLAN_016 T-0171-parts: every catalog part maps to its parent; host map()
 * takes a composed map; `@texuli/tools/ds-check/host.iife.js` is exported.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { partParentMap } from '../../catalog/src/manifest/parts.ts';
import { ALL_MANIFEST_GROUPS } from '../../catalog/src/manifests/all.ts';
import { mapDesignSystemTree, resolveAllowedComponentId } from '../src/ds-check/map.ts';

const NAMED: Readonly<Record<string, string>> = {
  'list-item': 'list',
  'field-error': 'field',
  'input-group': 'input',
  'radio-group': 'radio',
  'button-group': 'button',
  'data-dashboard-widget': 'data-dashboard',
};

const ids = ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests.map((entry) => entry.id));
const parts = partParentMap(ids);

describe('catalog part → parent map', () => {
  it('derives every hyphen part from catalog ids and names the required pairs', () => {
    expect(ids.length).toBeGreaterThan(100);
    for (const [part, parent] of Object.entries(NAMED)) {
      expect(ids, part).toContain(part);
      expect(ids, parent).toContain(parent);
      expect(parts[part], part).toBe(parent);
    }
    expect(Object.keys(parts).length).toBeGreaterThan(Object.keys(NAMED).length);
    for (const [part, parent] of Object.entries(parts)) {
      expect(ids).toContain(part);
      expect(ids).toContain(parent);
      expect(part.startsWith(`${parent}-`)).toBe(true);
      expect(resolveAllowedComponentId(part, new Set([parent]))).toBe(parent);
    }
  });
});

let window: Window | undefined;
afterEach(() => {
  window?.happyDOM.close();
  window = undefined;
});

describe('host map() composed map', () => {
  it('covers an extension-composed id when the parent is allowed', () => {
    window = new Window();
    const scope = window.document.createElement('main');
    scope.innerHTML = '<div data-tx-component="kpi">42</div>';
    window.document.body.append(scope);
    const root = scope as unknown as HTMLElement;
    const bare = mapDesignSystemTree(root, {
      allowManifest: { allow: { 'acme:kpi-strip': {} } },
    });
    expect(bare.codes).toContain('not-allowed');
    const covered = mapDesignSystemTree(root, {
      allowManifest: { allow: { 'acme:kpi-strip': {} }, composed: { kpi: 'acme:kpi-strip' } },
      composed: { kpi: 'acme:kpi-strip' },
    });
    expect(covered.ok).toBe(true);
    const host = readFileSync(join(import.meta.dirname, '../src/ds-check/host.ts'), 'utf8');
    expect(host).toContain('composed: input.composed');
  });
});

describe('host IIFE package export', () => {
  it('is listed as @texuli/tools/ds-check/host.iife.js', () => {
    const manifest = JSON.parse(
      readFileSync(join(import.meta.dirname, '../package.json'), 'utf8')
    ) as { exports: Record<string, { default?: string }> };
    expect(manifest.exports['./ds-check/host.iife.js']?.default).toBe(
      './src/ds-check/host.iife.ts'
    );
  });
});
