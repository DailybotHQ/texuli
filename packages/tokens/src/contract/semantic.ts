/**
 * Tier 2 — semantic roles (~40) with interaction states for interactive fills.
 * Themes map each role to a safe CSS color (and optional state overrides).
 */

/** Interaction states layered on interactive semantic roles. */
export const INTERACTION_STATES = ['default', 'hover', 'active', 'disabled', 'focus'] as const;
export type InteractionState = (typeof INTERACTION_STATES)[number];

/**
 * The 50 semantic role names. Interactive roles may carry hover/active/disabled/focus;
 * static roles only use `default`. Soft tone roles (`*Soft` / `*SoftForeground`)
 * back Alert/Callout tinted surfaces so title and body stay WCAG AA without
 * color-mix hacks.
 */
export const SEMANTIC_ROLES = [
  'background',
  'foreground',
  'surface',
  'surfaceForeground',
  'elevated',
  'elevatedForeground',
  'muted',
  'mutedForeground',
  'subtle',
  'subtleForeground',
  'border',
  'borderStrong',
  'input',
  'ring',
  'primary',
  'primaryForeground',
  'primarySoft',
  'primarySoftForeground',
  'secondary',
  'secondaryForeground',
  'accent',
  'accentForeground',
  'destructive',
  'destructiveForeground',
  'destructiveSoft',
  'destructiveSoftForeground',
  'success',
  'successForeground',
  'successSoft',
  'successSoftForeground',
  'warning',
  'warningForeground',
  'warningSoft',
  'warningSoftForeground',
  'info',
  'infoForeground',
  'infoSoft',
  'infoSoftForeground',
  'sidebar',
  'sidebarForeground',
  'sidebarBorder',
  'sidebarPrimary',
  'overlay',
  'scrim',
  'shadow',
  'link',
  'linkVisited',
  'selection',
  'selectionForeground',
  'canvas',
] as const;

export type SemanticRole = (typeof SEMANTIC_ROLES)[number];

/** Roles that accept interaction-state overrides beyond `default`. */
export const INTERACTIVE_SEMANTIC_ROLES = [
  'primary',
  'secondary',
  'accent',
  'destructive',
  'success',
  'warning',
  'info',
  'muted',
  'input',
  'link',
  'sidebarPrimary',
] as const satisfies readonly SemanticRole[];

export type InteractiveSemanticRole = (typeof INTERACTIVE_SEMANTIC_ROLES)[number];

/** A semantic color: required default plus optional interaction states. */
export type SemanticRoleValue = {
  default: string;
  hover?: string;
  active?: string;
  disabled?: string;
  focus?: string;
};

/** One mode's semantic map: every role present with at least `default`. */
export type SemanticPalette = Record<SemanticRole, SemanticRoleValue>;

/** Input form: a plain color string is treated as `{ default: color }`. */
export type SemanticRoleInput = string | SemanticRoleValue;
export type SemanticPaletteInput = Partial<Record<SemanticRole, SemanticRoleInput>> &
  Record<string, SemanticRoleInput | undefined>;

export function isSemanticRole(value: string): value is SemanticRole {
  return (SEMANTIC_ROLES as readonly string[]).includes(value);
}

export function isInteractiveSemanticRole(value: string): value is InteractiveSemanticRole {
  return (INTERACTIVE_SEMANTIC_ROLES as readonly string[]).includes(value);
}

export function isInteractionState(value: string): value is InteractionState {
  return (INTERACTION_STATES as readonly string[]).includes(value);
}

/** Normalize a role input to a structured value. */
export function normalizeRoleValue(input: SemanticRoleInput): SemanticRoleValue {
  if (typeof input === 'string') return { default: input };
  return {
    default: input.default,
    ...(input.hover !== undefined ? { hover: input.hover } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.disabled !== undefined ? { disabled: input.disabled } : {}),
    ...(input.focus !== undefined ? { focus: input.focus } : {}),
  };
}

/**
 * Flatten a palette into `--tx-*` entries for CSS application tasks.
 * Static roles emit one var; interactive roles emit default plus each set state.
 */
export function flattenSemanticPalette(palette: SemanticPalette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const role of SEMANTIC_ROLES) {
    const value = palette[role];
    out[role] = value.default;
    if (isInteractiveSemanticRole(role)) {
      for (const state of INTERACTION_STATES) {
        if (state === 'default') continue;
        const color = value[state];
        if (color !== undefined) out[`${role}.${state}`] = color;
      }
    }
  }
  return out;
}
