/**
 * Token scopes for portals (ADR-023). A theme or design system applied to an
 * element (`applyTheme(el)`) marks it `[data-tx-scope]` and writes its
 * `--tx-*` custom properties inline. Content portaled to `body` would leave
 * that subtree and lose the scope, so a scoped portal mounts it in a scoped
 * portal root instead: a box-less (`display: contents`) body child that
 * mirrors the scope's `data-tx-*` attributes and inline custom properties,
 * kept in sync while it lives.
 */

import { createPortal, type PortalController, type PortalOptions } from './index.ts';

/** The attribute that marks an element as a token scope. */
export const SCOPE_ATTRIBUTE = 'data-tx-scope';
/** The attribute on a scoped portal root. */
export const PORTAL_ROOT_ATTRIBUTE = 'data-tx-portal-root';
/** What counts as a scope: the marker, or a theme attribute (scopes written before the marker). */
export const SCOPE_SELECTOR = '[data-tx-scope], [data-tx-theme]';

/** Each live root, back to the scope it mirrors (a nested overlay mirrors the scope, not the root). */
const rootScopes = /* @__PURE__ */ new WeakMap<Element, Element>();

/** `data-tx-*` attributes, except the portal and overlay markers. */
const mirrored = (name: string) =>
  name.startsWith('data-tx-') && !/^data-tx-(portal|overlay)/.test(name);

/**
 * The nearest token scope of `from` (itself included): the closest
 * `[data-tx-scope]` or `[data-tx-theme]` element. `null` without one, and
 * when that scope already holds `body` (a page-wide theme on `<html>` reaches
 * body portals as it is). Inside a scoped portal root, the scope it mirrors.
 */
export function findPortalScope(from: Element | null | undefined): Element | null {
  const scope = from?.closest(SCOPE_SELECTOR) ?? null;
  if (!scope) return null;
  const body = scope.ownerDocument.body;
  return rootScopes.get(scope) ?? (body && scope.contains(body) ? null : scope);
}

/** A body child that carries one scope's tokens to the content portaled into it. */
export type ScopedPortalRoot = {
  /** The root element; portal content into it. */
  readonly element: HTMLElement;
  /** The scope it mirrors. */
  readonly scope: Element;
  /** Copy the scope again (the observer does this on every change). */
  sync(): void;
  /** Stop observing and remove the root; idempotent. */
  destroy(): void;
};

/**
 * Create a scoped portal root for `scope` at the end of its document's body.
 * Returns `null` when the document has no body (SSR, a detached document).
 * Without `MutationObserver` it mirrors once; call `sync()` after changes.
 */
export function createScopedPortalRoot(scope: Element): ScopedPortalRoot | null {
  const doc = scope.ownerDocument;
  if (!doc.body) return null;
  const element = doc.createElement('div');
  const style = element.style;
  element.setAttribute(PORTAL_ROOT_ATTRIBUTE, '');
  style.setProperty('display', 'contents', 'important');
  let properties: string[] = [];

  const sync = () => {
    for (const { name } of Array.from(element.attributes)) {
      if (mirrored(name) && !scope.hasAttribute(name)) element.removeAttribute(name);
    }
    for (const { name, value } of Array.from(scope.attributes)) {
      if (mirrored(name)) element.setAttribute(name, value);
    }
    const inline = (scope as HTMLElement).style;
    const next = Array.from(inline ?? []).filter((name) => name.startsWith('--'));
    for (const name of properties) if (!next.includes(name)) style.removeProperty(name);
    for (const name of next) {
      style.setProperty(name, inline.getPropertyValue(name), inline.getPropertyPriority(name));
    }
    properties = next;
  };

  sync();
  doc.body.append(element);
  rootScopes.set(element, scope);
  const Observer = doc.defaultView?.MutationObserver;
  const observer = Observer ? new Observer(sync) : null;
  observer?.observe(scope, { attributes: true });

  return {
    element,
    scope,
    sync,
    destroy() {
      observer?.disconnect();
      rootScopes.delete(element);
      element.remove();
    },
  };
}

/**
 * The token scope a scoped portal follows, resolved on every placement:
 * `'auto'` (default) finds the nearest scope around the source's original
 * position; an element names one; a function returns one; `null` opts out
 * (always `body`).
 */
export type PortalScope = Element | null | 'auto' | (() => Element | null);

export type ScopedPortalOptions = Omit<PortalOptions, 'fallback' | 'settled'> & {
  scope?: PortalScope;
};

/**
 * `createPortal` that follows a token scope: an omitted or `null` target is
 * the scoped portal root of the scope (created on demand, removed once the
 * source leaves it), or `body` without a scope. An explicit target wins. The
 * scope is resolved on every placement, so a theme applied after creation is
 * followed by the next `setTarget`.
 */
export function createScopedPortal(
  source: Element | null | undefined,
  options: ScopedPortalOptions = {}
): PortalController {
  const { scope = 'auto' } = options;
  const roots: ScopedPortalRoot[] = [];
  return createPortal(source, {
    target: options.target,
    fallback(origin) {
      const found =
        scope === 'auto' ? findPortalScope(origin) : typeof scope === 'function' ? scope() : scope;
      if (!found) return null;
      let root = roots.find((entry) => entry.scope === found);
      if (!root) {
        root = createScopedPortalRoot(found) ?? undefined;
        if (root) roots.push(root);
      }
      return root?.element ?? null;
    },
    settled(parent) {
      for (let index = roots.length - 1; index >= 0; index -= 1) {
        const root = roots[index] as ScopedPortalRoot;
        if (root.element === parent) continue;
        root.destroy();
        roots.splice(index, 1);
      }
    },
  });
}
