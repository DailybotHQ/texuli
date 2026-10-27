import { afterEach, describe, expect, it } from 'vitest';
import { createLiveRegion } from '../src/announcer/index.ts';
import {
  ANNOUNCER_REGION_ATTR,
  type AnnouncerClock,
  createAnnouncer,
  createInertRegistry,
  getAnnouncer,
  resetAnnouncer,
} from '../src/index.ts';

function createFakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { due: number; fn: () => void }>();
  const clock: AnnouncerClock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { due: now + ms, fn });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id as number);
    },
  };
  return {
    clock,
    advance(ms: number) {
      now += ms;
      const due = [...timers.entries()].filter(([, t]) => t.due <= now);
      for (const [id, t] of due) {
        timers.delete(id);
        t.fn();
      }
    },
  };
}

afterEach(() => {
  resetAnnouncer(document);
  document.body.innerHTML = '';
});

describe('createAnnouncer', () => {
  it('creates polite and assertive live regions with textContent only, and 3 related cases', () => {
    {
      // creates polite and assertive live regions with textContent only
      const { clock, advance } = createFakeClock();
      const announcer = createAnnouncer({
        document,
        clock,
        politeDebounceMs: 0,
        assertiveDebounceMs: 0,
        dedupeMs: 0,
        inertRegistry: null,
      });
      announcer.announce('Saved');
      advance(16);
      const polite = announcer.regions.polite;
      expect(polite.getAttribute('aria-live')).toBe('polite');
      expect(polite.getAttribute('role')).toBe('status');
      expect(polite.getAttribute(ANNOUNCER_REGION_ATTR)).toBe('polite');
      expect(polite.textContent).toBe('Saved');
      expect(polite.parentElement).toBe(document.body);

      announcer.announce('Error', 'assertive');
      advance(16);
      const assertive = announcer.regions.assertive;
      expect(assertive.getAttribute('aria-live')).toBe('assertive');
      expect(assertive.getAttribute('role')).toBe('alert');
      expect(assertive.textContent).toBe('Error');
      announcer.destroy();
    }
    resetAnnouncer(document);
    document.body.innerHTML = '';
    {
      // ignores empty messages and never uses HTML sinks
      const { clock, advance } = createFakeClock();
      const announcer = createAnnouncer({
        document,
        clock,
        politeDebounceMs: 0,
        dedupeMs: 0,
        inertRegistry: null,
      });
      announcer.announce('   ');
      announcer.announce('<b>bold</b>');
      advance(16);
      expect(announcer.regions.polite.textContent).toBe('<b>bold</b>');
      expect(announcer.regions.polite.innerHTML).toBe('&lt;b&gt;bold&lt;/b&gt;');
      announcer.destroy();
    }
    resetAnnouncer(document);
    document.body.innerHTML = '';
    {
      // debounces polite announcements and keeps the last message
      const { clock, advance } = createFakeClock();
      const announcer = createAnnouncer({
        document,
        clock,
        politeDebounceMs: 100,
        dedupeMs: 0,
        inertRegistry: null,
      });
      announcer.announce('One');
      announcer.announce('Two');
      announcer.announce('Three');
      advance(50);
      expect(announcer.regions.polite.textContent).toBe('');
      advance(50);
      advance(16);
      expect(announcer.regions.polite.textContent).toBe('Three');
      announcer.destroy();
    }
    resetAnnouncer(document);
    document.body.innerHTML = '';
    {
      // dedupes identical messages within the window
      const { clock, advance } = createFakeClock();
      const announcer = createAnnouncer({
        document,
        clock,
        politeDebounceMs: 0,
        dedupeMs: 500,
        inertRegistry: null,
      });
      announcer.announce('Ping');
      advance(16);
      expect(announcer.regions.polite.textContent).toBe('Ping');
      announcer.regions.polite.textContent = '';
      announcer.announce('Ping');
      advance(16);
      // Still within dedupe window — not re-written.
      expect(announcer.regions.polite.textContent).toBe('');
      advance(500);
      announcer.announce('Ping');
      advance(16);
      expect(announcer.regions.polite.textContent).toBe('Ping');
      announcer.destroy();
    }
  });
  it('immediate bypasses debounce, and 3 related cases', () => {
    {
      // immediate bypasses debounce
      const { clock, advance } = createFakeClock();
      const announcer = createAnnouncer({
        document,
        clock,
        politeDebounceMs: 1000,
        dedupeMs: 0,
        inertRegistry: null,
      });
      announcer.announce('Now', { immediate: true });
      advance(16);
      expect(announcer.regions.polite.textContent).toBe('Now');
      announcer.destroy();
    }
    resetAnnouncer(document);
    document.body.innerHTML = '';
    {
      // registers both regions as inert exemptions under a modal scope
      const registry = createInertRegistry();
      const { clock, advance } = createFakeClock();
      const announcer = createAnnouncer({
        document,
        clock,
        politeDebounceMs: 0,
        assertiveDebounceMs: 0,
        dedupeMs: 0,
        inertRegistry: registry,
      });
      announcer.ensure();
      const polite = announcer.regions.polite;
      const assertive = announcer.regions.assertive;
      expect(registry.isExempt(polite)).toBe(true);
      expect(registry.isExempt(assertive)).toBe(true);

      const modal = document.createElement('div');
      document.body.append(modal);
      const outside = document.createElement('button');
      outside.textContent = 'Outside';
      document.body.append(outside);
      const scope = registry.inertOutside(modal);

      expect(outside.hasAttribute('inert')).toBe(true);
      expect(polite.hasAttribute('inert')).toBe(false);
      expect(assertive.hasAttribute('inert')).toBe(false);
      // Announcer still updates while the modal is open.
      announcer.announce('Under modal', { immediate: true });
      advance(16);
      expect(polite.textContent).toBe('Under modal');

      scope.release();
      announcer.destroy();
      expect(registry.isExempt(polite)).toBe(false);
    }
    resetAnnouncer(document);
    document.body.innerHTML = '';
    {
      // clear cancels pending work and empties regions
      const { clock, advance } = createFakeClock();
      const announcer = createAnnouncer({
        document,
        clock,
        politeDebounceMs: 200,
        dedupeMs: 0,
        inertRegistry: null,
      });
      announcer.announce('Later');
      announcer.clear();
      advance(300);
      announcer.ensure();
      expect(announcer.regions.polite.textContent).toBe('');
      announcer.destroy();
    }
    resetAnnouncer(document);
    document.body.innerHTML = '';
    {
      // destroy is idempotent and removes nodes
      const { clock, advance } = createFakeClock();
      const announcer = createAnnouncer({
        document,
        clock,
        politeDebounceMs: 0,
        dedupeMs: 0,
        inertRegistry: null,
      });
      announcer.announce('X', { immediate: true });
      advance(16);
      const node = announcer.regions.polite;
      expect(document.body.contains(node)).toBe(true);
      announcer.destroy();
      announcer.destroy();
      announcer.announce('Y');
      expect(document.body.contains(node)).toBe(false);
    }
  });

  it('rejects a non-document', () => {
    expect(() => createAnnouncer({ document: null as unknown as Document })).toThrow(/Document/);
  });
});

describe('getAnnouncer', () => {
  it('returns one instance per document on a global map', () => {
    const scope: { [key: string]: WeakMap<Document, unknown> | undefined } = {};
    const a = getAnnouncer(document, { inertRegistry: null, politeDebounceMs: 0 }, scope as never);
    const b = getAnnouncer(document, { inertRegistry: null }, scope as never);
    expect(a).toBe(b);
    resetAnnouncer(document, scope as never);
    a.destroy();
  });
});

describe('createLiveRegion under a strict CSP', () => {
  it('hides the region through CSSOM, never a style attribute that style-src blocks', () => {
    const calls: string[] = [];
    const original = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
      // happy-dom's CSSOM setters reflect through setAttribute themselves; a
      // browser's do not, so count only calls made by the code under test.
      const caller = new Error().stack?.split('\n')[2] ?? '';
      if (!caller.includes('happy-dom')) calls.push(name);
      original.call(this, name, value);
    };
    try {
      const node = createLiveRegion(document, 'polite');
      expect(calls).not.toContain('style');
      expect(node.style.position).toBe('absolute');
      expect(node.style.overflow).toBe('hidden');
      expect(node.style.whiteSpace).toBe('nowrap');
    } finally {
      Element.prototype.setAttribute = original;
    }
  });
});
