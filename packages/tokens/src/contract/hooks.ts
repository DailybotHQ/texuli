/**
 * Tier 3 — opt-in component hooks. Themes may set these; components read
 * `data-tx-*` attributes. No upward dependency on a component package.
 */

export const BUTTON_HOOK_VALUES = ['square', 'default', 'pill'] as const;
export type ButtonHookValue = (typeof BUTTON_HOOK_VALUES)[number];

export const CARD_HOOK_VALUES = ['solid', 'bordered', 'glass'] as const;
export type CardHookValue = (typeof CARD_HOOK_VALUES)[number];

export const FOCUS_RING_HOOK_VALUES = ['ring', 'outline', 'glow', 'inset'] as const;
export type FocusRingHookValue = (typeof FOCUS_RING_HOOK_VALUES)[number];

export const INPUT_HOOK_VALUES = ['compact', 'default', 'comfortable'] as const;
export type InputHookValue = (typeof INPUT_HOOK_VALUES)[number];

/** Opt-in component style hooks a theme may declare. */
export type ComponentHooks = {
  button?: ButtonHookValue;
  card?: CardHookValue;
  focusRing?: FocusRingHookValue;
  input?: InputHookValue;
};

/** Dataset keys written on the document element (`data-tx-button-style`, …). */
export const COMPONENT_HOOK_DATA_KEYS = {
  button: 'txButtonStyle',
  card: 'txCardStyle',
  focusRing: 'txFocusRingStyle',
  input: 'txInputStyle',
} as const satisfies Record<keyof ComponentHooks, string>;

export const COMPONENT_HOOK_KEYS = ['button', 'card', 'focusRing', 'input'] as const;
export type ComponentHookKey = (typeof COMPONENT_HOOK_KEYS)[number];

const HOOK_ALLOWED: Record<ComponentHookKey, readonly string[]> = {
  button: BUTTON_HOOK_VALUES,
  card: CARD_HOOK_VALUES,
  focusRing: FOCUS_RING_HOOK_VALUES,
  input: INPUT_HOOK_VALUES,
};

export function isComponentHookKey(value: string): value is ComponentHookKey {
  return (COMPONENT_HOOK_KEYS as readonly string[]).includes(value);
}

export function isAllowedHookValue(key: ComponentHookKey, value: string): boolean {
  return HOOK_ALLOWED[key].includes(value);
}

/**
 * Derive a sparse hook profile from radius / surface / elevation fields so
 * themes without an explicit `components` block still get sensible hooks.
 */
export function deriveComponentHooks(input: {
  radius?: string;
  surface?: string;
  elevation?: string;
  focusRingStyle?: string;
  components?: ComponentHooks;
}): ComponentHooks {
  if (input.components) return { ...input.components };

  const hooks: ComponentHooks = {};
  const px = parseRadiusPx(input.radius);
  if (px === 0) hooks.button = 'square';
  else if (px !== null && px >= 999) hooks.button = 'pill';

  if (input.surface === 'glass') hooks.card = 'glass';
  else if (input.elevation === 'flat') hooks.card = 'bordered';

  if (
    input.focusRingStyle &&
    isAllowedHookValue('focusRing', input.focusRingStyle) &&
    input.focusRingStyle !== 'ring'
  ) {
    hooks.focusRing = input.focusRingStyle as FocusRingHookValue;
  }

  return hooks;
}

function parseRadiusPx(radius: string | undefined): number | null {
  if (!radius) return null;
  const match = /^(\d+(?:\.\d+)?)(px|rem|em)?$/.exec(radius.trim());
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return match[2] === 'rem' || match[2] === 'em' ? value * 16 : value;
}
