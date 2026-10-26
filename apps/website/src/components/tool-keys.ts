/**
 * Shared keyboard shortcuts for the studio and tool islands (T-82 punch-list
 * row 4). One pure matcher so every tool documents and behaves the same way:
 *
 * - single-key shortcuts are active only while the focus is inside the tool
 *   (WCAG 2.1.4, "active only on focus", T-88): a keyboard or speech-input
 *   user elsewhere on the page, or on the page body, never fires one;
 * - they never fire while the focus is in a field (input, textarea, select or
 *   contenteditable) or in an ARIA widget that answers printable keys itself
 *   (listbox, menu, tree, grid and combobox typeahead), so typing is never
 *   hijacked, and never for a press another handler already consumed;
 * - they never combine with Control, Meta or Alt, so browser and assistive
 *   shortcuts keep working (Shift is allowed: `?` is Shift+Slash);
 * - the map keys are literal `event.key` values (`g`, `d`, `?`); an uppercase
 *   press falls back to its lowercase entry so Caps Lock stays harmless;
 * - a handled shortcut prevents the default action, so `/` never also types
 *   a slash into the field it focuses.
 */

/** Map of `event.key` (lowercase for letters) to a tool action name. */
export type ToolShortcutMap = Readonly<Record<string, string>>;

/** Roles whose APG patterns answer printable keys (typeahead) themselves. */
const TYPEAHEAD_WIDGETS =
  '[role="listbox"], [role="menu"], [role="menubar"], [role="tree"], [role="treegrid"], [role="grid"], [role="combobox"]';

/** True while the focus sits in a surface that consumes single keys itself. */
export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
    return true;
  }
  return target.closest(TYPEAHEAD_WIDGETS) !== null;
}

/**
 * The action a key press asks for, or `null` when the press belongs to the
 * focused control, a modifier combo, a consumed event, or a key the map does
 * not list.
 */
export function toolShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'> & {
    defaultPrevented?: boolean;
  },
  target: EventTarget | null | undefined,
  map: ToolShortcutMap
): string | null {
  if (event.defaultPrevented) return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (isEditableTarget(target)) return null;
  const key = event.key;
  if (key.length !== 1) return null;
  return map[key] ?? map[key.toLowerCase()] ?? null;
}

/**
 * Runs the shortcut a press asks for when the focus is inside `scope` (the
 * tool's root element), preventing the default action. Returns whether it ran.
 */
export function runToolShortcut(
  event: KeyboardEvent,
  scope: Element | null | undefined,
  map: ToolShortcutMap,
  run: (action: string) => void
): boolean {
  const target = event.target;
  if (!scope || !(target instanceof Node) || !scope.contains(target)) return false;
  const action = toolShortcut(event, target, map);
  if (!action) return false;
  event.preventDefault();
  run(action);
  return true;
}
