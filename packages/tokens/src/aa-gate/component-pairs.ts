import type { SemanticRole } from '../contract/semantic.ts';

/**
 * Button / Badge / Toggle / Alert / Callout / Toast color pairs resolved from CSS roles.
 * Every pair must meet WCAG AA on library themes (4.5:1 text, 3:1 UI ring).
 * Surfaces listed are the documented parents for transparent / outline chrome.
 * Soft tone fills (`*Soft` / `*SoftForeground`) back Alert, Callout and soft toast chrome.
 */

export type ComponentContrastKind = 'text' | 'ui';

export type ComponentContrastPair = {
  /** Stable id for failures (`button.outline.hover@muted`). */
  id: string;
  component: 'button' | 'badge' | 'toggle' | 'alert' | 'callout' | 'toast' | 'layout' | 'map';
  variant: string;
  state: 'default' | 'hover' | 'on';
  kind: ComponentContrastKind;
  foreground: SemanticRole;
  background: SemanticRole;
  /** When set, read this interaction state from the background role. */
  backgroundState?: 'default' | 'hover' | 'active';
  /** Parent surfaces this pair is documented for (transparent/outline). */
  surfaces?: readonly SemanticRole[];
};

const button = (
  variant: string,
  state: ComponentContrastPair['state'],
  foreground: SemanticRole,
  background: SemanticRole,
  extras: Partial<ComponentContrastPair> = {}
): ComponentContrastPair => ({
  id: `button.${variant}.${state}`,
  component: 'button',
  variant,
  state,
  kind: 'text',
  foreground,
  background,
  ...extras,
});

const badge = (
  variant: string,
  foreground: SemanticRole,
  background: SemanticRole,
  extras: Partial<ComponentContrastPair> = {}
): ComponentContrastPair => ({
  id: `badge.${variant}.default`,
  component: 'badge',
  variant,
  state: 'default',
  kind: 'text',
  foreground,
  background,
  ...extras,
});

const toggle = (
  variant: string,
  state: ComponentContrastPair['state'],
  foreground: SemanticRole,
  background: SemanticRole,
  extras: Partial<ComponentContrastPair> = {}
): ComponentContrastPair => ({
  id: `toggle.${variant}.${state}`,
  component: 'toggle',
  variant,
  state,
  kind: 'text',
  foreground,
  background,
  ...extras,
});

const layoutPair = (
  id: string,
  variant: string,
  state: ComponentContrastPair['state'],
  foreground: SemanticRole,
  background: SemanticRole,
  extras: Partial<ComponentContrastPair> = {}
): ComponentContrastPair => ({
  id,
  component: 'layout',
  variant,
  state,
  kind: 'text',
  foreground,
  background,
  ...extras,
});

/** Map plate UI fill (3:1) on background/surface. */
const mapUi = (id: string, variant: string, foreground: SemanticRole): ComponentContrastPair => ({
  id,
  component: 'map',
  variant,
  state: 'default',
  kind: 'ui',
  foreground,
  background: 'background',
  surfaces: ['background', 'surface'],
});

/** Glyph text (4.5:1) on the strong map tone fill. */
const mapGlyph = (
  id: string,
  variant: string,
  foreground: SemanticRole,
  background: SemanticRole
): ComponentContrastPair => ({
  id,
  component: 'map',
  variant,
  state: 'default',
  kind: 'text',
  foreground,
  background,
});

const MAP_MARKER_TONES = [
  ['primary', 'primary', 'primaryForeground'],
  ['success', 'success', 'successForeground'],
  ['warning', 'warning', 'warningForeground'],
  ['danger', 'destructive', 'destructiveForeground'],
  ['info', 'info', 'infoForeground'],
] as const satisfies ReadonlyArray<readonly [string, SemanticRole, SemanticRole]>;

const softTone = (
  component: 'alert' | 'callout' | 'toast',
  tone: string,
  kind: 'title' | 'body',
  foreground: SemanticRole,
  background: SemanticRole
): ComponentContrastPair => ({
  id: `${component}.${tone}.soft-${kind}`,
  component,
  variant: `${tone}-soft-${kind}`,
  state: 'default',
  kind: 'text',
  foreground,
  background,
});

const solidTone = (
  component: 'badge' | 'toast',
  tone: string,
  foreground: SemanticRole,
  background: SemanticRole
): ComponentContrastPair => ({
  id: `${component}.${tone}.solid`,
  component,
  variant: `${tone}-solid`,
  state: 'default',
  kind: 'text',
  foreground,
  background,
});

const outlineTone = (
  component: 'badge' | 'alert' | 'callout',
  tone: string,
  foreground: SemanticRole
): ComponentContrastPair => ({
  id: `${component}.${tone}.outline`,
  component,
  variant: `${tone}-outline`,
  state: 'default',
  kind: 'text',
  foreground,
  background: 'background',
  surfaces: ['background', 'surface', 'muted', 'elevated'],
});

const TONE_SOLID = [
  { tone: 'success', fg: 'successForeground', bg: 'success' },
  { tone: 'warning', fg: 'warningForeground', bg: 'warning' },
  { tone: 'info', fg: 'infoForeground', bg: 'info' },
  { tone: 'destructive', fg: 'destructiveForeground', bg: 'destructive' },
] as const satisfies readonly {
  tone: string;
  fg: SemanticRole;
  bg: SemanticRole;
}[];

const TONE_SOFT = [
  { tone: 'success', title: 'successSoftForeground', soft: 'successSoft' },
  { tone: 'warning', title: 'warningSoftForeground', soft: 'warningSoft' },
  { tone: 'info', title: 'infoSoftForeground', soft: 'infoSoft' },
  { tone: 'destructive', title: 'destructiveSoftForeground', soft: 'destructiveSoft' },
  { tone: 'brand', title: 'primarySoftForeground', soft: 'primarySoft' },
] as const satisfies readonly {
  tone: string;
  title: SemanticRole;
  soft: SemanticRole;
}[];

const TONE_OUTLINE = [
  { tone: 'success', ink: 'success' },
  { tone: 'warning', ink: 'warning' },
  { tone: 'info', ink: 'info' },
  { tone: 'destructive', ink: 'destructive' },
  { tone: 'brand', ink: 'primary' },
] as const satisfies readonly { tone: string; ink: SemanticRole }[];

/**
 * Documented component pairs. Transparent controls list every surface they may
 * sit on; solid fills use their own role as the background.
 */
export const COMPONENT_CONTRAST_PAIRS: readonly ComponentContrastPair[] = [
  // Button
  button('default', 'default', 'primaryForeground', 'primary'),
  button('default', 'hover', 'primaryForeground', 'primary', { backgroundState: 'hover' }),
  button('secondary', 'default', 'secondaryForeground', 'secondary'),
  button('secondary', 'hover', 'secondaryForeground', 'secondary', { backgroundState: 'hover' }),
  button('destructive', 'default', 'destructiveForeground', 'destructive'),
  button('destructive', 'hover', 'destructiveForeground', 'destructive', {
    backgroundState: 'hover',
  }),
  button('outline', 'default', 'foreground', 'surface', {
    surfaces: ['background', 'surface', 'muted', 'elevated'],
  }),
  button('outline', 'hover', 'foreground', 'muted', {
    surfaces: ['background', 'surface', 'muted', 'elevated'],
  }),
  button('ghost', 'default', 'foreground', 'background', {
    surfaces: ['background', 'surface', 'muted', 'elevated'],
  }),
  button('ghost', 'hover', 'foreground', 'muted', {
    surfaces: ['background', 'surface', 'muted', 'elevated'],
  }),
  button('link', 'default', 'link', 'background', {
    surfaces: ['background', 'surface', 'muted', 'elevated'],
  }),
  // Default fill is also used when Button renders as <a href> (blocks CTAs).
  // Same roles as button.default; listed so audits name the anchor surface.
  button('default-anchor', 'default', 'primaryForeground', 'primary'),
  button('default-anchor', 'hover', 'primaryForeground', 'primary', {
    backgroundState: 'hover',
  }),
  // Badge — solid fills + neutral/outline chrome
  badge('default', 'primaryForeground', 'primary'),
  badge('secondary', 'secondaryForeground', 'secondary'),
  badge('success', 'successForeground', 'success'),
  badge('warning', 'warningForeground', 'warning'),
  badge('destructive', 'destructiveForeground', 'destructive'),
  badge('info', 'infoForeground', 'info'),
  badge('neutral', 'mutedForeground', 'muted'),
  badge('outline', 'foreground', 'surface', {
    surfaces: ['background', 'surface', 'muted', 'elevated'],
  }),
  ...TONE_OUTLINE.map(({ tone, ink }) => outlineTone('badge', tone, ink)),
  // Toggle
  toggle('default', 'default', 'foreground', 'background', {
    surfaces: ['background', 'surface', 'muted', 'elevated'],
  }),
  toggle('default', 'hover', 'foreground', 'muted', {
    surfaces: ['background', 'surface', 'muted', 'elevated'],
  }),
  toggle('default', 'on', 'accentForeground', 'accent'),
  toggle('outline', 'default', 'foreground', 'surface', {
    surfaces: ['background', 'surface', 'muted', 'elevated'],
  }),
  toggle('outline', 'hover', 'foreground', 'muted', {
    surfaces: ['background', 'surface', 'muted', 'elevated'],
  }),
  toggle('outline', 'on', 'accentForeground', 'accent'),
  // Alert + Callout — soft title, soft body, outline ink
  ...TONE_SOFT.flatMap(({ tone, title, soft }) => [
    softTone('alert', tone, 'title', title, soft),
    softTone('alert', tone, 'body', 'foreground', soft),
    softTone('callout', tone, 'title', title, soft),
    softTone('callout', tone, 'body', 'foreground', soft),
  ]),
  softTone('alert', 'neutral', 'title', 'mutedForeground', 'muted'),
  softTone('alert', 'neutral', 'body', 'foreground', 'muted'),
  softTone('callout', 'neutral', 'title', 'mutedForeground', 'muted'),
  softTone('callout', 'neutral', 'body', 'foreground', 'muted'),
  ...TONE_OUTLINE.flatMap(({ tone, ink }) => [
    outlineTone('alert', tone, ink),
    outlineTone('callout', tone, ink),
  ]),
  // Toast — solid icon chip + body on elevated
  ...TONE_SOLID.map(({ tone, fg, bg }) => solidTone('toast', tone, fg, bg)),
  {
    id: 'toast.body.default',
    component: 'toast',
    variant: 'body',
    state: 'default',
    kind: 'text',
    foreground: 'foreground',
    background: 'elevated',
    surfaces: ['elevated', 'surface', 'background'],
  },
  {
    id: 'toast.description.default',
    component: 'toast',
    variant: 'description',
    state: 'default',
    kind: 'text',
    foreground: 'mutedForeground',
    background: 'elevated',
    surfaces: ['elevated', 'surface', 'background'],
  },
  // Focus ring (UI 3:1)
  {
    id: 'button.focus-ring',
    component: 'button',
    variant: 'focus',
    state: 'default',
    kind: 'ui',
    foreground: 'ring',
    background: 'background',
    surfaces: ['background', 'surface'],
  },
  // Dashboard grid header nav (AA on background / primary).
  layoutPair(
    'layout.dashboard.nav.default',
    'dashboard-nav',
    'default',
    'foreground',
    'background',
    { surfaces: ['background', 'surface', 'elevated'] }
  ),
  layoutPair('layout.dashboard.nav.current', 'dashboard-nav', 'on', 'primaryForeground', 'primary'),
  // Map markers / routes / fences — strong fills on the map plate (UI 3:1);
  // glyph text uses the matching *Foreground on the strong fill (AA text).
  ...MAP_MARKER_TONES.flatMap(([tone, fill, glyphFg]) => [
    mapUi(`map.marker.${tone}.fill`, `marker-${tone}`, fill),
    mapGlyph(`map.marker.${tone}.glyph`, `marker-${tone}-glyph`, glyphFg, fill),
  ]),
  mapUi('map.route.primary', 'route-primary', 'primary'),
  mapUi('map.fence.warning', 'fence-warning', 'warning'),
];
