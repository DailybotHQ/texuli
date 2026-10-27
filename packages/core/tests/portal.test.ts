import { describe, expect, it, vi } from 'vitest';
import { createPortal } from '../src/index.ts';

function element(parent: ParentNode, name: string): HTMLElement {
  const result = document.createElement('div');
  result.dataset.name = name;
  parent.appendChild(result);
  return result;
}

describe('createPortal', () => {
  it('moves the same element to body by default and preserves its descendants and listeners, and 3 related cases', () => {
    {
      // moves the same element to body by default and preserves its descendants and listeners
      const origin = document.createElement('section');
      const before = element(origin, 'before');
      const content = element(origin, 'content');
      const child = element(content, 'child');
      const after = element(origin, 'after');
      const listener = vi.fn();
      content.addEventListener('portal-check', listener);
      document.body.append(origin);

      const portal = createPortal(content);
      expect(content.parentElement).toBe(document.body);
      expect(content.firstElementChild).toBe(child);
      expect(content.dataset.name).toBe('content');
      expect(portal.currentTarget).toBe(document.body);
      expect(portal.isPortaled).toBe(true);

      content.dispatchEvent(new Event('portal-check'));
      expect(listener).toHaveBeenCalledOnce();

      portal.destroy();
      expect([...origin.children]).toEqual([before, content, after]);
      expect(portal.isPortaled).toBe(false);
    }
    {
      // moves between reactive targets without cloning or changing child order
      const origin = document.createElement('section');
      const first = document.createElement('aside');
      const second = document.createElement('aside');
      const content = element(origin, 'content');
      const firstChild = element(content, 'first');
      const secondChild = element(content, 'second');
      document.body.append(origin, first, second);

      const portal = createPortal(content, { target: first });
      expect(content.parentElement).toBe(first);
      expect(portal.setTarget(second)).toBe(true);
      expect(content.parentElement).toBe(second);
      expect([...content.children]).toEqual([firstChild, secondChild]);
      expect(portal.currentTarget).toBe(second);

      portal.destroy();
      expect(content.parentElement).toBe(origin);
      expect([...origin.children]).toEqual([content]);
    }
    {
      // uses body when the reactive target is cleared and restores the origin order on destroy
      const origin = document.createElement('section');
      const before = element(origin, 'before');
      const content = element(origin, 'content');
      const after = element(origin, 'after');
      const customTarget = document.createElement('aside');
      document.body.append(origin, customTarget);

      const portal = createPortal(content, { target: customTarget });
      expect(portal.setTarget(null)).toBe(true);
      expect(content.parentElement).toBe(document.body);
      portal.destroy();
      expect([...origin.children]).toEqual([before, content, after]);
    }
    {
      // restores to the original parent when no body is available
      const ownerDocument = document.implementation.createDocument(null, 'html');
      Object.defineProperty(ownerDocument, 'body', { configurable: true, value: null });
      const origin = ownerDocument.createElement('section');
      ownerDocument.documentElement.append(origin);
      const before = ownerDocument.createElement('i');
      const content = ownerDocument.createElement('div');
      const after = ownerDocument.createElement('i');
      origin.append(before, content, after);

      const portal = createPortal(content);
      expect(content.parentElement).toBe(origin);
      expect(portal.isPortaled).toBe(false);
      expect([...origin.children]).toEqual([before, content, after]);
      portal.destroy();
      expect([...origin.children]).toEqual([before, content, after]);
    }
  });
  it('returns an initially detached source to the detached state on destroy, and 3 related cases', async () => {
    {
      // returns an initially detached source to the detached state on destroy
      const content = document.createElement('div');
      const portal = createPortal(content);
      expect(content.parentElement).toBe(document.body);
      expect(portal.isPortaled).toBe(true);
      portal.destroy();
      expect(content.parentNode).toBeNull();
    }
    {
      // does not change SSR output or require ambient document when no source exists
      const portal = createPortal(null);
      expect(portal.currentTarget).toBeNull();
      expect(portal.isPortaled).toBe(false);
      expect(portal.setTarget(null)).toBe(false);
      expect(() => portal.destroy()).not.toThrow();
    }
    // imports the portal texel without ambient window or document globals
    await (async () => {
      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;
      vi.stubGlobal('window', undefined);
      vi.stubGlobal('document', undefined);
      vi.resetModules();
      try {
        const portalModule = await import('../src/portal/index.ts');
        expect(portalModule.createPortal(null).currentTarget).toBeNull();
      } finally {
        vi.stubGlobal('window', originalWindow);
        vi.stubGlobal('document', originalDocument);
      }
    })();
    {
      // rejects cross-document and cyclic targets without moving the source
      const origin = document.createElement('section');
      const content = element(origin, 'content');
      const descendant = document.createElement('aside');
      content.append(descendant);
      document.body.append(origin);
      const otherDocument = document.implementation.createHTMLDocument('other');
      const foreignTarget = otherDocument.createElement('aside');

      const portal = createPortal(content, { target: foreignTarget });
      expect(content.parentElement).toBe(origin);
      expect(portal.isPortaled).toBe(false);
      expect(portal.setTarget(descendant)).toBe(false);
      expect(content.parentElement).toBe(origin);
      portal.destroy();
      expect(content.parentElement).toBe(origin);
    }
  });

  it('is safe to destroy more than once and refuses updates after teardown', () => {
    const origin = document.createElement('section');
    const content = element(origin, 'content');
    const target = document.createElement('aside');
    document.body.append(origin, target);
    const portal = createPortal(content, { target });

    portal.destroy();
    portal.destroy();
    expect(portal.setTarget(null)).toBe(false);
    expect(content.parentElement).toBe(origin);
  });
});
