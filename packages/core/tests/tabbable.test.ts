import { afterEach, describe, expect, it } from 'vitest';
import {
  getFocusableElements,
  getTabbableElements,
  isFocusable,
  isTabbable,
} from '../src/index.ts';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  const root = document.body.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error('expected a root element');
  return root;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isFocusable / isTabbable', () => {
  it('treats native controls and links as focusable and tabbable, and 3 related cases', () => {
    {
      // treats native controls and links as focusable and tabbable
      const root = mount(`
      <div>
        <button id="b">Go</button>
        <a id="a" href="#here">Here</a>
        <input id="i" />
        <select id="s"><option>1</option></select>
        <textarea id="t"></textarea>
      </div>
    `);
      for (const id of ['b', 'a', 'i', 's', 't']) {
        const el = root.querySelector(`#${id}`);
        expect(isFocusable(el as Element), id).toBe(true);
        expect(isTabbable(el as Element), id).toBe(true);
      }
    }
    document.body.innerHTML = '';
    {
      // rejects disabled, hidden, inert and aria-hidden controls
      const root = mount(`
      <div>
        <button id="dis" disabled>X</button>
        <button id="attr" disabled="disabled">X</button>
        <div hidden><button id="hid">X</button></div>
        <div inert><button id="in">X</button></div>
        <div aria-hidden="true"><button id="ah">X</button></div>
        <div style="display: none"><button id="dn">X</button></div>
        <div style="visibility: hidden"><button id="vh">X</button></div>
        <input id="hidden" type="hidden" />
        <a id="nolink">No href</a>
      </div>
    `);
      for (const id of ['dis', 'attr', 'hid', 'in', 'ah', 'dn', 'vh', 'hidden', 'nolink']) {
        const el = root.querySelector(`#${id}`);
        expect(isFocusable(el as Element), id).toBe(false);
        expect(isTabbable(el as Element), id).toBe(false);
      }
    }
    document.body.innerHTML = '';
    {
      // keeps tabindex=-1 focusable but not tabbable
      const root = mount(`<div><button id="x" tabindex="-1">X</button></div>`);
      const el = root.querySelector('#x') as HTMLElement;
      expect(isFocusable(el)).toBe(true);
      expect(isTabbable(el)).toBe(false);
    }
    document.body.innerHTML = '';
    {
      // honours contenteditable and positive tabindex
      const root = mount(`
      <div>
        <div id="ce" contenteditable="true">edit</div>
        <span id="pos" tabindex="2">two</span>
        <span id="zero" tabindex="0">zero</span>
      </div>
    `);
      expect(isFocusable(root.querySelector('#ce') as Element)).toBe(true);
      expect(isTabbable(root.querySelector('#ce') as Element)).toBe(true);
      expect(isTabbable(root.querySelector('#pos') as Element)).toBe(true);
      expect(isTabbable(root.querySelector('#zero') as Element)).toBe(true);
    }
  });
  it('limits a named radio group to one tab stop; uses the first enabled radio when none is checked', () => {
    {
      // limits a named radio group to one tab stop
      const root = mount(`
      <div>
        <input type="radio" name="g" id="r1" />
        <input type="radio" name="g" id="r2" checked />
        <input type="radio" name="g" id="r3" />
        <input type="radio" name="other" id="r4" />
      </div>
    `);
      expect(isTabbable(root.querySelector('#r1') as Element)).toBe(false);
      expect(isTabbable(root.querySelector('#r2') as Element)).toBe(true);
      expect(isTabbable(root.querySelector('#r3') as Element)).toBe(false);
      expect(isTabbable(root.querySelector('#r4') as Element)).toBe(true);
    }
    document.body.innerHTML = '';
    {
      // uses the first enabled radio when none is checked
      const root = mount(`
      <div>
        <input type="radio" name="g" id="r1" disabled />
        <input type="radio" name="g" id="r2" />
        <input type="radio" name="g" id="r3" />
      </div>
    `);
      expect(isTabbable(root.querySelector('#r1') as Element)).toBe(false);
      expect(isTabbable(root.querySelector('#r2') as Element)).toBe(true);
      expect(isTabbable(root.querySelector('#r3') as Element)).toBe(false);
    }
  });
});

describe('details and fieldset', () => {
  it('exposes only the summary while details is closed; disables controls under a disabled fieldset except the first legend', () => {
    {
      // exposes only the summary while details is closed
      const root = mount(`
      <div>
        <details id="d">
          <summary id="s">More</summary>
          <button id="inner">Inside</button>
        </details>
      </div>
    `);
      expect(isTabbable(root.querySelector('#s') as Element)).toBe(true);
      expect(isFocusable(root.querySelector('#inner') as Element)).toBe(false);

      (root.querySelector('#d') as HTMLDetailsElement).open = true;
      expect(isFocusable(root.querySelector('#inner') as Element)).toBe(true);
      expect(isTabbable(root.querySelector('#inner') as Element)).toBe(true);
    }
    document.body.innerHTML = '';
    {
      // disables controls under a disabled fieldset except the first legend
      const root = mount(`
      <div>
        <fieldset id="fs" disabled>
          <legend><button id="leg">Legend</button></legend>
          <button id="body">Body</button>
        </fieldset>
      </div>
    `);
      expect(isFocusable(root.querySelector('#leg') as Element)).toBe(true);
      expect(isFocusable(root.querySelector('#body') as Element)).toBe(false);
    }
  });
});

describe('getTabbableElements / getFocusableElements', () => {
  it('returns tab order: positive tabindex first, then document order; optionally includes the container; walks open shadow roots; accepts a Document root', () => {
    {
      // returns tab order: positive tabindex first, then document order
      const root = mount(`
      <div>
        <button id="a">A</button>
        <button id="c" tabindex="2">C</button>
        <button id="b" tabindex="1">B</button>
        <button id="d" tabindex="-1">D</button>
      </div>
    `);
      const tab = getTabbableElements(root).map((el) => el.id);
      expect(tab).toEqual(['b', 'c', 'a']);

      const focus = getFocusableElements(root).map((el) => el.id);
      expect(focus).toEqual(['a', 'c', 'b', 'd']);
    }
    document.body.innerHTML = '';
    {
      // optionally includes the container
      const root = mount(`<div id="root" tabindex="0"><button id="b">B</button></div>`);
      expect(getTabbableElements(root).map((el) => el.id)).toEqual(['b']);
      expect(getTabbableElements(root, { includeContainer: true }).map((el) => el.id)).toEqual([
        'root',
        'b',
      ]);
    }
    document.body.innerHTML = '';
    {
      // walks open shadow roots
      const root = mount(`<div id="root"><div id="host"></div><button id="light">L</button></div>`);
      const host = root.querySelector('#host') as HTMLElement;
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<button id="shadow">S</button>';
      const ids = getTabbableElements(root).map((el) => el.id);
      expect(ids).toContain('shadow');
      expect(ids).toContain('light');
    }
    document.body.innerHTML = '';
    {
      // accepts a Document root
      mount(`<main><button id="only">Only</button></main>`);
      const tab = getTabbableElements(document).map((el) => el.id);
      expect(tab).toContain('only');
    }
  });

  it('returns empty arrays for empty containers', () => {
    const root = mount(`<div><span>text</span></div>`);
    expect(getTabbableElements(root)).toEqual([]);
    expect(getFocusableElements(root)).toEqual([]);
  });
});
