import { semanticTokenToCssVar } from '../contract/prefix.ts';
import {
  INTERACTION_STATES,
  INTERACTIVE_SEMANTIC_ROLES,
  SEMANTIC_ROLES,
  type SemanticPalette,
  type SemanticRole,
} from '../contract/semantic.ts';
import { isSystemColorKeyword, type SystemColorKeyword } from './system-colors.ts';

/**
 * Canonical mapping of every semantic role to a CSS system color for
 * `forced-colors: active` (and high-contrast mode). Focus, borders and
 * selection use Highlight / CanvasText / ButtonBorder so they stay visible
 * when the OS replaces the theme palette.
 */
export const FORCED_COLORS_ROLE_MAP = {
  background: 'Canvas',
  foreground: 'CanvasText',
  surface: 'Canvas',
  surfaceForeground: 'CanvasText',
  elevated: 'Canvas',
  elevatedForeground: 'CanvasText',
  muted: 'Canvas',
  mutedForeground: 'GrayText',
  subtle: 'Canvas',
  subtleForeground: 'GrayText',
  border: 'ButtonBorder',
  borderStrong: 'CanvasText',
  input: 'Field',
  ring: 'Highlight',
  primary: 'Highlight',
  primaryForeground: 'HighlightText',
  primarySoft: 'Canvas',
  primarySoftForeground: 'Highlight',
  secondary: 'ButtonFace',
  secondaryForeground: 'ButtonText',
  accent: 'Highlight',
  accentForeground: 'HighlightText',
  destructive: 'Mark',
  destructiveForeground: 'MarkText',
  destructiveSoft: 'Canvas',
  destructiveSoftForeground: 'Mark',
  success: 'Mark',
  successForeground: 'MarkText',
  successSoft: 'Canvas',
  successSoftForeground: 'Mark',
  warning: 'Mark',
  warningForeground: 'MarkText',
  warningSoft: 'Canvas',
  warningSoftForeground: 'Mark',
  info: 'Highlight',
  infoForeground: 'HighlightText',
  infoSoft: 'Canvas',
  infoSoftForeground: 'Highlight',
  sidebar: 'Canvas',
  sidebarForeground: 'CanvasText',
  sidebarBorder: 'ButtonBorder',
  sidebarPrimary: 'Highlight',
  overlay: 'Canvas',
  scrim: 'Canvas',
  shadow: 'CanvasText',
  link: 'LinkText',
  linkVisited: 'VisitedText',
  selection: 'Highlight',
  selectionForeground: 'HighlightText',
  canvas: 'Canvas',
} as const satisfies Record<SemanticRole, SystemColorKeyword>;

/**
 * Roles that must stay visible for focus, chrome and selection under forced
 * colors. Surfaces may use Canvas; these must not.
 */
export const FORCED_COLORS_VISIBILITY_ROLES = [
  'border',
  'borderStrong',
  'ring',
  'selection',
  'selectionForeground',
  'foreground',
  'link',
] as const satisfies readonly SemanticRole[];

const INTERACTIVE = new Set<SemanticRole>(INTERACTIVE_SEMANTIC_ROLES);

/** Interaction-state overrides for interactive roles under forced colors. */
export function forcedColorsStateColor(
  role: SemanticRole,
  state: (typeof INTERACTION_STATES)[number]
): SystemColorKeyword {
  const base = FORCED_COLORS_ROLE_MAP[role];
  if (state === 'default') return base;
  if (state === 'disabled') return 'GrayText';
  if (state === 'focus') return 'Highlight';
  // hover / active keep the role's system color (OS still paints chrome).
  return base;
}

/**
 * Build a full semantic palette of system colors (same shape as a theme mode).
 * Used by CSS generation and by hosts that apply high-contrast without modes.
 */
export function createForcedColorsPalette(): SemanticPalette {
  return Object.fromEntries(
    SEMANTIC_ROLES.map((role) => {
      const color = FORCED_COLORS_ROLE_MAP[role];
      if (!INTERACTIVE.has(role)) return [role, { default: color }];
      return [
        role,
        {
          default: color,
          hover: forcedColorsStateColor(role, 'hover'),
          active: forcedColorsStateColor(role, 'active'),
          focus: forcedColorsStateColor(role, 'focus'),
          disabled: forcedColorsStateColor(role, 'disabled'),
        },
      ];
    })
  ) as SemanticPalette;
}

export interface ForcedColorsCoverageIssue {
  kind: 'missing-role' | 'invalid-system-color' | 'invisible-role';
  role: string;
  state?: string;
  detail: string;
}

/**
 * Automated coverage check: every semantic role (and interactive state) maps
 * to a known system color; visibility-critical roles are never transparent
 * keywords. Call from tests and from a future component token audit.
 */
export function checkForcedColorsCoverage(
  map: Readonly<Record<string, string>> = FORCED_COLORS_ROLE_MAP
): ForcedColorsCoverageIssue[] {
  const issues: ForcedColorsCoverageIssue[] = [];
  for (const role of SEMANTIC_ROLES) {
    const value = map[role];
    if (value === undefined) {
      issues.push({
        kind: 'missing-role',
        role,
        detail: `Semantic role "${role}" has no forced-colors mapping.`,
      });
      continue;
    }
    if (!isSystemColorKeyword(value)) {
      issues.push({
        kind: 'invalid-system-color',
        role,
        detail: `Role "${role}" maps to "${value}", which is not a CSS system color keyword.`,
      });
    }
  }
  for (const role of FORCED_COLORS_VISIBILITY_ROLES) {
    const value = map[role];
    if (value === 'Canvas' && (role === 'border' || role === 'ring' || role === 'selection')) {
      issues.push({
        kind: 'invisible-role',
        role,
        detail: `Visibility role "${role}" must not use Canvas alone (borders/focus/selection would disappear).`,
      });
    }
  }
  for (const role of INTERACTIVE_SEMANTIC_ROLES) {
    for (const state of INTERACTION_STATES) {
      if (state === 'default') continue;
      const color = forcedColorsStateColor(role, state);
      if (!isSystemColorKeyword(color)) {
        issues.push({
          kind: 'invalid-system-color',
          role,
          state,
          detail: `State ${role}/${state} is not a system color.`,
        });
      }
    }
  }
  return issues;
}

/** Flat `--tx-*` → system color map for default + interaction states. */
export function forcedColorsCssVariables(
  palette: SemanticPalette = createForcedColorsPalette()
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const role of SEMANTIC_ROLES) {
    const value = palette[role];
    out[semanticTokenToCssVar(role, 'default')] = value.default;
    if (INTERACTIVE.has(role)) {
      for (const state of INTERACTION_STATES) {
        if (state === 'default') continue;
        const color = value[state];
        if (color !== undefined) out[semanticTokenToCssVar(role, state)] = color;
      }
    }
  }
  return out;
}
