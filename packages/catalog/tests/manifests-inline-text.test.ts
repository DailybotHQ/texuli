// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import {
  type RenderNode,
  renderCatalogFromBuild,
  renderCatalogTree,
} from '../src/render/renderer/index.ts';

/**
 * Audit G03, plain text in slot-only components: label, description and
 * friends take a `children` snippet and no string label, so a tree gives
 * them text through the sanctioned `inline-text` node. Button, badge and kbd
 * also take a plain-text `label` prop (see the last describe block).
 */

const build = await buildCatalog(await discoverManifestGroups());
const entries = build.catalog.entries;
// Every id here is app chrome, so the host opts in to the developer tier.
const chrome = renderCatalogFromBuild(build.catalog, { developer: 'all' });
const normative = renderCatalogFromBuild(build.catalog);

/**
 * The slot-only components whose visible text is their slot, pinned from
 * the G03 manifest sweep. Containers (menus, popovers, forms) are left out:
 * they hold other components, not a phrase.
 */
const TEXT_SLOT_IDS = [
  'badge',
  'button',
  'context-menu-trigger',
  'description',
  'dropdown-menu-item',
  'dropdown-menu-trigger',
  'field-error',
  'kbd',
  'label',
  'menubar-trigger',
  'select-label',
  'select-trigger',
];

const text = (value: unknown) => ({ id: 'inline-text', props: { text: value } });

function render(tree: unknown, catalog = chrome, tier: 'developer' | 'untrusted' = 'developer') {
  return renderCatalogTree(tree, { catalog, tier });
}

describe('inline-text (audit G03)', () => {
  it('inline-text is a required-string leaf that labels text slots, drops bad text and follows the tier contract', () => {
    // is a catalog entry with one required string prop
    {
      const entry = entries.find((e) => e.id === 'inline-text');
      expect(entry).toMatchObject({ group: 'display', tier: 'app', agentEmittable: false });
      expect(entry?.props).toEqual([
        expect.objectContaining({ name: 'text', kind: 'string', required: true }),
      ]);
    }
    for (const id of TEXT_SLOT_IDS) {
      const entry = entries.find((e) => e.id === id);
      expect(entry, id).toBeDefined();
      expect(entry?.props.find((p) => p.name === 'children')?.kind, id).toBe('slot');
      const result = render({ id, props: {}, children: [text('Save changes')] });
      expect(result.diagnostics, id).toEqual([]);
      expect(result.roots[0]).toEqual({
        kind: 'component',
        id,
        props: {},
        children: [
          { kind: 'component', id: 'inline-text', props: { text: 'Save changes' }, children: [] },
        ],
      });
    }
    // gives the audit 03 settings button its label
    {
      const result = render({
        id: 'button',
        props: { type: 'submit' },
        children: [text('Save changes')],
      });
      expect(result.diagnostics).toEqual([]);
      const root = result.roots[0] as Extract<RenderNode, { kind: 'component' }>;
      expect(root.children.map((c) => c.kind === 'component' && c.props.text)).toEqual([
        'Save changes',
      ]);
    }
    // is a leaf: children are dropped with a diagnostic
    {
      const result = render({
        id: 'inline-text',
        props: { text: 'Save' },
        children: [text('nested')],
      });
      expect(result.roots[0]).toMatchObject({ kind: 'component', children: [] });
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ code: 'invalid-node', id: 'inline-text', path: '0' }),
      ]);
    }
    for (const value of [undefined, 42, '<b>Save</b>']) {
      const result = render({ id: 'button', props: {}, children: [text(value)] });
      const root = result.roots[0] as Extract<RenderNode, { kind: 'component' }>;
      expect(root.children, String(value)).toEqual([]);
      expect(
        result.diagnostics.map((d) => d.code),
        String(value)
      ).toContain('schema-failure');
    }
    // follows the tier contract like the components it labels
    {
      const tree = text('Save');
      expect(render(tree, normative).roots[0]).toMatchObject({ reason: 'tier-denied' });
      expect(render(tree, chrome, 'untrusted').roots[0]).toMatchObject({ reason: 'tier-denied' });
      expect(render(tree, chrome).roots[0]).toMatchObject({ kind: 'component' });
    }
  });
});

describe('the label prop on button, badge and kbd (G03)', () => {
  it('button, badge and kbd take an optional plain label, admitted only where app chrome is', () => {
    for (const id of ['button', 'badge', 'kbd']) {
      const entry = entries.find((e) => e.id === id);
      const label = entry?.props.find((p) => p.name === 'label');
      expect(label, id).toMatchObject({ kind: 'string' });
      expect(label?.required, id).toBeUndefined();
      expect(entry?.props.find((p) => p.name === 'children')?.kind, id).toBe('slot');
    }
    // accepts the audit 03 probe for a host that admits app chrome
    {
      const probe = { id: 'button', props: { type: 'submit', label: 'Save changes' } };
      const result = render(probe);
      expect(result.diagnostics).toEqual([]);
      expect(result.roots[0]).toMatchObject({
        kind: 'component',
        props: { type: 'submit', label: 'Save changes' },
      });
    }
    // still denies the probe at the normative D5 developer tier and at untrusted
    {
      // button is app chrome, not agentEmittable: the label prop changes no tier.
      const probe = { id: 'button', props: { type: 'submit', label: 'Save changes' } };
      expect(render(probe, normative).roots[0]).toMatchObject({ reason: 'tier-denied' });
      expect(render(probe, chrome, 'untrusted').roots[0]).toMatchObject({ reason: 'tier-denied' });
    }
    for (const [id, label] of [
      ['badge', 'Shipped'],
      ['kbd', 'Ctrl'],
    ]) {
      const result = render({ id, props: { label } });
      expect(result.diagnostics, id).toEqual([]);
      expect(result.roots[0], id).toMatchObject({ kind: 'component', props: { label } });
    }
    // refuses a markup-like label
    {
      const result = render({ id: 'button', props: { label: '<b>Save</b>' } });
      expect(result.diagnostics.map((d) => d.code)).toContain('schema-failure');
    }
  });
});
