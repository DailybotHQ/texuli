import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeInertTargets,
  createInertRegistry,
  getInertRegistry,
  INERT_REGISTRY_GLOBAL_KEY,
  type InertRegistryGlobal,
  resetInertRegistry,
} from '../src/index.ts';

/**
 * A page shaped like a real app:
 *
 *   body
 *   ├── header#header
 *   ├── main#app
 *   │   ├── nav#nav
 *   │   └── section#content > button#open
 *   ├── div#portal > div#dialog > button#inside
 *   ├── section#toasts (aria-live)
 *   ├── div#announcer
 *   └── script
 */
function buildPage() {
  document.body.replaceChildren();
  const make = (tag: string, id: string, parent: Element) => {
    const element = document.createElement(tag);
    element.id = id;
    parent.append(element);
    return element;
  };
  const body = document.body;
  const header = make('header', 'header', body);
  const app = make('main', 'app', body);
  const nav = make('nav', 'nav', app);
  const content = make('section', 'content', app);
  const open = make('button', 'open', content);
  const portal = make('div', 'portal', body);
  const dialog = make('div', 'dialog', portal);
  const inside = make('button', 'inside', dialog);
  const toasts = make('section', 'toasts', body);
  toasts.setAttribute('aria-live', 'polite');
  const announcer = make('div', 'announcer', body);
  const script = document.createElement('script');
  body.append(script);
  return {
    body,
    header,
    app,
    nav,
    content,
    open,
    portal,
    dialog,
    inside,
    toasts,
    announcer,
    script,
  };
}

const ids = (elements: readonly Element[]) => elements.map((element) => element.id).sort();
const inertIds = () => ids(Array.from(document.querySelectorAll('[inert]')));

/** Snapshot of the attributes this texel may touch, for exact-restore checks. */
function attributeSnapshot(): string {
  return Array.from(document.body.querySelectorAll('*'))
    .map(
      (element) =>
        `${element.tagName}#${element.id}:${element.getAttribute('inert')}:${element.getAttribute('aria-hidden')}`
    )
    .join('|');
}

describe('computeInertTargets', () => {
  it('returns the siblings along the path to the layer, never its ancestors', () => {
    const page = buildPage();
    const targets = computeInertTargets(page.body, [page.dialog]);
    expect(ids(targets)).toEqual(['announcer', 'app', 'header', 'toasts']);
    expect(targets).not.toContain(page.portal);
    expect(targets).not.toContain(page.body);
  });

  it('keeps exemptions and their ancestors out of the target list', () => {
    const page = buildPage();
    const targets = computeInertTargets(page.body, [page.dialog, page.toasts, page.nav]);
    // `app` contains the exempt `nav`, so the texel descends and takes only `content`.
    expect(ids(targets)).toEqual(['announcer', 'content', 'header']);
  });

  it('skips non-rendered elements such as script and template', () => {
    const page = buildPage();
    const template = document.createElement('template');
    page.body.append(template);
    const targets = computeInertTargets(page.body, [page.dialog]);
    expect(targets).not.toContain(page.script);
    expect(targets).not.toContain(template);
  });

  it('writes nothing to the DOM', () => {
    const page = buildPage();
    const before = attributeSnapshot();
    computeInertTargets(page.body, [page.dialog, page.toasts]);
    expect(attributeSnapshot()).toBe(before);
  });

  it('treats a kept element outside the root as keeping nothing under it', () => {
    const page = buildPage();
    const detached = document.createElement('div');
    expect(ids(computeInertTargets(page.app, [detached]))).toEqual(['content', 'nav']);
  });
});

describe('createInertRegistry: one modal scope', () => {
  beforeEach(() => buildPage());

  it('makes everything outside the layer inert and restores exactly on release', () => {
    const page = buildPage();
    const before = attributeSnapshot();
    const registry = createInertRegistry();
    const scope = registry.inertOutside(page.dialog, { label: 'dialog' });

    expect(inertIds()).toEqual(['announcer', 'app', 'header', 'toasts']);
    expect(page.dialog.hasAttribute('inert')).toBe(false);
    expect(page.portal.hasAttribute('inert')).toBe(false);
    expect(page.inside.closest('[inert]')).toBeNull();
    expect(page.open.closest('[inert]')).toBe(page.app);
    expect(scope.isActive()).toBe(true);
    expect(registry.size()).toBe(1);

    scope.release();
    expect(inertIds()).toEqual([]);
    expect(attributeSnapshot()).toBe(before);
    expect(registry.size()).toBe(0);
    expect(registry.inertElements()).toEqual([]);
  });

  it('keeps registered exemptions reachable outside the modal (R16)', () => {
    const page = buildPage();
    const registry = createInertRegistry();
    registry.exempt({ element: page.toasts, label: 'toast-region' });
    registry.exempt({ element: page.announcer, label: 'announcer' });
    registry.inertOutside(page.dialog);

    expect(inertIds()).toEqual(['app', 'header']);
    expect(page.toasts.closest('[inert]')).toBeNull();
    expect(page.announcer.closest('[inert]')).toBeNull();
    expect(registry.isExempt(page.toasts)).toBe(true);
    expect(registry.exemptions().map((entry) => entry.label)).toEqual([
      'toast-region',
      'announcer',
    ]);
  });

  it('keeps an exemption nested deep in the app reachable without exposing its siblings', () => {
    const page = buildPage();
    const registry = createInertRegistry();
    registry.exempt({ element: page.nav });
    registry.inertOutside(page.dialog);
    expect(page.app.hasAttribute('inert')).toBe(false);
    expect(page.nav.closest('[inert]')).toBeNull();
    expect(page.content.hasAttribute('inert')).toBe(true);
  });

  it('never removes an inert or aria-hidden attribute the author set', () => {
    const page = buildPage();
    page.header.setAttribute('inert', 'inert');
    page.app.setAttribute('aria-hidden', 'false');
    const before = attributeSnapshot();
    const registry = createInertRegistry();
    const scope = registry.inertOutside(page.dialog, { ariaHidden: true });
    // Already inert: left exactly as the author wrote it, not rewritten.
    expect(page.header.getAttribute('inert')).toBe('inert');
    expect(page.app.getAttribute('aria-hidden')).toBe('true');

    scope.release();
    expect(page.header.getAttribute('inert')).toBe('inert');
    expect(page.app.getAttribute('aria-hidden')).toBe('false');
    expect(attributeSnapshot()).toBe(before);
  });

  it('sets aria-hidden only when asked', () => {
    const page = buildPage();
    const registry = createInertRegistry();
    const plain = registry.inertOutside(page.dialog);
    expect(page.app.hasAttribute('aria-hidden')).toBe(false);
    plain.release();
    registry.inertOutside(page.dialog, { ariaHidden: true });
    expect(page.app.getAttribute('aria-hidden')).toBe('true');
    expect(page.dialog.hasAttribute('aria-hidden')).toBe(false);
  });

  it('limits the effect to a given root', () => {
    const page = buildPage();
    const registry = createInertRegistry();
    registry.inertOutside(page.content, { root: page.app });
    expect(inertIds()).toEqual(['nav']);
  });

  it('has an idempotent release', () => {
    const page = buildPage();
    const registry = createInertRegistry();
    const scope = registry.inertOutside(page.dialog);
    scope.release();
    page.header.setAttribute('inert', '');
    scope.release();
    expect(page.header.getAttribute('inert')).toBe('');
    expect(scope.isActive()).toBe(false);
  });

  it('rejects a non-element layer, root or exemption', () => {
    const registry = createInertRegistry();
    expect(() => registry.inertOutside(null as unknown as Element)).toThrow(TypeError);
    expect(() => registry.inertOutside(document.body, { root: {} as unknown as Element })).toThrow(
      TypeError
    );
    expect(() => registry.exempt({ element: 'toasts' as unknown as Element })).toThrow(TypeError);
  });
});

describe('createInertRegistry: exemptions while a modal is open', () => {
  it('applies an exemption registered after the modal opened, and re-inerts on release', () => {
    const page = buildPage();
    const registry = createInertRegistry();
    const scope = registry.inertOutside(page.dialog);
    expect(page.toasts.hasAttribute('inert')).toBe(true);

    const exemption = registry.exempt({ element: page.toasts });
    expect(page.toasts.hasAttribute('inert')).toBe(false);

    exemption.release();
    exemption.release();
    expect(page.toasts.hasAttribute('inert')).toBe(true);
    expect(registry.exemptions()).toEqual([]);

    scope.release();
    expect(inertIds()).toEqual([]);
  });

  it('moves the inert marks down when an exemption appears inside an inert subtree', () => {
    const page = buildPage();
    const registry = createInertRegistry();
    registry.inertOutside(page.dialog);
    expect(page.app.hasAttribute('inert')).toBe(true);
    registry.exempt({ element: page.nav });
    expect(page.app.hasAttribute('inert')).toBe(false);
    expect(page.content.hasAttribute('inert')).toBe(true);
  });
});

describe('createInertRegistry: nested scopes', () => {
  it('lets only the topmost scope decide, and restores the one below on close', () => {
    const page = buildPage();
    const before = attributeSnapshot();
    const nested = document.createElement('div');
    nested.id = 'nested';
    page.body.append(nested);
    const registry = createInertRegistry();
    registry.exempt({ element: page.toasts });

    const outer = registry.inertOutside(page.dialog, { label: 'dialog' });
    expect(inertIds()).toEqual(['announcer', 'app', 'header', 'nested']);

    const inner = registry.inertOutside(nested, { label: 'confirm' });
    expect(inner.isActive()).toBe(true);
    expect(outer.isActive()).toBe(false);
    // The outer dialog is now outside the top layer, so it becomes inert too.
    expect(inertIds()).toEqual(['announcer', 'app', 'header', 'portal']);
    expect(page.toasts.hasAttribute('inert')).toBe(false);

    inner.release();
    expect(outer.isActive()).toBe(true);
    expect(inertIds()).toEqual(['announcer', 'app', 'header', 'nested']);

    outer.release();
    nested.remove();
    expect(attributeSnapshot()).toBe(before);
  });

  it('keeps the top scope in effect when a lower scope closes first', () => {
    const page = buildPage();
    const nested = document.createElement('div');
    nested.id = 'nested';
    page.body.append(nested);
    const registry = createInertRegistry();
    const outer = registry.inertOutside(page.dialog);
    const inner = registry.inertOutside(nested);
    const during = inertIds();

    outer.release();
    expect(registry.size()).toBe(1);
    expect(inertIds()).toEqual(during);
    expect(inner.isActive()).toBe(true);

    inner.release();
    expect(inertIds()).toEqual([]);
  });

  it('keeps each element’s original value across scopes that both touch it', () => {
    const page = buildPage();
    page.header.setAttribute('aria-hidden', 'false');
    const nested = document.createElement('div');
    page.body.append(nested);
    const registry = createInertRegistry();
    const outer = registry.inertOutside(page.dialog, { ariaHidden: true });
    const inner = registry.inertOutside(nested, { ariaHidden: false });
    // The inner scope does not ask for aria-hidden, so the author's value is back.
    expect(page.header.getAttribute('aria-hidden')).toBe('false');
    inner.release();
    expect(page.header.getAttribute('aria-hidden')).toBe('true');
    outer.release();
    expect(page.header.getAttribute('aria-hidden')).toBe('false');
    expect(page.header.hasAttribute('inert')).toBe(false);
  });
});

describe('createInertRegistry: DOM changes', () => {
  it('refresh() covers content added after the modal opened', () => {
    const page = buildPage();
    const registry = createInertRegistry();
    registry.inertOutside(page.dialog);
    const late = document.createElement('aside');
    late.id = 'late';
    page.body.append(late);
    expect(late.hasAttribute('inert')).toBe(false);
    registry.refresh();
    expect(late.hasAttribute('inert')).toBe(true);
  });

  it('observe: true makes new outside content inert without a manual refresh', async () => {
    const page = buildPage();
    const registry = createInertRegistry();
    const scope = registry.inertOutside(page.dialog, { observe: true });
    const late = document.createElement('aside');
    late.id = 'late';
    page.body.append(late);
    const inside = document.createElement('p');
    page.dialog.append(inside);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(late.hasAttribute('inert')).toBe(true);
    expect(inside.closest('[inert]')).toBeNull();

    scope.release();
    const after = document.createElement('aside');
    page.body.append(after);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(after.hasAttribute('inert')).toBe(false);
    expect(inertIds()).toEqual([]);
  });

  it('clear() closes every scope, drops exemptions and restores attributes', () => {
    const page = buildPage();
    const before = attributeSnapshot();
    const registry = createInertRegistry();
    registry.exempt({ element: page.toasts });
    registry.inertOutside(page.dialog);
    registry.inertOutside(page.header);
    registry.clear();
    expect(registry.size()).toBe(0);
    expect(registry.exemptions()).toEqual([]);
    expect(attributeSnapshot()).toBe(before);
  });
});

describe('getInertRegistry', () => {
  const fake: InertRegistryGlobal = {};
  afterEach(() => {
    resetInertRegistry(fake);
    resetInertRegistry();
  });

  it('shares one registry per global object', () => {
    const first = getInertRegistry(fake);
    expect(getInertRegistry(fake)).toBe(first);
    expect(fake[INERT_REGISTRY_GLOBAL_KEY]).toBe(first);
    expect(getInertRegistry()).not.toBe(first);
  });

  it('lets an exemption from one island survive a modal from another', () => {
    const page = buildPage();
    getInertRegistry(fake).exempt({ element: page.toasts });
    const scope = getInertRegistry(fake).inertOutside(page.dialog);
    expect(page.toasts.hasAttribute('inert')).toBe(false);
    expect(page.app.hasAttribute('inert')).toBe(true);
    scope.release();
  });

  it('resetInertRegistry restores the page and removes the key', () => {
    const page = buildPage();
    getInertRegistry(fake).inertOutside(page.dialog);
    resetInertRegistry(fake);
    expect(inertIds()).toEqual([]);
    expect(INERT_REGISTRY_GLOBAL_KEY in fake).toBe(false);
  });
});
