import { afterEach, describe, expect, it } from 'vitest';
import { createFocusScope } from '../src/index.ts';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  const root = document.body.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error('expected a root element');
  return root;
}

function tab(shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  document.activeElement?.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createFocusScope', () => {
  it('uses explicit target, autofocus, first tabbable, then the container, and 3 related cases', () => {
    {
      // uses explicit target, autofocus, first tabbable, then the container
      const root = mount(`
      <main>
        <button id="opener">Open</button>
        <section id="explicit-scope" tabindex="-1"><button id="first">First</button><button id="explicit" tabindex="-1">Explicit</button><button autofocus id="auto">Auto</button></section>
        <section id="auto-scope"><button id="auto-opener">Open</button><button autofocus id="auto-target">Auto</button></section>
        <section id="first-scope"><button id="first-target">First</button></section>
        <section id="empty-scope"><span>Empty</span></section>
      </main>
    `);
      const opener = root.querySelector('#opener') as HTMLElement;
      opener.focus();

      const explicitScope = createFocusScope(root.querySelector('#explicit-scope') as HTMLElement, {
        initialFocus: root.querySelector('#explicit') as HTMLElement,
      });
      explicitScope.activate();
      expect(document.activeElement?.id).toBe('explicit');
      explicitScope.deactivate();
      expect(document.activeElement).toBe(opener);

      const autoOpener = root.querySelector('#auto-opener') as HTMLElement;
      autoOpener.focus();
      const autoScope = createFocusScope(root.querySelector('#auto-scope') as HTMLElement);
      autoScope.activate();
      expect(document.activeElement?.id).toBe('auto-target');
      autoScope.deactivate();

      const firstScope = createFocusScope(root.querySelector('#first-scope') as HTMLElement);
      firstScope.activate();
      expect(document.activeElement?.id).toBe('first-target');
      firstScope.deactivate();

      const emptyScope = createFocusScope(root.querySelector('#empty-scope') as HTMLElement);
      emptyScope.activate();
      expect(document.activeElement?.id).toBe('empty-scope');
      emptyScope.deactivate();
    }
    document.body.innerHTML = '';
    {
      // wraps Tab and Shift+Tab and leaves in-range navigation alone
      const root = mount(
        '<section><button id="first">First</button><button id="last">Last</button></section>'
      );
      const first = root.querySelector('#first') as HTMLElement;
      const last = root.querySelector('#last') as HTMLElement;
      const scope = createFocusScope(root);
      scope.activate();

      last.focus();
      expect(tab().defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(first);

      first.focus();
      expect(tab(true).defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(last);

      first.focus();
      expect(tab().defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(first);
      scope.deactivate();
    }
    document.body.innerHTML = '';
    {
      // can cycle every Tab stop when native dialog order is unreliable
      const root = mount(
        '<section><button id="first">First</button><button id="last">Last</button></section>'
      );
      const first = root.querySelector('#first') as HTMLElement;
      const last = root.querySelector('#last') as HTMLElement;
      const scope = createFocusScope(root, { cycleTabNavigation: true });
      scope.activate();

      first.focus();
      expect(tab().defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(last);
      expect(tab(true).defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(first);

      scope.deactivate();
    }
    document.body.innerHTML = '';
    {
      // focuses the container when a Tab trap has no tabbable descendants
      const root = mount('<section><span>Text only</span></section>');
      const scope = createFocusScope(root);
      scope.activate();
      const event = tab();
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(root);
      expect(root.hasAttribute('tabindex')).toBe(false);
      scope.deactivate();
    }
  });
  it('traps only the innermost scope and restores nested focus to its opener, and 2 related cases', () => {
    {
      // traps only the innermost scope and restores nested focus to its opener
      const root = mount(
        '<main><button id="opener">Open</button><section id="outer"><button id="inner-opener">Open inner</button><div id="inner"><button id="inner-first">First</button><button id="inner-last">Last</button></div></section></main>'
      );
      const opener = root.querySelector('#opener') as HTMLElement;
      const innerOpener = root.querySelector('#inner-opener') as HTMLElement;
      const innerLast = root.querySelector('#inner-last') as HTMLElement;
      opener.focus();
      const outer = createFocusScope(root.querySelector('#outer') as HTMLElement);
      outer.activate();
      innerOpener.focus();
      const inner = createFocusScope(root.querySelector('#inner') as HTMLElement);
      inner.activate();

      innerLast.focus();
      expect(tab()).toBeInstanceOf(KeyboardEvent);
      expect(document.activeElement?.id).toBe('inner-first');
      inner.deactivate();
      expect(document.activeElement).toBe(innerOpener);
      outer.deactivate();
      expect(document.activeElement).toBe(opener);
    }
    document.body.innerHTML = '';
    {
      // allows ordered, preventable restoration and makes lifecycle calls idempotent
      const root = mount(
        '<main><button id="opener">Open</button><section><button id="inside">Inside</button></section></main>'
      );
      const opener = root.querySelector('#opener') as HTMLElement;
      const inside = root.querySelector('#inside') as HTMLElement;
      const order: string[] = [];
      opener.focus();
      const scope = createFocusScope(root.querySelector('section') as HTMLElement, {
        onBeforeRestoreFocus(event) {
          order.push('before');
          expect(event.target).toBe(opener);
          expect(document.activeElement).toBe(inside);
          event.preventDefault();
        },
      });
      scope.activate();
      expect(scope.isActive()).toBe(true);
      inside.focus();
      const event = tab(true);
      expect(event.defaultPrevented).toBe(true);
      scope.deactivate();
      scope.deactivate();
      expect(order).toEqual(['before']);
      expect(document.activeElement).toBe(inside);
      expect(scope.isActive()).toBe(false);
    }
    document.body.innerHTML = '';
    {
      // evaluates a dynamic initial target on each activation
      const root = mount(
        '<section><button id="one">One</button><button id="two">Two</button></section>'
      );
      const one = root.querySelector('#one') as HTMLElement;
      const two = root.querySelector('#two') as HTMLElement;
      let target = one;
      const scope = createFocusScope(root, {
        initialFocus: () => target,
      });
      scope.activate();
      expect(document.activeElement).toBe(one);
      scope.deactivate();
      target = two;
      scope.activate();
      expect(document.activeElement).toBe(two);
      scope.deactivate();
    }
  });
});
