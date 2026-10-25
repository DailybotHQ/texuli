import { describe, expect, it } from 'vitest';
import {
  ariaKeyShortcuts,
  createShortcutMap,
  detectPlatform,
  directionOf,
  flipArrowForDirection,
  formatShortcut,
  getNavigationIntent,
  hasCommandModifier,
  isActivationKey,
  isComposing,
  isTextEntryTarget,
  matchesShortcut,
  normalizeKey,
  parseShortcut,
  resolveShortcut,
} from '../src/index.ts';

const key = (init: KeyboardEventInit & { key: string }) => new KeyboardEvent('keydown', init);

describe('normalizeKey', () => {
  it('maps legacy and alternative names to the standard ones', () => {
    expect(normalizeKey('Esc')).toBe('Escape');
    expect(normalizeKey('Left')).toBe('ArrowLeft');
    expect(normalizeKey('Down')).toBe('ArrowDown');
    expect(normalizeKey('Del')).toBe('Delete');
    expect(normalizeKey(' ')).toBe('Space');
    expect(normalizeKey('Spacebar')).toBe('Space');
  });

  it('lowercases one letter and keeps symbols and named keys', () => {
    expect(normalizeKey('K')).toBe('k');
    expect(normalizeKey('Ä')).toBe('ä');
    expect(normalizeKey('?')).toBe('?');
    expect(normalizeKey('ArrowUp')).toBe('ArrowUp');
    expect(normalizeKey('F2')).toBe('F2');
  });
});

describe('IME composition guard', () => {
  it('recognizes composing events from every engine', () => {
    expect(isComposing(key({ key: 'Enter', isComposing: true }))).toBe(true);
    // Safari reports the key with keyCode 229 before isComposing turns true.
    expect(isComposing({ key: 'Enter', keyCode: 229 })).toBe(true);
    expect(isComposing({ key: 'Process' })).toBe(true);
    expect(isComposing(key({ key: 'Enter' }))).toBe(false);
  });

  it('never activates or navigates while composing', () => {
    expect(isActivationKey(key({ key: 'Enter', isComposing: true }))).toBe(false);
    expect(
      getNavigationIntent(key({ key: 'ArrowDown', isComposing: true }), { orientation: 'vertical' })
    ).toBeNull();
    expect(matchesShortcut({ key: 'k', ctrlKey: true, keyCode: 229 }, 'Mod+K', 'other')).toBe(
      false
    );
  });
});

describe('activation keys', () => {
  it('accepts Enter and Space (any spelling) without command modifiers', () => {
    expect(isActivationKey(key({ key: 'Enter' }))).toBe(true);
    expect(isActivationKey(key({ key: ' ' }))).toBe(true);
    expect(isActivationKey({ key: 'Spacebar' })).toBe(true);
    expect(isActivationKey(key({ key: 'Enter', shiftKey: true }))).toBe(true);
    expect(isActivationKey(key({ key: 'Enter', ctrlKey: true }))).toBe(false);
    expect(isActivationKey(key({ key: ' ', metaKey: true }))).toBe(false);
    expect(isActivationKey(key({ key: 'a' }))).toBe(false);
  });

  it('narrows to one key for links (Enter) and checkboxes (Space)', () => {
    expect(isActivationKey(key({ key: 'Enter' }), 'Enter')).toBe(true);
    expect(isActivationKey(key({ key: ' ' }), 'Enter')).toBe(false);
    expect(isActivationKey(key({ key: ' ' }), 'Space')).toBe(true);
    expect(isActivationKey(key({ key: 'Enter' }), 'Space')).toBe(false);
  });

  it('counts Ctrl, Meta and Alt as command modifiers, not Shift', () => {
    expect(hasCommandModifier(key({ key: 'a', altKey: true }))).toBe(true);
    expect(hasCommandModifier(key({ key: 'a', shiftKey: true }))).toBe(false);
  });
});

describe('navigation intents', () => {
  it('follows the orientation of the widget', () => {
    const horizontal = { orientation: 'horizontal' } as const;
    const vertical = { orientation: 'vertical' } as const;
    expect(getNavigationIntent(key({ key: 'ArrowRight' }), horizontal)).toBe('next');
    expect(getNavigationIntent(key({ key: 'ArrowLeft' }), horizontal)).toBe('previous');
    expect(getNavigationIntent(key({ key: 'ArrowDown' }), horizontal)).toBeNull();
    expect(getNavigationIntent(key({ key: 'ArrowDown' }), vertical)).toBe('next');
    expect(getNavigationIntent(key({ key: 'ArrowUp' }), vertical)).toBe('previous');
    expect(getNavigationIntent(key({ key: 'ArrowRight' }), vertical)).toBeNull();
    const both = { orientation: 'both' } as const;
    expect(
      ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].map((k) =>
        getNavigationIntent(key({ key: k }), both)
      )
    ).toEqual(['next', 'next', 'previous', 'previous']);
  });

  it('flips the horizontal arrows in right-to-left text', () => {
    const container = document.createElement('div');
    container.setAttribute('dir', 'rtl');
    const item = document.createElement('button');
    container.append(item);
    document.body.append(container);
    const direction = directionOf(item);
    expect(direction).toBe('rtl');
    const options = { orientation: 'horizontal', direction } as const;
    expect(getNavigationIntent(key({ key: 'ArrowLeft' }), options)).toBe('next');
    expect(getNavigationIntent(key({ key: 'ArrowRight' }), options)).toBe('previous');
    // Vertical arrows and Home and End do not depend on direction.
    expect(getNavigationIntent(key({ key: 'Home' }), options)).toBe('first');
    expect(
      getNavigationIntent(key({ key: 'ArrowDown' }), { orientation: 'vertical', direction })
    ).toBe('next');
    expect(flipArrowForDirection('ArrowLeft', 'rtl')).toBe('ArrowRight');
    expect(flipArrowForDirection('Left', 'ltr')).toBe('ArrowLeft');
    expect(flipArrowForDirection('ArrowUp', 'rtl')).toBe('ArrowUp');
    container.remove();
  });

  it('handles Home and End by default and page keys on request', () => {
    const list = { orientation: 'vertical' } as const;
    expect(getNavigationIntent(key({ key: 'Home' }), list)).toBe('first');
    expect(getNavigationIntent(key({ key: 'End' }), list)).toBe('last');
    expect(getNavigationIntent(key({ key: 'Home' }), { ...list, homeEnd: false })).toBeNull();
    expect(getNavigationIntent(key({ key: 'PageDown' }), list)).toBeNull();
    const paged = { ...list, pageKeys: true };
    expect(getNavigationIntent(key({ key: 'PageDown' }), paged)).toBe('page-next');
    expect(getNavigationIntent(key({ key: 'PageUp' }), paged)).toBe('page-previous');
  });

  it('leaves platform chords alone but lets Shift through', () => {
    const list = { orientation: 'vertical' } as const;
    expect(getNavigationIntent(key({ key: 'ArrowDown', metaKey: true }), list)).toBeNull();
    expect(getNavigationIntent(key({ key: 'ArrowDown', ctrlKey: true }), list)).toBeNull();
    expect(getNavigationIntent(key({ key: 'ArrowDown', altKey: true }), list)).toBeNull();
    expect(getNavigationIntent(key({ key: 'ArrowDown', shiftKey: true }), list)).toBe('next');
    expect(getNavigationIntent(key({ key: 'a' }), list)).toBeNull();
    expect(getNavigationIntent({ key: 'Down' }, list)).toBe('next');
  });
});

describe('isTextEntryTarget', () => {
  const make = (html: string) => {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.firstElementChild;
  };

  it('treats typing surfaces as text entry', () => {
    for (const html of [
      '<input>',
      '<input type="search">',
      '<input type="EMAIL">',
      '<textarea></textarea>',
      '<select></select>',
      '<div contenteditable></div>',
      '<div contenteditable="true"></div>',
      '<div contenteditable="plaintext-only"></div>',
      '<div role="textbox"></div>',
      '<div role="combobox"></div>',
    ]) {
      expect(isTextEntryTarget(make(html)), html).toBe(true);
    }
  });

  it('leaves buttons, checkboxes and plain elements to shortcuts', () => {
    for (const html of [
      '<input type="checkbox">',
      '<input type="button">',
      '<input type="range">',
      '<button></button>',
      '<div contenteditable="false"></div>',
      '<div tabindex="0"></div>',
    ]) {
      expect(isTextEntryTarget(make(html)), html).toBe(false);
    }
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget(document)).toBe(false);
    expect(isTextEntryTarget(window)).toBe(false);
  });
});

describe('parseShortcut and resolveShortcut', () => {
  it('reads modifiers in any order and case, with aliases', () => {
    expect(parseShortcut('Mod+Shift+K')).toEqual({
      key: 'k',
      mod: true,
      ctrl: false,
      meta: false,
      alt: false,
      shift: true,
    });
    expect(parseShortcut('shift+cmd+option+ctrl+p')).toEqual({
      key: 'p',
      mod: false,
      ctrl: true,
      meta: true,
      alt: true,
      shift: true,
    });
    expect(parseShortcut('Alt+Up').key).toBe('ArrowUp');
    expect(parseShortcut('Escape').key).toBe('Escape');
    expect(parseShortcut('Mod+Plus').key).toBe('+');
    expect(parseShortcut('F12').key).toBe('F12');
    expect(parseShortcut('?').key).toBe('?');
  });

  it('rejects malformed shortcuts with a RangeError', () => {
    for (const bad of [
      '',
      'Mod+',
      '+',
      'Hyper+K',
      'Mod+Mod+K',
      'Ctrl+Shift',
      'Mod+Enterr',
      'F25',
    ]) {
      expect(() => parseShortcut(bad), bad).toThrow(RangeError);
    }
  });

  it('resolves Mod to Meta on mac and Ctrl elsewhere', () => {
    expect(resolveShortcut('Mod+K', 'mac')).toMatchObject({ meta: true, ctrl: false });
    expect(resolveShortcut('Mod+K', 'other')).toMatchObject({ meta: false, ctrl: true });
    expect(resolveShortcut('Ctrl+K', 'mac')).toMatchObject({ meta: false, ctrl: true });
  });
});

describe('detectPlatform', () => {
  it('reads an explicit navigator only', () => {
    expect(detectPlatform({ platform: 'MacIntel' })).toBe('mac');
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)' })).toBe(
      'mac'
    );
    expect(detectPlatform({ userAgentData: { platform: 'macOS' } })).toBe('mac');
    expect(detectPlatform({ platform: 'Win32' })).toBe('other');
    expect(detectPlatform({ userAgentData: { platform: 'Linux' } })).toBe('other');
    expect(detectPlatform(undefined)).toBe('other');
  });
});

describe('matchesShortcut', () => {
  it('requires exactly the written modifiers', () => {
    expect(matchesShortcut(key({ key: 'k', metaKey: true }), 'Mod+K', 'mac')).toBe(true);
    expect(matchesShortcut(key({ key: 'k', ctrlKey: true }), 'Mod+K', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: 'k', ctrlKey: true }), 'Mod+K', 'mac')).toBe(false);
    expect(matchesShortcut(key({ key: 'K', metaKey: true, shiftKey: true }), 'Mod+K', 'mac')).toBe(
      false
    );
    expect(
      matchesShortcut(key({ key: 'K', metaKey: true, shiftKey: true }), 'Mod+Shift+K', 'mac')
    ).toBe(true);
    expect(matchesShortcut(key({ key: 'k' }), 'Mod+K', 'mac')).toBe(false);
    expect(matchesShortcut(key({ key: 'Escape' }), 'Escape', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: 'Esc' }), 'Escape', 'other')).toBe(true);
  });

  it('ignores Shift for symbols it does not name, and honors it when it does', () => {
    expect(matchesShortcut(key({ key: '?', shiftKey: true }), '?', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: '?' }), '?', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: '?' }), 'Shift+?', 'other')).toBe(false);
    // Letters keep Shift strict: a single-key "k" is not Shift+K.
    expect(matchesShortcut(key({ key: 'K', shiftKey: true }), 'k', 'other')).toBe(false);
  });

  it('falls back to the physical key when the typed character differs', () => {
    // ⌥K types "˚" on macOS.
    expect(matchesShortcut(key({ key: '˚', code: 'KeyK', altKey: true }), 'Alt+K', 'mac')).toBe(
      true
    );
    // A Cyrillic layout types "л" on the K key.
    expect(matchesShortcut(key({ key: 'л', code: 'KeyK', ctrlKey: true }), 'Mod+K', 'other')).toBe(
      true
    );
    expect(
      matchesShortcut(
        key({ key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true }),
        'Ctrl+Shift+1',
        'other'
      )
    ).toBe(true);
    expect(matchesShortcut(key({ key: 'л', code: 'KeyL', ctrlKey: true }), 'Mod+K', 'other')).toBe(
      false
    );
  });

  it('skips auto-repeat unless asked', () => {
    const held = key({ key: 'k', ctrlKey: true, repeat: true });
    expect(matchesShortcut(held, 'Mod+K', 'other')).toBe(false);
    expect(matchesShortcut(held, 'Mod+K', 'other', { allowRepeat: true })).toBe(true);
  });
});

describe('createShortcutMap', () => {
  const bindings = [
    { id: 'palette', keys: ['Mod+K', 'Mod+P'] },
    { id: 'help', keys: '?' },
    { id: 'close', keys: 'Escape' },
  ] as const;

  it('returns the bound id, trying alternatives', () => {
    const map = createShortcutMap(bindings, 'mac');
    expect(map.platform).toBe('mac');
    expect(map.match(key({ key: 'p', metaKey: true }))).toBe('palette');
    expect(map.match(key({ key: '?', shiftKey: true }))).toBe('help');
    expect(map.match(key({ key: 'Escape' }))).toBe('close');
    expect(map.match(key({ key: 'x' }))).toBeNull();
  });

  it('describes bindings for people and for aria-keyshortcuts', () => {
    const mac = createShortcutMap(bindings, 'mac');
    expect(mac.describe('palette')).toEqual(['⌘K', '⌘P']);
    expect(mac.describe('palette', 'text')).toEqual(['Cmd+K', 'Cmd+P']);
    expect(mac.ariaKeyShortcuts('palette')).toBe('Meta+K Meta+P');
    const other = createShortcutMap(bindings, 'other');
    expect(other.describe('palette')).toEqual(['Ctrl+K', 'Ctrl+P']);
    expect(other.ariaKeyShortcuts('palette')).toBe('Control+K Control+P');
    expect(() => other.describe('missing' as never)).toThrow(RangeError);
  });

  it('rejects conflicts, repeated ids and empty bindings when it is built', () => {
    expect(() =>
      createShortcutMap(
        [
          { id: 'a', keys: 'Mod+K' },
          { id: 'b', keys: 'Meta+K' },
        ],
        'mac'
      )
    ).toThrow(/conflicts with "a" on mac/);
    // The same bindings do not collide where Mod means Ctrl.
    expect(() =>
      createShortcutMap(
        [
          { id: 'a', keys: 'Mod+K' },
          { id: 'b', keys: 'Meta+K' },
        ],
        'other'
      )
    ).not.toThrow();
    expect(() =>
      createShortcutMap(
        [
          { id: 'a', keys: 'K' },
          { id: 'a', keys: 'J' },
        ],
        'other'
      )
    ).toThrow(/bound twice/);
    expect(() => createShortcutMap([{ id: 'a', keys: [] }], 'other')).toThrow(/no keys/);
  });
});

describe('formatShortcut and ariaKeyShortcuts', () => {
  it('uses the platform convention and the ⌃⌥⇧⌘ order on mac', () => {
    expect(formatShortcut('Mod+Shift+Alt+Ctrl+K', 'mac')).toBe('⌃⌥⇧⌘K');
    expect(formatShortcut('Mod+Shift+K', 'other')).toBe('Ctrl+Shift+K');
    expect(formatShortcut('Alt+ArrowUp', 'mac', 'text')).toBe('Option+Up');
    expect(formatShortcut('Alt+ArrowUp', 'mac')).toBe('⌥↑');
    expect(formatShortcut('Enter', 'other')).toBe('↵');
    expect(formatShortcut('Space', 'other', 'text')).toBe('Space');
  });

  it('names modifiers the way aria-keyshortcuts expects', () => {
    expect(ariaKeyShortcuts('Mod+Shift+K', 'mac')).toBe('Shift+Meta+K');
    expect(ariaKeyShortcuts('Mod+Shift+K', 'other')).toBe('Control+Shift+K');
    expect(ariaKeyShortcuts('Mod+Plus', 'other')).toBe('Control+Plus');
    expect(ariaKeyShortcuts('Space', 'other')).toBe('Space');
    expect(ariaKeyShortcuts('Alt+ArrowDown', 'other')).toBe('Alt+ArrowDown');
  });
});
