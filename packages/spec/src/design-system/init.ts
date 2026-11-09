/**
 * `initLockedDesignSystem` (ADR-032): a new locked design-system document
 * from a preset over the catalog, which the caller passes as data (the
 * projected `catalog/components.json`, or any `{ components }` with ids,
 * axes and states), so this module never loads the catalog itself.
 *
 * - `all`: every catalog component with the full values of every axis it
 *   declares and its states.
 * - `minimal`: {@link MINIMAL_LOCKED_COMPONENTS}, a documented core.
 * - an explicit `allow` section, checked against the catalog.
 *
 * Pure and total: it returns `{ ok: false, errors }` with stable codes and
 * JSON paths instead of throwing.
 */
import type {
  DesignSystem,
  DesignSystemAllow,
  DesignSystemAllowEntry,
  DesignSystemIssue,
} from '../../generated/typescript/design-system.ts';
import { checkDesignSystemAllow, type DesignSystemAllowCatalog } from './allow.ts';
import { DS_COMPONENT_STATES, DS_LOCKED_LIMITS, DS_LOCKED_PATTERNS } from './types-locked.ts';
import { validateDesignSystem } from './validate.ts';
import { DESIGN_SYSTEM_FORMAT, DESIGN_SYSTEM_FORMAT_VERSION } from './vocabulary.ts';

/** The `minimal` preset: actions, form controls, text and status, containers, overlays and page layouts. */
export const MINIMAL_LOCKED_COMPONENTS: readonly string[] = Object.freeze([
  'button',
  'icon-button',
  'form',
  'field',
  'label',
  'input',
  'textarea',
  'select',
  'checkbox',
  'radio-group',
  'switch',
  'badge',
  'alert',
  'empty-state',
  'stat',
  'table',
  'card',
  'dialog',
  'tooltip',
  'layout-page',
  'layout-stack',
  'layout-row',
  'layout-grid',
]);

export const LOCKED_PRESETS = ['all', 'minimal'] as const;
export type LockedPreset = (typeof LOCKED_PRESETS)[number];

const AXIS_LISTS = [
  ['variant', 'variants'],
  ['size', 'sizes'],
  ['tone', 'tones'],
  ['density', 'densities'],
  ['color', 'colors'],
] as const;
const STATES: ReadonlySet<string> = new Set(DS_COMPONENT_STATES);

/**
 * One component's full allow entry: every axis value and state the catalog
 * declares. An axis beyond the schema's caps (more than 32 values, or a value
 * outside the axis pattern) is left out, which allows every value, so the
 * entry always validates.
 */
export function fullAllowEntry(
  component: DesignSystemAllowCatalog['components'][number]
): DesignSystemAllowEntry {
  const entry: Record<string, readonly string[]> = {};
  for (const [axis, list] of AXIS_LISTS) {
    const values = [...new Set(component.axes?.[axis]?.values ?? [])];
    if (values.length === 0 || values.length > DS_LOCKED_LIMITS.axisValues) continue;
    if (!values.every((value) => DS_LOCKED_PATTERNS.axisValue.test(value))) continue;
    entry[list] = values;
  }
  const states = [...new Set(component.states ?? [])].filter((state) => STATES.has(state));
  if (states.length > 0) entry.states = states;
  return entry as DesignSystemAllowEntry;
}

/** The allow section of a preset over the catalog, keys sorted by id; unknown minimal ids are skipped. */
export function lockedAllowPreset(
  catalog: DesignSystemAllowCatalog,
  preset: LockedPreset
): DesignSystemAllow {
  const wanted = preset === 'minimal' ? new Set(MINIMAL_LOCKED_COMPONENTS) : undefined;
  const allow: Record<string, DesignSystemAllowEntry> = {};
  for (const component of [...catalog.components].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (wanted && !wanted.has(component.id)) continue;
    allow[component.id] = fullAllowEntry(component);
  }
  return allow;
}

export interface InitLockedDesignSystemOptions {
  /** A lowercase kebab-case id. */
  id: string;
  name: string;
  /** Defaults to `0.1.0`. */
  version?: string;
  /** `minimal` (the default), `all`, or an explicit `allow` section (checked against the catalog). */
  preset?: LockedPreset | DesignSystemAllow;
  /**
   * The document to lock (for example a brand import): its sections are kept
   * and its identity is replaced by `id`, `name` and `version`. Any `approval`
   * is dropped: a new locked document starts as a draft.
   */
  base?: Readonly<Record<string, unknown>>;
  /** Trust for `validateDesignSystem` (default `untrusted`). */
  trust?: 'developer' | 'untrusted';
}

export type InitLockedDesignSystemResult =
  | { ok: true; document: DesignSystem }
  | { ok: false; errors: readonly DesignSystemIssue[] };

/**
 * A new locked design system: the base sections (or a default brand seed),
 * the identity, `allow` from the preset and `approval: { status: 'draft',
 * version }`. Validated structurally and against the catalog.
 */
export function initLockedDesignSystem(
  options: InitLockedDesignSystemOptions,
  catalog: DesignSystemAllowCatalog
): InitLockedDesignSystemResult {
  const version = options.version ?? '0.1.0';
  const preset = options.preset ?? 'minimal';
  const allow =
    typeof preset === 'string' ? lockedAllowPreset(catalog, preset as LockedPreset) : preset;
  if (typeof preset === 'string' && !(LOCKED_PRESETS as readonly string[]).includes(preset))
    return {
      ok: false,
      errors: [
        {
          code: 'invalid-value',
          path: '$.allow',
          message: `Unknown preset ${JSON.stringify(preset)}.`,
          hint: 'Use all, minimal or an allow section.',
        },
      ],
    };
  const { approval: _approval, ...base } = (options.base ?? {
    color: { brand: { seed: '#4f46e5' } },
  }) as Record<string, unknown>;
  const document = {
    ...base,
    format: DESIGN_SYSTEM_FORMAT,
    formatVersion: DESIGN_SYSTEM_FORMAT_VERSION,
    id: options.id,
    version,
    name: options.name,
    allow,
    approval: { status: 'draft', version },
  };
  const structural = validateDesignSystem(document, { trust: options.trust ?? 'untrusted' });
  if (!structural.ok) return { ok: false, errors: structural.errors };
  const members = checkDesignSystemAllow(document, catalog);
  if (!members.ok) return { ok: false, errors: members.errors };
  return { ok: true, document: document as unknown as DesignSystem };
}
