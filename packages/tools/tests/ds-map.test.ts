// @vitest-environment node
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DS_MAP_MAX_ISSUES,
  DS_MAP_NOT_ALLOWED,
  DS_MAP_UNMAPPED,
  dsMapSelector,
  mapDesignSystemTree,
} from '../src/ds-check/map.ts';

const ATTR = 'data-tx-component';

let window: Window | undefined;
afterEach(() => {
  window?.happyDOM.close();
  window = undefined;
});

function doc(): Document {
  window ??= new Window();
  return window.document as unknown as Document;
}

function h(
  tag: string,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElement {
  const el = doc().createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  for (const child of children)
    el.append(typeof child === 'string' ? doc().createTextNode(child) : child);
  return el;
}

function mount(...children: Node[]): HTMLElement {
  const root = h('div', { id: 'scope' });
  root.append(...children);
  doc().body.append(root);
  return root;
}

const allow = (ids: readonly string[]) => ({
  allow: Object.fromEntries(ids.map((id) => [id, {}])),
});

describe('mapDesignSystemTree', () => {
  it('passes an allowed catalog root that owns its control', () => {
    const button = h('button', { [ATTR]: 'button', type: 'button' }, 'Save');
    const root = mount(button);
    const report = mapDesignSystemTree(root, { allowManifest: allow(['button']) });
    expect(report).toEqual({ ok: true, codes: [], errors: [] });
  });

  it('flags an interactive element with no catalog root as unmapped, with a selector', () => {
    const stray = h('button', { type: 'button', class: 'local' }, 'Invented');
    const root = mount(h('main', {}, stray));
    const report = mapDesignSystemTree(root, { allowManifest: allow(['button']) });
    expect(report.ok).toBe(false);
    expect(report.codes).toEqual([DS_MAP_UNMAPPED]);
    expect(report.errors).toHaveLength(1);
    const issue = report.errors[0];
    expect(issue?.code).toBe(DS_MAP_UNMAPPED);
    expect(issue?.message).toMatch(/not inside a catalog component root/i);
    expect(root.querySelector(issue?.path ?? '')).toBe(stray);
    expect(dsMapSelector(stray, root)).toBe(issue?.path);
  });

  it('flags a catalog root outside the allow manifest as not-allowed', () => {
    const card = h('article', { [ATTR]: 'card' }, h('p', {}, 'Hello'));
    const root = mount(card);
    const report = mapDesignSystemTree(root, { allowManifest: allow(['button']) });
    expect(report.ok).toBe(false);
    expect(report.codes).toEqual([DS_MAP_NOT_ALLOWED]);
    expect(report.errors).toEqual([
      expect.objectContaining({
        code: DS_MAP_NOT_ALLOWED,
        source: 'card',
        message: 'Component "card" is not in the allow manifest.',
      }),
    ]);
    expect(root.querySelector(report.errors[0]?.path ?? '')).toBe(card);
  });

  it('does not also flag inner controls of a not-allowed root as unmapped', () => {
    const inner = h('button', { type: 'button' }, 'In card');
    const card = h('article', { [ATTR]: 'card' }, inner);
    const root = mount(card);
    const report = mapDesignSystemTree(root, { allowManifest: allow(['button']) });
    expect(report.codes).toEqual([DS_MAP_NOT_ALLOWED]);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.source).toBe('card');
  });

  it('leaves mapped controls and extra roots alone when the document is not locked', () => {
    const button = h('button', { [ATTR]: 'button', type: 'button' }, 'Save');
    const card = h('article', { [ATTR]: 'card' }, h('p', {}, 'Hello'));
    const root = mount(button, card);
    expect(mapDesignSystemTree(root)).toEqual({ ok: true, codes: [], errors: [] });
    expect(mapDesignSystemTree(root, { allowManifest: {} })).toEqual({
      ok: true,
      codes: [],
      errors: [],
    });
  });

  it('still flags unmapped controls when the document is not locked', () => {
    const stray = h('a', { href: 'https://example.com' }, 'Link');
    const root = mount(stray);
    const report = mapDesignSystemTree(root);
    expect(report.codes).toEqual([DS_MAP_UNMAPPED]);
    expect(root.querySelector(report.errors[0]?.path ?? '')).toBe(stray);
  });

  it('treats an empty allow object as locked with nothing allowed', () => {
    const button = h('button', { [ATTR]: 'button', type: 'button' }, 'Save');
    const root = mount(button);
    const report = mapDesignSystemTree(root, { allowManifest: { allow: {} } });
    expect(report.codes).toEqual([DS_MAP_NOT_ALLOWED]);
    expect(report.errors[0]?.source).toBe('button');
  });

  it('skips hidden inputs and reports ARIA widgets', () => {
    const hidden = h('input', { type: 'hidden', name: 'csrf', value: 'x' });
    const tab = h('div', { role: 'tab', tabindex: '0' }, 'Overview');
    const root = mount(hidden, tab);
    const report = mapDesignSystemTree(root, { allowManifest: allow(['button']) });
    expect(report.codes).toEqual([DS_MAP_UNMAPPED]);
    expect(report.errors).toHaveLength(1);
    expect(root.querySelector(report.errors[0]?.path ?? '')).toBe(tab);
  });

  it('sorts mixed findings by code then selector and keeps codes stable', () => {
    const stray = h('button', { type: 'button', id: 'stray' }, 'Local');
    const card = h('section', { [ATTR]: 'card', id: 'card' }, 'Body');
    const root = mount(stray, card);
    const report = mapDesignSystemTree(root, { allowManifest: allow(['button']) });
    expect(report.codes).toEqual([DS_MAP_NOT_ALLOWED, DS_MAP_UNMAPPED]);
    expect(report.errors.map((issue) => issue.code)).toEqual([DS_MAP_NOT_ALLOWED, DS_MAP_UNMAPPED]);
    expect(report.errors[0]?.path).toContain('#card');
    expect(report.errors[1]?.path).toContain('#stray');
  });

  it('caps the issue list', () => {
    const root = mount(
      ...Array.from({ length: DS_MAP_MAX_ISSUES + 8 }, (_, i) =>
        h('button', { type: 'button', id: `b${i}` }, 'x')
      )
    );
    const report = mapDesignSystemTree(root, { allowManifest: allow(['button']) });
    expect(report.errors).toHaveLength(DS_MAP_MAX_ISSUES);
    expect(report.ok).toBe(false);
  });
});
