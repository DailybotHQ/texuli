import type { TextDirection } from '../dir-locale/dir-locale.ts';

/**
 * The parts of a `KeyboardEvent` the keyboard texels read. A real event
 * satisfies it; tests and non-DOM callers can pass a plain object.
 */
export interface KeyboardEventLike {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  /** Legacy: 229 while an IME processes the key (Safari reports it before `isComposing`). */
  keyCode?: number;
}

/** Old and alternative `key` values, mapped to the current standard names. */
const LEGACY_KEYS: Readonly<Record<string, string>> = {
  ' ': 'Space',
  Spacebar: 'Space',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Esc: 'Escape',
  Del: 'Delete',
  Apps: 'ContextMenu',
  Scroll: 'ScrollLock',
  OS: 'Meta',
  Win: 'Meta',
};

/**
 * The standard name of a key: legacy names become current ones (`Esc` →
 * `Escape`, `Left` → `ArrowLeft`), the space bar is `Space` (never `' '`),
 * and a single letter is lowercased. Other single characters stay as typed.
 */
export function normalizeKey(key: string): string {
  const mapped = LEGACY_KEYS[key];
  if (mapped) return mapped;
  return key.length === 1 ? key.toLowerCase() : key;
}

/**
 * True while an input method editor (IME) composes text. Key handling must
 * ignore these events: Enter confirms a Japanese or Chinese candidate, and
 * arrows move inside the composition, not the widget.
 */
export function isComposing(event: KeyboardEventLike): boolean {
  return event.isComposing === true || event.keyCode === 229 || event.key === 'Process';
}

/** True when Ctrl, Meta or Alt is held (Shift alone does not count). */
export function hasCommandModifier(event: KeyboardEventLike): boolean {
  return event.ctrlKey === true || event.metaKey === true || event.altKey === true;
}

/**
 * Enter or Space with no command modifier and no composition: the keys that
 * activate a button-like control. `which` narrows it to one of them, for
 * widgets that activate on Enter only (links) or Space only (checkboxes).
 */
export function isActivationKey(
  event: KeyboardEventLike,
  which: 'any' | 'Enter' | 'Space' = 'any'
): boolean {
  if (isComposing(event) || hasCommandModifier(event)) return false;
  const key = normalizeKey(event.key);
  if (key !== 'Enter' && key !== 'Space') return false;
  return which === 'any' || key === which;
}

/**
 * Swaps `ArrowLeft` and `ArrowRight` in right-to-left text, so callers can
 * treat ArrowRight as "toward the inline end" in every direction. Other keys
 * are returned normalized and unchanged.
 */
export function flipArrowForDirection(key: string, direction: TextDirection): string {
  const normalized = normalizeKey(key);
  if (direction !== 'rtl') return normalized;
  if (normalized === 'ArrowLeft') return 'ArrowRight';
  if (normalized === 'ArrowRight') return 'ArrowLeft';
  return normalized;
}

/** What a navigation key asks a composite widget (list, tabs, menu, grid row) to do. */
export type NavigationIntent =
  | 'next'
  | 'previous'
  | 'first'
  | 'last'
  | 'page-next'
  | 'page-previous';

export interface NavigationOptions {
  /** Which arrows move: `horizontal` (tabs, toolbars), `vertical` (lists, menus) or `both` (grids). */
  orientation: 'horizontal' | 'vertical' | 'both';
  /** Text direction; in `rtl`, ArrowLeft moves forward. Defaults to `ltr`. */
  direction?: TextDirection;
  /** Home and End jump to the first and last item. Defaults to `true`. */
  homeEnd?: boolean;
  /** PageUp and PageDown move a page. Defaults to `false`. */
  pageKeys?: boolean;
}

/**
 * The navigation a key asks for, or `null`. Arrows follow `orientation` and
 * flip in RTL; Home and End and (opt-in) PageUp and PageDown are direction
 * independent. A composing key, or one held with Ctrl, Meta or Alt, never
 * navigates (those belong to the platform, for example ⌘← on macOS). Shift is
 * allowed: the caller decides whether it extends a selection.
 */
export function getNavigationIntent(
  event: KeyboardEventLike,
  options: NavigationOptions
): NavigationIntent | null {
  if (isComposing(event) || hasCommandModifier(event)) return null;
  const { orientation, direction = 'ltr', homeEnd = true, pageKeys = false } = options;
  const key = flipArrowForDirection(event.key, direction);
  const horizontal = orientation !== 'vertical';
  const vertical = orientation !== 'horizontal';
  switch (key) {
    case 'ArrowRight':
      return horizontal ? 'next' : null;
    case 'ArrowLeft':
      return horizontal ? 'previous' : null;
    case 'ArrowDown':
      return vertical ? 'next' : null;
    case 'ArrowUp':
      return vertical ? 'previous' : null;
    case 'Home':
      return homeEnd ? 'first' : null;
    case 'End':
      return homeEnd ? 'last' : null;
    case 'PageDown':
      return pageKeys ? 'page-next' : null;
    case 'PageUp':
      return pageKeys ? 'page-previous' : null;
    default:
      return null;
  }
}

/** `input` types that do not take typed text (their keys are safe for shortcuts). */
const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/**
 * True when `target` is where the user types text: a text-like `<input>`,
 * a `<textarea>`, a `<select>`, a `contenteditable` element or a textbox
 * role. Single-key shortcuts should not fire there.
 */
export function isTextEntryTarget(target: EventTarget | null | undefined): boolean {
  const element = target as Element | null | undefined;
  if (!element || typeof element.tagName !== 'string') return false;
  const tag = element.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') {
    const type = (element.getAttribute('type') ?? 'text').toLowerCase();
    return !NON_TEXT_INPUTS.has(type);
  }
  if ((element as HTMLElement).isContentEditable === true) return true;
  const editable = element.getAttribute('contenteditable');
  if (editable !== null && editable.toLowerCase() !== 'false') return true;
  const role = element.getAttribute('role');
  return role === 'textbox' || role === 'searchbox' || role === 'combobox';
}
