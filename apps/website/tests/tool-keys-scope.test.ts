/**
 * T-88 — WCAG 2.1.4 (Character Key Shortcuts) for the tool islands. The
 * single-key shortcuts are active only while the focus is inside the tool
 * (the "active only on focus" option of 2.1.4): a speech-input or keyboard
 * user elsewhere on the page never fires one by accident. A press another
 * handler already consumed, or one inside an ARIA widget that answers
 * printable keys itself (listbox, menu, tree, grid, combobox typeahead),
 * stays with that widget. A handled shortcut prevents the default action so
 * `/` never also types a slash into the field it focuses.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runToolShortcut, toolShortcut } from '../src/components/tool-keys.ts';

const KEYS = { g: 'generate', '/': 'filter', '?': 'keys' };

afterEach(() => {
  document.body.replaceChildren();
});

function tool(): { root: HTMLElement; button: HTMLButtonElement; outside: HTMLButtonElement } {
  const root = document.createElement('div');
  const button = document.createElement('button');
  root.append(button);
  const outside = document.createElement('button');
  document.body.append(root, outside);
  return { root, button, outside };
}

function keydown(target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('runToolShortcut', () => {
  it('fires for a press whose focus is inside the tool, and prevents the default', () => {
    const { root, button } = tool();
    const run = vi.fn();
    let handled = false;
    button.addEventListener('keydown', (event) => {
      handled = runToolShortcut(event, root, KEYS, run);
    });
    const event = keydown(button, '/');
    expect(handled).toBe(true);
    expect(run).toHaveBeenCalledWith('filter');
    expect(event.defaultPrevented).toBe(true);
  });

  it('stays inactive while the focus is outside the tool or on the page body', () => {
    const { root, outside } = tool();
    const run = vi.fn();
    const listener = (event: KeyboardEvent) => runToolShortcut(event, root, KEYS, run);
    window.addEventListener('keydown', listener);
    const fromOutside = keydown(outside, 'g');
    const fromBody = keydown(document.body, 'g');
    window.removeEventListener('keydown', listener);
    expect(run).not.toHaveBeenCalled();
    expect(fromOutside.defaultPrevented).toBe(false);
    expect(fromBody.defaultPrevented).toBe(false);
  });

  it('stays inactive when the tool root is not mounted', () => {
    const { button } = tool();
    const run = vi.fn();
    button.addEventListener('keydown', (event) => runToolShortcut(event, null, KEYS, run));
    keydown(button, 'g');
    expect(run).not.toHaveBeenCalled();
  });

  it('leaves a press another handler already consumed', () => {
    const { root, button } = tool();
    const run = vi.fn();
    button.addEventListener('keydown', (event) => event.preventDefault());
    root.addEventListener('keydown', (event) => runToolShortcut(event, root, KEYS, run));
    keydown(button, 'g');
    expect(run).not.toHaveBeenCalled();
  });
});

describe('toolShortcut and typeahead widgets', () => {
  for (const role of ['listbox', 'menu', 'menubar', 'tree', 'treegrid', 'grid', 'combobox']) {
    it(`leaves printable keys to a focused ${role} and its items`, () => {
      const widget = document.createElement('div');
      widget.setAttribute('role', role);
      widget.tabIndex = 0;
      const item = document.createElement('div');
      item.tabIndex = -1;
      widget.append(item);
      document.body.append(widget);
      const press = { key: 'g', ctrlKey: false, metaKey: false, altKey: false };
      expect(toolShortcut(press, widget, KEYS)).toBeNull();
      expect(toolShortcut(press, item, KEYS)).toBeNull();
    });
  }

  it('ignores a press whose default was already prevented', () => {
    const press = {
      key: 'g',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      defaultPrevented: true,
    };
    expect(toolShortcut(press, null, KEYS)).toBeNull();
  });
});

describe('tool islands', () => {
  const islands = [
    'playground/PlaygroundApp.svelte',
    'theme-studio/ThemeStudio.svelte',
    'color-explorer/ColorExplorer.svelte',
  ];
  for (const island of islands) {
    it(`${island} scopes its shortcuts to its own root`, () => {
      const source = readFileSync(
        join(import.meta.dirname, '..', 'src', 'components', island),
        'utf8'
      );
      expect(source).toMatch(/runToolShortcut\(event, \w+, \w+_KEYS,/);
      expect(source).not.toMatch(/\btoolShortcut\(/);
      expect(source).toMatch(/bind:this=\{toolRoot\}/);
      expect(source).toMatch(/while the focus is inside/);
    });
  }
});
