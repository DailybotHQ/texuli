/**
 * Controls registry and pure input decisions.
 *
 * `DECK_CONTROLS` is the single source for the toolbar, help dialog and
 * `decideDeckInput` key map. No DOM: the host describes the event target as a
 * path of plain element facts (`inputPathFrom` builds it from a real path).
 *
 * Keys (Protoyard registry + Texuli Enter/Backspace):
 * → ↓ PageDown Space Enter / ← ↑ PageUp Shift+Space Backspace, Home/End,
 * O, F, S|P, B|., L, ?, Ctrl/⌘+P, D, Esc stack.
 * Swipe: ≥50 px, 1.5× dominance, <800 ms.
 */

export const DECK_INPUT_ACTIONS = [
  'next',
  'prev',
  'first',
  'last',
  'overview',
  'presenter',
  'fullscreen',
  'blackout',
  'laser',
  'help',
  'print',
  'fullscreen-exit',
  'copy-link',
  'jump',
  'debug',
] as const;
export type DeckAction = (typeof DECK_INPUT_ACTIONS)[number];
/** @deprecated Use {@link DeckAction}. */
export type DeckInputAction = DeckAction;

export const DECK_CONTROL_GROUPS = [
  'navigate',
  'view',
  'present',
  'share',
  'help',
  'debug',
] as const;
export type DeckControlGroup = (typeof DECK_CONTROL_GROUPS)[number];

export const DECK_CONTROL_CAPABILITIES = [
  'fullscreen',
  'popup',
  'clipboard',
  'print',
  'debug',
] as const;
export type DeckControlCapability = (typeof DECK_CONTROL_CAPABILITIES)[number];

export type DeckControlEnvironment = Readonly<Record<DeckControlCapability, boolean>>;

export const DEFAULT_DECK_CONTROL_ENVIRONMENT: DeckControlEnvironment = Object.freeze({
  fullscreen: true,
  popup: true,
  clipboard: true,
  print: true,
  debug: false,
});

export interface DeckControlKey {
  /** `KeyboardEvent.key` (letters match either case). */
  key: string;
  /** How a person reads it: `→`, `Page Down`, `Ctrl + P`. */
  label: string;
  /** `required` (Shift+Space), `allowed` (`?`). Omitted: no Shift. */
  shift?: 'required' | 'allowed';
  modifier?: 'ctrl' | 'meta';
  /** The key only closes this control while it is on (`Esc`). */
  closes?: boolean;
}

export interface DeckControl {
  action: DeckAction;
  group: DeckControlGroup;
  /** Message key for the short name (resolved through `DECK_MESSAGES`). */
  labelKey: string;
  /** Message key for the one-sentence description. */
  descriptionKey: string;
  keys: readonly DeckControlKey[];
  toggle: boolean;
  requires: readonly DeckControlCapability[];
  available: (env: DeckControlEnvironment) => boolean;
}

const ESC: DeckControlKey = { key: 'Escape', label: 'Esc', closes: true };

function control(
  spec: Omit<DeckControl, 'available' | 'requires'> & {
    requires?: readonly DeckControlCapability[];
  }
): DeckControl {
  const requires = Object.freeze([...(spec.requires ?? [])]) as readonly DeckControlCapability[];
  return Object.freeze({
    action: spec.action,
    group: spec.group,
    labelKey: spec.labelKey,
    descriptionKey: spec.descriptionKey,
    keys: Object.freeze(spec.keys.map((key) => Object.freeze({ ...key }))),
    toggle: spec.toggle,
    requires,
    available: (env: DeckControlEnvironment) => requires.every((need) => env[need] === true),
  });
}

/** Every deck control, in display order. */
export const DECK_CONTROLS: readonly DeckControl[] = Object.freeze([
  control({
    action: 'prev',
    group: 'navigate',
    labelKey: 'controls.previous',
    descriptionKey: 'controls.previousDescription',
    keys: [
      { key: 'ArrowLeft', label: '←' },
      { key: 'ArrowUp', label: '↑' },
      { key: 'PageUp', label: 'Page Up' },
      { key: ' ', label: 'Shift + Space', shift: 'required' },
      { key: 'Backspace', label: 'Backspace' },
    ],
    toggle: false,
  }),
  control({
    action: 'jump',
    group: 'navigate',
    labelKey: 'controls.chooseSlide',
    descriptionKey: 'controls.chooseSlideDescription',
    keys: [],
    toggle: false,
  }),
  control({
    action: 'next',
    group: 'navigate',
    labelKey: 'controls.next',
    descriptionKey: 'controls.nextDescription',
    keys: [
      { key: 'ArrowRight', label: '→' },
      { key: 'ArrowDown', label: '↓' },
      { key: 'PageDown', label: 'Page Down' },
      { key: ' ', label: 'Space' },
      { key: 'Enter', label: 'Enter' },
    ],
    toggle: false,
  }),
  control({
    action: 'first',
    group: 'navigate',
    labelKey: 'controls.first',
    descriptionKey: 'controls.firstDescription',
    keys: [{ key: 'Home', label: 'Home' }],
    toggle: false,
  }),
  control({
    action: 'last',
    group: 'navigate',
    labelKey: 'controls.last',
    descriptionKey: 'controls.lastDescription',
    keys: [{ key: 'End', label: 'End' }],
    toggle: false,
  }),
  control({
    action: 'overview',
    group: 'view',
    labelKey: 'controls.overview',
    descriptionKey: 'controls.overviewDescription',
    keys: [{ key: 'o', label: 'O' }, ESC],
    toggle: true,
  }),
  control({
    action: 'fullscreen',
    group: 'view',
    labelKey: 'controls.fullscreen',
    descriptionKey: 'controls.fullscreenDescription',
    keys: [{ key: 'f', label: 'F' }],
    toggle: true,
    requires: ['fullscreen'],
  }),
  control({
    action: 'fullscreen-exit',
    group: 'view',
    labelKey: 'controls.leaveFullscreen',
    descriptionKey: 'controls.leaveFullscreenDescription',
    keys: [ESC],
    toggle: false,
    requires: ['fullscreen'],
  }),
  control({
    action: 'presenter',
    group: 'present',
    labelKey: 'controls.presenter',
    descriptionKey: 'controls.presenterDescription',
    keys: [
      { key: 's', label: 'S' },
      { key: 'p', label: 'P' },
    ],
    toggle: true,
  }),
  control({
    action: 'blackout',
    group: 'present',
    labelKey: 'controls.blackout',
    descriptionKey: 'controls.blackoutDescription',
    keys: [{ key: 'b', label: 'B' }, { key: '.', label: '.' }, ESC],
    toggle: true,
  }),
  control({
    action: 'laser',
    group: 'present',
    labelKey: 'controls.laser',
    descriptionKey: 'controls.laserDescription',
    keys: [{ key: 'l', label: 'L' }, ESC],
    toggle: true,
  }),
  control({
    action: 'copy-link',
    group: 'share',
    labelKey: 'controls.copyLink',
    descriptionKey: 'controls.copyLinkDescription',
    keys: [],
    toggle: false,
    requires: ['clipboard'],
  }),
  control({
    action: 'print',
    group: 'share',
    labelKey: 'controls.print',
    descriptionKey: 'controls.printDescription',
    keys: [
      { key: 'p', label: 'Ctrl + P', modifier: 'ctrl' },
      { key: 'p', label: '⌘ + P', modifier: 'meta' },
    ],
    toggle: false,
    requires: ['print'],
  }),
  control({
    action: 'help',
    group: 'help',
    labelKey: 'controls.help',
    descriptionKey: 'controls.helpDescription',
    keys: [{ key: '?', label: '?', shift: 'allowed' }, ESC],
    toggle: true,
  }),
  control({
    action: 'debug',
    group: 'debug',
    labelKey: 'controls.debug',
    descriptionKey: 'controls.debugDescription',
    keys: [{ key: 'd', label: 'D' }, ESC],
    toggle: true,
    requires: ['debug'],
  }),
]);

const BY_ACTION = new Map(DECK_CONTROLS.map((item) => [item.action, item] as const));

/** Look up a control by action. Throws when the action is unknown. */
export function deckControlFor(action: DeckAction): DeckControl {
  const found = BY_ACTION.get(action);
  if (!found) throw new RangeError(`No deck control for the action "${action}".`);
  return found;
}

/** The controls that work in `env`, in display order. */
export function availableDeckControls(
  env: DeckControlEnvironment = DEFAULT_DECK_CONTROL_ENVIRONMENT
): DeckControl[] {
  return DECK_CONTROLS.filter((item) => item.available(env));
}

/** One help-dialog row: a control's keys, its action and its label key. */
export interface DeckKeyBinding {
  keys: readonly string[];
  action: DeckAction;
  labelKey: string;
}

/** Help-dialog rows for the controls available in `env`. */
export function deckKeyBindings(
  env: DeckControlEnvironment = DEFAULT_DECK_CONTROL_ENVIRONMENT
): DeckKeyBinding[] {
  return availableDeckControls(env)
    .filter((item) => item.keys.length > 0)
    .map((item) => ({
      keys: item.keys.map((key) => key.label),
      action: item.action,
      labelKey: item.labelKey,
    }));
}

/** Default-environment key bindings (debug omitted). */
export const DECK_KEY_BINDINGS: readonly DeckKeyBinding[] = Object.freeze(
  deckKeyBindings(DEFAULT_DECK_CONTROL_ENVIRONMENT)
);

/** A swipe must travel this far (CSS px) along its axis. */
export const DECK_SWIPE_MIN_DISTANCE = 50;
/** …and be this much longer on its axis than across it (axis lock). */
export const DECK_SWIPE_AXIS_RATIO = 1.5;
/** Slower drags are not swipes (they are reading or selecting). */
export const DECK_SWIPE_MAX_DURATION_MS = 800;

/** Interactive blocks put this on their root so clicks/swipes never move the deck. */
export const DECK_INTERACTIVE_ATTRIBUTE = 'data-tx-deck-interactive';
/** Deck chrome (progress, slide number, toolbar) carries this attribute. */
export const DECK_CHROME_ATTRIBUTE = 'data-tx-deck-chrome';

export interface DeckInputTarget {
  tag: string;
  role?: string;
  editable?: boolean;
  href?: boolean;
  attributes?: readonly string[];
}

export interface DeckInputState {
  /** `closing` covers the overview's exit transition (the double-advance bug). */
  overview?: 'closed' | 'open' | 'closing';
  blackout?: boolean;
  laser?: boolean;
  help?: boolean;
  fullscreen?: boolean;
  /** True when the debug panel is available; only then does D act. */
  debugAvailable?: boolean;
  /** True while the debug panel is open: Esc closes it first. */
  debug?: boolean;
  /** Flips left/right navigation when `rtl`. */
  dir?: 'ltr' | 'rtl' | 'auto';
}

interface Modifiers {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export type DeckInputEvent =
  | (Modifiers & {
      kind: 'key';
      key: string;
      repeat?: boolean;
      isComposing?: boolean;
      path?: readonly DeckInputTarget[];
    })
  | (Modifiers & {
      kind: 'click';
      button?: number;
      selectionLength?: number;
      path?: readonly DeckInputTarget[];
    })
  | {
      kind: 'swipe';
      dx: number;
      dy: number;
      durationMs?: number;
      pointerType?: 'touch' | 'pen' | 'mouse';
      path?: readonly DeckInputTarget[];
    };

const EDITABLE_TAGS = new Set(['input', 'textarea', 'select']);
const CONTROL_TAGS = new Set([
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'label',
  'summary',
  'details',
  'iframe',
  'video',
  'audio',
  'object',
  'embed',
]);
const CONTROL_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'spinbutton',
  'tab',
  'menuitem',
  'option',
  'textbox',
  'combobox',
  'listbox',
  'scrollbar',
]);

const hasAttribute = (target: DeckInputTarget, name: string) =>
  target.attributes?.includes(name) === true;

const isEditable = (target: DeckInputTarget) =>
  EDITABLE_TAGS.has(target.tag) || target.editable === true || target.role === 'textbox';

function isGuardedTarget(path: readonly DeckInputTarget[]): boolean {
  return path.some(
    (target) =>
      CONTROL_TAGS.has(target.tag) ||
      target.href === true ||
      target.editable === true ||
      (target.role !== undefined && CONTROL_ROLES.has(target.role)) ||
      hasAttribute(target, DECK_INTERACTIVE_ATTRIBUTE) ||
      hasAttribute(target, DECK_CHROME_ATTRIBUTE)
  );
}

const anyModifier = (event: Modifiers) =>
  event.ctrlKey === true ||
  event.metaKey === true ||
  event.altKey === true ||
  event.shiftKey === true;

/** Keys derived from the registry (never typed twice). */
const NAVIGATION_KEYS: Record<string, DeckAction> = {};
const SHIFTED_NAVIGATION_KEYS: Record<string, DeckAction> = {};
const TOGGLE_KEYS: Record<string, DeckAction> = {};
const SHIFT_ALLOWED_TOGGLES = new Set<string>();
const MODIFIER_KEYS: Record<string, DeckAction> = {};

for (const item of DECK_CONTROLS) {
  for (const spec of item.keys) {
    if (spec.closes) continue;
    const key = spec.key.length === 1 ? spec.key.toLowerCase() : spec.key;
    if (spec.modifier) {
      MODIFIER_KEYS[key] = item.action;
    } else if (item.group === 'navigate') {
      const table = spec.shift === 'required' ? SHIFTED_NAVIGATION_KEYS : NAVIGATION_KEYS;
      // Navigation keys keep their KeyboardEvent.key form (ArrowRight, ' ').
      table[spec.key] = item.action;
    } else {
      TOGGLE_KEYS[key] = item.action;
      if (spec.shift === 'allowed') SHIFT_ALLOWED_TOGGLES.add(key);
    }
  }
}

const ESCAPE_ORDER: readonly [DeckAction, (state: DeckInputState) => boolean][] = [
  ['debug', (state) => state.debug === true],
  ['help', (state) => state.help === true],
  ['overview', (state) => state.overview === 'open'],
  ['blackout', (state) => state.blackout === true],
  ['laser', (state) => state.laser === true],
  ['fullscreen-exit', (state) => state.fullscreen === true],
];

/** The actions Esc can reach, innermost first. */
export const DECK_ESCAPE_ORDER: readonly DeckAction[] = ESCAPE_ORDER.map(([action]) => action);

function decideKey(
  event: Extract<DeckInputEvent, { kind: 'key' }>,
  state: DeckInputState
): DeckAction | null {
  if (event.isComposing) return null;
  const path = event.path ?? [];
  if (path.some(isEditable)) return null;

  let key = event.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;

  // RTL: flip horizontal arrows before the registry lookup.
  if (state.dir === 'rtl') {
    if (key === 'ArrowLeft') key = 'ArrowRight';
    else if (key === 'ArrowRight') key = 'ArrowLeft';
  }

  const shortcut = MODIFIER_KEYS[lower];
  if ((event.ctrlKey || event.metaKey) && !event.altKey && shortcut) {
    return event.repeat ? null : shortcut;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  if (key === 'Escape') {
    if (event.repeat) return null;
    return ESCAPE_ORDER.find(([, isOn]) => isOn(state))?.[0] ?? null;
  }

  const found = TOGGLE_KEYS[lower];
  const toggle = found === 'debug' && state.debugAvailable !== true ? undefined : found;
  if (toggle && (SHIFT_ALLOWED_TOGGLES.has(lower) || !event.shiftKey)) {
    if (event.repeat) return null;
    if (state.overview === 'closing') return null;
    if (state.help) return toggle === 'help' ? 'help' : null;
    if (state.overview === 'open') return toggle === 'overview' ? 'overview' : null;
    if (state.blackout) return toggle === 'blackout' ? 'blackout' : null;
    return toggle;
  }

  const plain = NAVIGATION_KEYS[key];
  const shifted = SHIFTED_NAVIGATION_KEYS[key];
  if (!plain && !shifted) return null;
  if (state.overview === 'open' || state.overview === 'closing' || state.help || state.blackout) {
    return null;
  }
  if (isGuardedTarget(path)) return null;
  if (event.shiftKey) return shifted ?? null;
  return plain ?? null;
}

function decideClick(
  event: Extract<DeckInputEvent, { kind: 'click' }>,
  state: DeckInputState
): DeckAction | null {
  if ((event.button ?? 0) !== 0) return null;
  if (anyModifier(event)) return null;
  if (state.overview === 'open' || state.overview === 'closing') return null;
  if (state.help || state.blackout || state.laser) return null;
  if ((event.selectionLength ?? 0) > 0) return null;
  if (isGuardedTarget(event.path ?? [])) return null;
  return 'next';
}

function decideSwipe(
  event: Extract<DeckInputEvent, { kind: 'swipe' }>,
  state: DeckInputState
): DeckAction | null {
  if (event.pointerType === 'mouse') return null;
  if (!Number.isFinite(event.dx) || !Number.isFinite(event.dy)) return null;
  if (state.overview === 'open' || state.overview === 'closing') return null;
  if (state.help || state.blackout) return null;
  if (isGuardedTarget(event.path ?? [])) return null;
  if ((event.durationMs ?? 0) >= DECK_SWIPE_MAX_DURATION_MS) return null; // reject at == max (< 800 ms)
  const ax = Math.abs(event.dx);
  const ay = Math.abs(event.dy);
  if (ax < DECK_SWIPE_MIN_DISTANCE || ax < ay * DECK_SWIPE_AXIS_RATIO) return null;
  // RTL: a swipe left still means "forward" in reading order? Keep physical
  // direction (left = next) so the gesture matches the slide motion.
  return event.dx < 0 ? 'next' : 'prev';
}

/** The action an input event asks for, or `null` when the deck should ignore it. */
export function decideDeckInput(
  event: DeckInputEvent,
  state: DeckInputState = {}
): DeckAction | null {
  switch (event.kind) {
    case 'key':
      return decideKey(event, state);
    case 'click':
      return decideClick(event, state);
    case 'swipe':
      return decideSwipe(event, state);
    default:
      return null;
  }
}

interface ElementLike {
  tagName?: unknown;
  isContentEditable?: unknown;
  getAttribute?: (name: string) => string | null;
  hasAttribute?: (name: string) => boolean;
}

const WATCHED_ATTRIBUTES = [DECK_INTERACTIVE_ATTRIBUTE, DECK_CHROME_ATTRIBUTE] as const;

/**
 * Turns an event path (`event.composedPath()`, innermost first) into the
 * plain targets `decideDeckInput` reads. Non-elements are skipped; the walk
 * stops at `stopAt` (the deck root) when given.
 */
export function inputPathFrom(nodes: readonly unknown[], stopAt?: unknown): DeckInputTarget[] {
  const out: DeckInputTarget[] = [];
  for (const node of nodes) {
    if (stopAt !== undefined && node === stopAt) break;
    const el = node as ElementLike | null;
    if (!el || typeof el.tagName !== 'string' || typeof el.getAttribute !== 'function') continue;
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') ?? undefined;
    const attributes = WATCHED_ATTRIBUTES.filter((name) =>
      typeof el.hasAttribute === 'function'
        ? el.hasAttribute(name)
        : el.getAttribute?.(name) !== null
    );
    out.push({
      tag,
      ...(role ? { role } : {}),
      ...(el.isContentEditable === true ? { editable: true } : {}),
      ...(tag === 'a' && el.getAttribute('href') !== null ? { href: true } : {}),
      ...(attributes.length > 0 ? { attributes } : {}),
    });
  }
  return out;
}
