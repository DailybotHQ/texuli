import { afterEach, describe, expect, it } from 'vitest';
import { createOverlayCore } from '../src/overlay/index.ts';
import {
  createPortal,
  createScopedPortal,
  createScopedPortalRoot,
  findPortalScope,
  PORTAL_ROOT_ATTRIBUTE,
  SCOPE_ATTRIBUTE,
} from '../src/portal/index.ts';

/** A scope as `applyTheme` leaves it: `data-tx-*` attributes and inline `--tx-*` properties. */
function themedScope(theme: string, mode: 'light' | 'dark', background: string): HTMLElement {
  const scope = document.createElement('section');
  scope.setAttribute(SCOPE_ATTRIBUTE, '');
  scope.dataset.txTheme = theme;
  scope.dataset.txMode = mode;
  scope.style.setProperty('--tx-background', background);
  scope.style.setProperty('--tx-foreground', mode === 'dark' ? 'white' : 'black');
  scope.style.setProperty('padding', '4px');
  document.body.append(scope);
  return scope;
}

/** MutationObserver callbacks run as microtasks. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-tx-theme');
});

describe('findPortalScope', () => {
  it('returns the nearest [data-tx-scope] or [data-tx-theme] ancestor, itself included', () => {
    const outer = themedScope('outer', 'light', 'white');
    const inner = document.createElement('div');
    inner.dataset.txTheme = 'inner';
    const trigger = document.createElement('button');
    inner.append(trigger);
    outer.append(inner);
    const loose = document.createElement('button');
    outer.append(loose);

    expect(findPortalScope(trigger)).toBe(inner);
    expect(findPortalScope(loose)).toBe(outer);
    expect(findPortalScope(outer)).toBe(outer);
  });

  it('returns null with no scope, a missing node, or a page-wide scope that already holds body', () => {
    const plain = document.createElement('button');
    document.body.append(plain);
    expect(findPortalScope(plain)).toBeNull();
    expect(findPortalScope(null)).toBeNull();
    expect(findPortalScope(undefined)).toBeNull();

    document.documentElement.dataset.txTheme = 'page';
    expect(findPortalScope(plain)).toBeNull();
  });

  it('follows a scoped portal root back to the scope it mirrors', () => {
    const scope = themedScope('a', 'light', 'white');
    const root = createScopedPortalRoot(scope);
    const nested = document.createElement('button');
    root?.element.append(nested);
    expect(findPortalScope(nested)).toBe(scope);
    root?.destroy();
  });
});

describe('createScopedPortalRoot', () => {
  it('mirrors data-tx-* attributes and inline custom properties only, as a box-less body child', () => {
    const scope = themedScope('ocean', 'dark', 'rgb(1, 2, 3)');
    scope.setAttribute('data-other', 'x');
    scope.id = 'scope-a';
    const root = createScopedPortalRoot(scope);
    if (!root) throw new Error('expected a root');
    const el = root.element;

    expect(el.parentElement).toBe(document.body);
    expect(el.hasAttribute(PORTAL_ROOT_ATTRIBUTE)).toBe(true);
    expect(el.getAttribute(SCOPE_ATTRIBUTE)).toBe('');
    expect(el.dataset.txTheme).toBe('ocean');
    expect(el.dataset.txMode).toBe('dark');
    expect(el.style.getPropertyValue('--tx-background')).toBe('rgb(1, 2, 3)');
    expect(el.style.getPropertyValue('--tx-foreground')).toBe('white');
    // Not mirrored: ordinary properties, other attributes, the id.
    expect(el.style.getPropertyValue('padding')).toBe('');
    expect(el.hasAttribute('data-other')).toBe(false);
    expect(el.id).toBe('');
    expect(el.style.getPropertyValue('display')).toBe('contents');
    expect(root.scope).toBe(scope);
    root.destroy();
    expect(el.isConnected).toBe(false);
  });

  it('stays in sync with the scope (set, change and remove) until destroyed', async () => {
    const scope = themedScope('ocean', 'light', 'white');
    const root = createScopedPortalRoot(scope);
    if (!root) throw new Error('expected a root');
    const el = root.element;

    scope.dataset.txMode = 'dark';
    scope.style.setProperty('--tx-background', 'black');
    scope.style.setProperty('--tx-primary', 'red');
    scope.style.removeProperty('--tx-foreground');
    scope.dataset.txMotion = 'reduce';
    await flush();
    expect(el.dataset.txMode).toBe('dark');
    expect(el.dataset.txMotion).toBe('reduce');
    expect(el.style.getPropertyValue('--tx-background')).toBe('black');
    expect(el.style.getPropertyValue('--tx-primary')).toBe('red');
    expect(el.style.getPropertyValue('--tx-foreground')).toBe('');

    delete scope.dataset.txMotion;
    await flush();
    expect(el.hasAttribute('data-tx-motion')).toBe(false);

    root.destroy();
    scope.dataset.txMode = 'light';
    await flush();
    expect(el.dataset.txMode).toBe('dark');
    root.destroy();
  });

  it('returns null for a scope without a usable body', () => {
    const doc = document.implementation.createHTMLDocument('x');
    doc.body.remove();
    const scope = doc.createElement('div');
    expect(createScopedPortalRoot(scope)).toBeNull();
  });
});

describe('createScopedPortal', () => {
  it('portals into a scoped root that mirrors the nearest scope of the source origin', () => {
    const scope = themedScope('ocean', 'dark', 'black');
    const content = document.createElement('div');
    scope.append(content);

    const portal = createScopedPortal(content);
    const root = content.parentElement;
    expect(root?.hasAttribute(PORTAL_ROOT_ATTRIBUTE)).toBe(true);
    expect(root?.parentElement).toBe(document.body);
    expect(root?.dataset.txTheme).toBe('ocean');
    expect(portal.currentTarget).toBe(root);
    expect(portal.isPortaled).toBe(true);

    portal.destroy();
    expect(content.parentElement).toBe(scope);
    expect(root?.isConnected).toBe(false);
    expect(document.querySelector(`[${PORTAL_ROOT_ATTRIBUTE}]`)).toBeNull();
  });

  it('keeps body without a scope, with scope: null, and gives an explicit target precedence', () => {
    const plain = document.createElement('div');
    const plainContent = document.createElement('div');
    plain.append(plainContent);
    document.body.append(plain);
    const plainPortal = createScopedPortal(plainContent);
    expect(plainContent.parentElement).toBe(document.body);
    plainPortal.destroy();

    const scope = themedScope('ocean', 'dark', 'black');
    const optedOut = document.createElement('div');
    scope.append(optedOut);
    const bodyPortal = createScopedPortal(optedOut, { scope: null });
    expect(optedOut.parentElement).toBe(document.body);
    bodyPortal.destroy();

    const frame = document.createElement('aside');
    document.body.append(frame);
    const content = document.createElement('div');
    scope.append(content);
    const framed = createScopedPortal(content, { target: frame });
    expect(content.parentElement).toBe(frame);
    expect(document.querySelector(`[${PORTAL_ROOT_ATTRIBUTE}]`)).toBeNull();
    // Back to the default: the scoped root; then to a frame again, which drops the root.
    framed.setTarget(null);
    expect(content.parentElement?.hasAttribute(PORTAL_ROOT_ATTRIBUTE)).toBe(true);
    framed.setTarget(frame);
    expect(content.parentElement).toBe(frame);
    expect(document.querySelector(`[${PORTAL_ROOT_ATTRIBUTE}]`)).toBeNull();
    framed.destroy();
  });

  it('picks up a scope applied after creation on the next placement, and follows a scope function', () => {
    const later = document.createElement('section');
    document.body.append(later);
    const content = document.createElement('div');
    later.append(content);
    const portal = createScopedPortal(content);
    expect(content.parentElement).toBe(document.body);

    later.setAttribute(SCOPE_ATTRIBUTE, '');
    later.dataset.txTheme = 'late';
    portal.setTarget(null);
    expect(content.parentElement?.dataset.txTheme).toBe('late');
    // Unchanged scope: no new root, no move.
    const root = content.parentElement;
    portal.setTarget(undefined);
    expect(content.parentElement).toBe(root);
    portal.destroy();
    expect(document.querySelector(`[${PORTAL_ROOT_ATTRIBUTE}]`)).toBeNull();

    let named: Element | null = null;
    const host = document.createElement('div');
    document.body.append(host);
    const fn = createScopedPortal(host, { scope: () => named });
    expect(host.parentElement).toBe(document.body);
    named = themedScope('fn', 'light', 'white');
    fn.setTarget(null);
    expect(host.parentElement?.dataset.txTheme).toBe('fn');
    fn.destroy();
  });

  it('accepts an explicit scope element for a source that starts outside it', () => {
    const scope = themedScope('ocean', 'light', 'white');
    const host = document.createElement('div');
    document.body.append(host);
    const portal = createScopedPortal(host, { scope });
    expect(host.parentElement?.getAttribute('data-tx-theme')).toBe('ocean');
    portal.destroy();
    expect(document.querySelector(`[${PORTAL_ROOT_ATTRIBUTE}]`)).toBeNull();
  });
});

describe('overlay engine portal', () => {
  it('createPortal itself never follows a scope (body, as before)', () => {
    const scope = themedScope('ocean', 'dark', 'black');
    const content = document.createElement('div');
    scope.append(content);
    const portal = createPortal(content);
    expect(content.parentElement).toBe(document.body);
    portal.destroy();
  });

  it('with the scoped portal feature, portal: null follows the scope while shown, then returns', () => {
    const scope = themedScope('ocean', 'dark', 'black');
    const element = document.createElement('div');
    scope.append(element);
    const engine = createOverlayCore({ element, portal: null }, { portal: createScopedPortal });
    engine.open();
    expect(element.parentElement?.hasAttribute(PORTAL_ROOT_ATTRIBUTE)).toBe(true);
    expect(element.parentElement?.dataset.txMode).toBe('dark');
    engine.destroy();
    expect(element.parentElement).toBe(scope);
    expect(document.querySelector(`[${PORTAL_ROOT_ATTRIBUTE}]`)).toBeNull();
  });
});
