/**
 * T-82 — the shared tool keyboard matcher (punch-list row 4): single-key
 * shortcuts fire only outside fields and never with Control, Meta or Alt,
 * so typing and browser shortcuts stay untouched on every studio island.
 */
import { describe, expect, it } from 'vitest';
import { isEditableTarget, toolShortcut } from '../src/components/tool-keys.ts';

const KEYS = { g: 'generate', d: 'mode', c: 'copy', r: 'render', '/': 'filter', '?': 'keys' };

function press(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  } as KeyboardEvent;
}

describe('toolShortcut', () => {
  it('maps bare presses through the tool map', () => {
    expect(toolShortcut(press('g'), null, KEYS)).toBe('generate');
    expect(toolShortcut(press('r'), null, KEYS)).toBe('render');
    expect(toolShortcut(press('?'), null, KEYS)).toBe('keys');
  });

  it('falls back to the lowercase entry so Caps Lock stays harmless', () => {
    expect(toolShortcut(press('G'), null, KEYS)).toBe('generate');
    expect(toolShortcut(press('D'), null, KEYS)).toBe('mode');
  });

  it('never fires inside a field', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    for (const target of [input, textarea, select, editable]) {
      expect(toolShortcut(press('g'), target, KEYS)).toBeNull();
      expect(isEditableTarget(target)).toBe(true);
    }
    const button = document.createElement('button');
    expect(toolShortcut(press('g'), button, KEYS)).toBe('generate');
    expect(isEditableTarget(button)).toBe(false);
  });

  it('never fires with Control, Meta or Alt, and not for multi-key presses', () => {
    expect(toolShortcut(press('g', { ctrlKey: true }), null, KEYS)).toBeNull();
    expect(toolShortcut(press('g', { metaKey: true }), null, KEYS)).toBeNull();
    expect(toolShortcut(press('g', { altKey: true }), null, KEYS)).toBeNull();
    expect(toolShortcut(press('F6'), null, KEYS)).toBeNull();
    expect(toolShortcut(press('ArrowLeft'), null, KEYS)).toBeNull();
    expect(toolShortcut(press('z'), null, KEYS)).toBeNull();
  });
});
