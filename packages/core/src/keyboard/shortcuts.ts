import { isComposing, type KeyboardEventLike, normalizeKey } from './keys.ts';

/**
 * Keyboard shortcuts written as data: `'Mod+K'`, `'Shift+?'`, `'Alt+ArrowUp'`.
 *
 * - `Mod` is the platform's command key: ⌘ (Meta) on Apple platforms, Ctrl
 *   elsewhere. Use it for application shortcuts so one string works on both.
 * - `Ctrl` (or `Control`), `Meta` (or `Cmd`, `Command`), `Alt` (or `Option`)
 *   and `Shift` name a specific key.
 * - The last part is one key: a character (case-insensitive) or a standard
 *   key name (`Enter`, `Escape`, `ArrowUp`, `Space`, `F2`…).
 *
 * Nothing here reads `navigator`: pass the platform, which `detectPlatform`
 * can derive from a navigator you hand it.
 */

export type ShortcutPlatform = 'mac' | 'other';

export interface ParsedShortcut {
  /** The normalized key (see `normalizeKey`). */
  key: string;
  /** `Mod` was written: Meta on mac, Ctrl elsewhere. */
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

/** The modifier keys actually held for a shortcut on one platform. */
export interface ResolvedShortcut {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

const MODIFIER_ALIASES: Readonly<Record<string, 'mod' | 'ctrl' | 'meta' | 'alt' | 'shift'>> = {
  mod: 'mod',
  ctrl: 'ctrl',
  control: 'ctrl',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  shift: 'shift',
};

/** Standard key names a shortcut may spell in any case. */
const STANDARD_KEYS =
  'Enter Escape Space Tab Backspace Delete Insert Home End PageUp PageDown ArrowUp ArrowDown ArrowLeft ArrowRight ContextMenu'.split(
    ' '
  );

/** Short spellings of standard keys. */
const KEY_ALIASES: Readonly<Record<string, string>> = {
  return: 'Enter',
  esc: 'Escape',
  del: 'Delete',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  plus: '+',
};

function namedKey(part: string): string | null {
  const lower = part.toLowerCase();
  const named = KEY_ALIASES[lower] ?? STANDARD_KEYS.find((name) => name.toLowerCase() === lower);
  if (named) return named;
  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(lower)) return lower.toUpperCase();
  return part.length === 1 ? normalizeKey(part) : null;
}

const invalid = (shortcut: string, why: string) =>
  new RangeError(`Invalid shortcut "${shortcut}": ${why}.`);

/**
 * Parses `'Mod+Shift+K'` into its key and modifiers. Throws a `RangeError`
 * for an empty shortcut, an unknown modifier or key, a repeated modifier, or
 * a shortcut with no key (`'Mod+'`). Use `Plus` for the `+` key.
 */
export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split('+').map((part) => part.trim());
  if (parts.some((part) => part === '')) {
    throw invalid(shortcut, 'empty part (write Plus for the + key)');
  }
  const keyPart = parts.pop() as string;
  const parsed: ParsedShortcut = {
    key: '',
    mod: false,
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
  };
  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (!modifier) throw invalid(shortcut, `"${part}" is not a modifier`);
    if (parsed[modifier]) throw invalid(shortcut, `${modifier} is repeated`);
    parsed[modifier] = true;
  }
  const key = MODIFIER_ALIASES[keyPart.toLowerCase()] ? null : namedKey(keyPart);
  if (!key) throw invalid(shortcut, `"${keyPart}" is not a key`);
  parsed.key = key;
  return parsed;
}

/** Resolves `Mod` for a platform: Meta on mac, Ctrl elsewhere. */
export function resolveShortcut(
  shortcut: string | ParsedShortcut,
  platform: ShortcutPlatform
): ResolvedShortcut {
  const parsed = typeof shortcut === 'string' ? parseShortcut(shortcut) : shortcut;
  return {
    key: parsed.key,
    ctrl: parsed.ctrl || (parsed.mod && platform === 'other'),
    meta: parsed.meta || (parsed.mod && platform === 'mac'),
    alt: parsed.alt,
    shift: parsed.shift,
  };
}

/** The navigator fields `detectPlatform` reads. */
export interface PlatformSource {
  platform?: string;
  userAgent?: string;
  userAgentData?: { platform?: string } | null;
}

/**
 * `mac` on macOS, iOS and iPadOS (where ⌘ is the command key), `other`
 * elsewhere. Pass `navigator` explicitly; without one the answer is `other`.
 */
export function detectPlatform(source?: PlatformSource | null): ShortcutPlatform {
  const value = `${source?.userAgentData?.platform ?? ''} ${source?.platform ?? ''} ${source?.userAgent ?? ''}`;
  return /mac|iphone|ipad|ipod/i.test(value) ? 'mac' : 'other';
}

/** `KeyA` → `a`, `Digit1` → `1`: the physical key, for layouts that type other characters. */
function keyFromCode(code: string | undefined): string | null {
  const match = /^(?:Key([A-Z])|(?:Digit|Numpad)([0-9]))$/.exec(code ?? '');
  return match ? (match[1] ?? match[2] ?? '').toLowerCase() : null;
}

/** True for a printable character that is not a letter or digit (`?`, `/`, `[`). */
function isSymbol(key: string): boolean {
  return key.length === 1 && !/[\p{L}\p{N}]/u.test(key);
}

export interface MatchOptions {
  /** Match auto-repeated keydowns (held keys). Defaults to `false`. */
  allowRepeat?: boolean;
}

/**
 * True when `event` is exactly `shortcut` on `platform`. Every modifier must
 * match: `Mod+K` does not match ⌘⇧K. Two allowances keep shortcuts working on
 * real keyboards:
 *
 * - a symbol key (`?`, `/`) written without `Shift` ignores Shift, since many
 *   layouts need it to type the symbol;
 * - when the typed character differs (⌥K types `˚` on macOS, or a non-Latin
 *   layout is active), a letter or digit falls back to the physical key code.
 *
 * Composing events and (by default) repeats never match.
 */
export function matchesShortcut(
  event: KeyboardEventLike,
  shortcut: string | ParsedShortcut | ResolvedShortcut,
  platform: ShortcutPlatform,
  options: MatchOptions = {}
): boolean {
  if (isComposing(event)) return false;
  if (event.repeat === true && options.allowRepeat !== true) return false;
  const want =
    typeof shortcut === 'string' || 'mod' in shortcut
      ? resolveShortcut(shortcut, platform)
      : shortcut;
  if ((event.ctrlKey === true) !== want.ctrl) return false;
  if ((event.metaKey === true) !== want.meta) return false;
  if ((event.altKey === true) !== want.alt) return false;
  const shiftMatters = want.shift || !isSymbol(want.key);
  if (shiftMatters && (event.shiftKey === true) !== want.shift) return false;
  return normalizeKey(event.key) === want.key || keyFromCode(event.code) === want.key;
}

export interface ShortcutBinding<Id extends string = string> {
  id: Id;
  /** One shortcut, or alternatives (`['Mod+K', 'Mod+P']`). */
  keys: string | readonly string[];
}

export interface ShortcutMap<Id extends string = string> {
  readonly platform: ShortcutPlatform;
  /** The id of the binding `event` triggers, or `null`. */
  match(event: KeyboardEventLike, options?: MatchOptions): Id | null;
  /** Each binding's shortcuts, formatted for display on this platform. */
  describe(id: Id, style?: ShortcutStyle): string[];
  /** The `aria-keyshortcuts` value for a binding (all alternatives). */
  ariaKeyShortcuts(id: Id): string;
}

/**
 * Compiles bindings for one platform. Every shortcut is parsed once, and two
 * bindings that resolve to the same chord throw a `RangeError` naming both,
 * so a conflict is found when the map is built, not when a key is pressed.
 * Bindings are tried in order; the first match wins.
 */
export function createShortcutMap<Id extends string>(
  bindings: readonly ShortcutBinding<Id>[],
  platform: ShortcutPlatform
): ShortcutMap<Id> {
  const compiled: { id: Id; resolved: ResolvedShortcut }[] = [];
  const owners = new Map<string, Id>();
  const byId = new Map<Id, string[]>();
  for (const { id, keys } of bindings) {
    if (byId.has(id)) throw new RangeError(`Shortcut id "${id}" is bound twice.`);
    const list = typeof keys === 'string' ? [keys] : [...keys];
    if (list.length === 0) throw new RangeError(`Shortcut "${id}" has no keys.`);
    byId.set(id, list);
    for (const source of list) {
      const resolved = resolveShortcut(source, platform);
      const { ctrl, meta, alt, shift, key } = resolved;
      const chord = `${+ctrl}${+meta}${+alt}${+shift}${key}`;
      const owner = owners.get(chord);
      if (owner !== undefined) {
        throw new RangeError(
          `Shortcut "${source}" of "${id}" conflicts with "${owner}" on ${platform}.`
        );
      }
      owners.set(chord, id);
      compiled.push({ id, resolved });
    }
  }
  const keysOf = (id: Id): string[] => {
    const keys = byId.get(id);
    if (!keys) throw new RangeError(`No shortcut is bound to "${id}".`);
    return keys;
  };
  return {
    platform,
    match(event, options) {
      return (
        compiled.find((entry) => matchesShortcut(event, entry.resolved, platform, options))?.id ??
        null
      );
    },
    describe(id, style = 'symbols') {
      return keysOf(id).map((source) => formatShortcut(source, platform, style));
    },
    ariaKeyShortcuts(id) {
      return keysOf(id)
        .map((source) => ariaKeyShortcuts(source, platform))
        .join(' ');
    },
  };
}

/** `symbols` (⌘⇧K on mac, Ctrl+Shift+K elsewhere) or `text` (Cmd+Shift+K). */
export type ShortcutStyle = 'symbols' | 'text';

/** `[symbol, text]` labels for keys that read better than their names. */
const DISPLAY_KEYS: Readonly<Record<string, readonly [string, string]>> = {
  ArrowUp: ['↑', 'Up'],
  ArrowDown: ['↓', 'Down'],
  ArrowLeft: ['←', 'Left'],
  ArrowRight: ['→', 'Right'],
  Enter: ['↵', 'Enter'],
  Escape: ['Esc', 'Esc'],
  Backspace: ['⌫', 'Backspace'],
  Delete: ['Del', 'Delete'],
  Tab: ['⇥', 'Tab'],
  PageUp: ['PgUp', 'Page Up'],
  PageDown: ['PgDn', 'Page Down'],
};

/**
 * A shortcut for people to read, in the platform's convention: on mac,
 * modifiers in ⌃⌥⇧⌘ order with no separator (`⌘⇧K`); elsewhere `Ctrl+Shift+K`.
 * The labels are symbols and key names, not translatable words.
 */
export function formatShortcut(
  shortcut: string,
  platform: ShortcutPlatform,
  style: ShortcutStyle = 'symbols'
): string {
  const { ctrl, alt, shift, meta, key } = resolveShortcut(shortcut, platform);
  const label =
    DISPLAY_KEYS[key]?.[style === 'symbols' ? 0 : 1] ??
    (key.length === 1 ? key.toUpperCase() : key);
  const mac = platform === 'mac';
  if (mac && style === 'symbols') {
    return `${ctrl ? '⌃' : ''}${alt ? '⌥' : ''}${shift ? '⇧' : ''}${meta ? '⌘' : ''}${label}`;
  }
  return [
    ctrl && 'Ctrl',
    alt && (mac ? 'Option' : 'Alt'),
    shift && 'Shift',
    meta && (mac ? 'Cmd' : 'Meta'),
    label,
  ]
    .filter(Boolean)
    .join('+');
}

/**
 * The WAI-ARIA `aria-keyshortcuts` token for a shortcut on one platform:
 * modifiers named `Control`, `Alt`, `Shift`, `Meta`, then the key (`Space`
 * for the space bar, `Plus` for `+`). Several alternatives join with a space.
 */
export function ariaKeyShortcuts(shortcut: string, platform: ShortcutPlatform): string {
  const { ctrl, alt, shift, meta, key } = resolveShortcut(shortcut, platform);
  return [
    ctrl && 'Control',
    alt && 'Alt',
    shift && 'Shift',
    meta && 'Meta',
    key === '+' ? 'Plus' : key.length === 1 ? key.toUpperCase() : key,
  ]
    .filter(Boolean)
    .join('+');
}
