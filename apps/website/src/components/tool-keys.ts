/**
 * Shared keyboard shortcuts for the studio and tool islands (T-82 punch-list
 * row 4). One pure matcher so every tool documents and behaves the same way:
 *
 * - single-key shortcuts never fire while the focus is in a field (input,
 *   textarea, select or contenteditable), so typing is never hijacked;
 * - they never combine with Control, Meta or Alt, so browser and assistive
 *   shortcuts keep working (Shift is allowed: `?` is Shift+Slash);
 * - the map keys are literal `event.key` values (`g`, `d`, `?`); an uppercase
 *   press falls back to its lowercase entry so Caps Lock stays harmless.
 */

/** Map of `event.key` (lowercase for letters) to a tool action name. */
export type ToolShortcutMap = Readonly<Record<string, string>>;

/** True while the focus sits in a surface that consumes single keys itself. */
export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * The action a key press asks for, or `null` when the press belongs to the
 * focused control, a modifier combo, or a key the map does not list.
 */
export function toolShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
  target: EventTarget | null | undefined,
  map: ToolShortcutMap
): string | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (isEditableTarget(target)) return null;
  const key = event.key;
  if (key.length !== 1) return null;
  return map[key] ?? map[key.toLowerCase()] ?? null;
}
