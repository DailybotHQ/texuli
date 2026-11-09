/**
 * The foundations model (kit API §5.1): every token of a compiled design system, per mode,
 * sorted into the groups a designer reads (color roles, data-viz, typography, spacing,
 * radius, elevation, motion) plus everything else, so no token is left out. Pure and total:
 * a malformed compiled object gives empty groups, never a throw. Values pass the same filter
 * the design-system runtime uses (`designSystemDeclarations`): a value that could carry a
 * second declaration, a rule or a URL is dropped before it reaches a style.
 */
import { designSystemDeclarations } from '@texuli/tokens/design-system/apply';
import { KIT_LIMITS, kitText } from '../shared/limits.ts';
import type { KitCompiled, KitMode } from '../shared/types.ts';

export type FoundationGroupId =
  | 'color'
  | 'data-viz'
  | 'typography'
  | 'spacing'
  | 'radius'
  | 'elevation'
  | 'motion'
  | 'other';

export interface FoundationToken {
  /** The variable name, e.g. `--tx-primary`. */
  readonly name: string;
  /** The value per mode; a mode without the token (or a refused value) is absent. */
  readonly values: Readonly<Partial<Record<KitMode, string>>>;
}

export interface FoundationGroup {
  readonly id: FoundationGroupId;
  readonly label: string;
  readonly tokens: readonly FoundationToken[];
}

export interface ContrastRow {
  readonly foreground: string;
  readonly background: string;
  readonly kind: string;
  readonly ratio: number;
  readonly required: number;
  readonly pass: boolean;
}

export interface TypeRole {
  readonly role: string;
  /** Variable names of the role's family, size, weight, line height and tracking. */
  readonly vars: Readonly<Record<'family' | 'size' | 'weight' | 'line' | 'tracking', string>>;
}

export interface FoundationsModel {
  readonly name: string;
  readonly version: string;
  /** The compiled modes, light first. */
  readonly modes: readonly KitMode[];
  readonly groups: readonly FoundationGroup[];
  readonly typeRoles: readonly TypeRole[];
  readonly contrast: Readonly<Partial<Record<KitMode, readonly ContrastRow[]>>>;
  readonly targets: readonly { variable: string; px: number; required: number; pass: boolean }[];
  readonly accessibility: { contrast: string; targetMin: number } | undefined;
  readonly fonts: readonly string[];
  readonly warnings: readonly string[];
  readonly logo: Readonly<Record<string, string>>;
  /** Tokens left out by `KIT_LIMITS.tokens`. */
  readonly clipped: number;
}

export const FOUNDATION_GROUPS: readonly { id: FoundationGroupId; label: string }[] = [
  { id: 'color', label: 'Color roles' },
  { id: 'data-viz', label: 'Data visualization' },
  { id: 'typography', label: 'Typography' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'radius', label: 'Radius' },
  { id: 'elevation', label: 'Elevation and shadow' },
  { id: 'motion', label: 'Motion' },
  { id: 'other', label: 'Other tokens' },
];

const COLOR_VALUE =
  /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(|transparent$|currentcolor$)/i;

/** The group of one variable (by its name, and its value for color roles). */
export function foundationGroupOf(name: string, value: string): FoundationGroupId {
  const n = name.slice('--tx-'.length);
  if (n.startsWith('chart-')) return 'data-viz';
  if (/^(?:type-|font-|letter-spacing-|line-height-)/.test(n)) return 'typography';
  if (n.startsWith('space-')) return 'spacing';
  if (/^(?:shape-radius-|radius)/.test(n)) return 'radius';
  if (/^(?:elevation-|shadow)/.test(n)) return 'elevation';
  if (n.startsWith('motion')) return 'motion';
  if (COLOR_VALUE.test(value.trim())) return 'color';
  return 'other';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Natural order: `space-2` before `space-10`, names otherwise alphabetical. */
function byName(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}

const ROLE_PARTS = ['family', 'size', 'weight', 'line', 'tracking'] as const;

/** The foundations of a compiled design system. */
export function foundationsModel(compiled: KitCompiled | undefined): FoundationsModel {
  const c = (isRecord(compiled) ? compiled : {}) as Partial<KitCompiled>;
  const vars = isRecord(c.vars) ? c.vars : {};
  const modes = (['light', 'dark'] as const).filter((mode) => isRecord(vars[mode]));
  const byToken = new Map<string, Partial<Record<KitMode, string>>>();
  for (const mode of modes) {
    for (const [name, value] of designSystemDeclarations(vars[mode] as Record<string, string>)) {
      const entry = byToken.get(name) ?? {};
      entry[mode] = value;
      byToken.set(name, entry);
    }
  }
  const names = [...byToken.keys()].sort(byName);
  const kept = names.slice(0, KIT_LIMITS.tokens);
  const grouped = new Map<FoundationGroupId, FoundationToken[]>();
  for (const name of kept) {
    const values = byToken.get(name) ?? {};
    const sample = values.light ?? values.dark ?? '';
    const group = foundationGroupOf(name, sample);
    const list = grouped.get(group) ?? [];
    list.push({ name, values });
    grouped.set(group, list);
  }
  const groups = FOUNDATION_GROUPS.map(({ id, label }) => ({
    id,
    label,
    tokens: grouped.get(id) ?? [],
  })).filter((group) => group.tokens.length > 0);

  // Type roles: `--tx-type-<role>-<part>`, a role listed once all its parts exist.
  const roles = new Set<string>();
  for (const name of kept) {
    const m = /^--tx-type-([a-z0-9]+)-(family|size|weight|line|tracking)$/.exec(name);
    if (m) roles.add(m[1] as string);
  }
  const typeRoles: TypeRole[] = [];
  for (const role of roles) {
    const parts = Object.fromEntries(
      ROLE_PARTS.map((part) => [part, `--tx-type-${role}-${part}`])
    ) as TypeRole['vars'];
    if (ROLE_PARTS.every((part) => byToken.has(parts[part]))) typeRoles.push({ role, vars: parts });
  }

  const report: Record<string, unknown> = isRecord(c.report) ? c.report : {};
  const contrast: Partial<Record<KitMode, ContrastRow[]>> = {};
  if (isRecord(report.contrast)) {
    for (const mode of modes) {
      const rows = report.contrast[mode];
      if (!Array.isArray(rows)) continue;
      contrast[mode] = rows
        .filter(isRecord)
        .slice(0, KIT_LIMITS.listItems)
        .map((row) => ({
          foreground: String(row.foreground),
          background: String(row.background),
          kind: String(row.kind),
          ratio: Number(row.ratio),
          required: Number(row.required),
          pass: row.pass === true,
        }));
    }
  }
  const targets = Array.isArray(report.targets)
    ? report.targets
        .filter(isRecord)
        .slice(0, KIT_LIMITS.listItems)
        .map((t) => ({
          variable: String(t.variable),
          px: Number(t.px),
          required: Number(t.required),
          pass: t.pass === true,
        }))
    : [];
  const warnings = Array.isArray(report.warnings)
    ? report.warnings
        .slice(0, KIT_LIMITS.listItems)
        .map((w) => (isRecord(w) ? kitText(w.message ?? w.code, 300)?.text : kitText(w, 300)?.text))
        .filter((w): w is string => w !== undefined)
    : [];
  const fonts = Array.isArray(c.fontFaces)
    ? [
        ...new Set(
          c.fontFaces
            .filter(isRecord)
            .map((f) => kitText(f.family, 120)?.text)
            .filter((f): f is string => f !== undefined)
        ),
      ].slice(0, KIT_LIMITS.listItems)
    : [];
  const logo: Record<string, string> = {};
  const assets: unknown = c.assets;
  if (isRecord(assets) && isRecord(assets.logo)) {
    for (const key of ['light', 'dark', 'mark', 'wordmark']) {
      const value = assets.logo[key];
      if (typeof value === 'string') logo[key] = value;
    }
  }
  const a11y = isRecord(c.accessibility) ? c.accessibility : undefined;
  return {
    name: kitText(c.name, 200)?.text ?? '',
    version: kitText(c.version, 64)?.text ?? '',
    modes,
    groups,
    typeRoles,
    contrast,
    targets,
    accessibility: a11y
      ? { contrast: String(a11y.contrast), targetMin: Number(a11y.targetMin) }
      : undefined,
    fonts,
    warnings,
    logo,
    clipped: names.length - kept.length,
  };
}

/** The navigable items of the foundations, in page order (`id` is the item id of a deep link). */
export function foundationItems(model: FoundationsModel): { id: string; label: string }[] {
  const items: { id: string; label: string }[] = model.groups.map((group) => ({
    id: group.id,
    label: group.label,
  }));
  if (model.modes.some((mode) => (model.contrast[mode]?.length ?? 0) > 0))
    items.push({ id: 'contrast', label: 'Contrast' });
  if (model.fonts.length > 0 || Object.keys(model.logo).length > 0 || model.warnings.length > 0)
    items.push({ id: 'assets', label: 'Fonts, assets and notes' });
  return items;
}
