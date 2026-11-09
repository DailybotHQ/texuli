/**
 * Allow presets for `texuli ds init --locked` (ADR-032): pure functions from
 * catalog data to an `allow` section. The catalog arrives as data (the CLI
 * builds it with `loadOpsCatalog`), so nothing here reads files.
 *
 * - `all`: every catalog id, each with the full values of every axis it
 *   declares and its states.
 * - `minimal`: {@link MINIMAL_PRESET_IDS}, a small documented core
 *   (actions, form controls, text and status, containers, overlays and page
 *   layouts), with the same full axes.
 *
 * A component with no declared axes gets an empty entry (`{}`): every value
 * the catalog lists is allowed. An axis whose values exceed the schema's caps
 * (more than 32, or a value outside `^[A-Za-z0-9][A-Za-z0-9_-]{0,47}$`) is
 * left out for the same reason, so a preset is always a valid section.
 *
 * The preset logic is `lockedAllowPreset` and `fullAllowEntry` of
 * `@texuli/spec/design-system` (the library functions consumers call); this
 * module adds the built-catalog projection and the preset-file reader.
 */
import {
  type DesignSystem,
  LOCKED_PRESETS,
  lockedAllowPreset,
  MINIMAL_LOCKED_COMPONENTS,
  fullAllowEntry as specFullAllowEntry,
} from '@texuli/spec/design-system';

export type AllowSection = NonNullable<DesignSystem['allow']>;
export type AllowEntry = AllowSection[string];

/** The axis names of the catalog and the `allow` list each fills. */
export const PRESET_AXES = {
  variant: 'variants',
  size: 'sizes',
  tone: 'tones',
  density: 'densities',
  color: 'colors',
} as const;
export type PresetAxis = keyof typeof PRESET_AXES;

/** One catalog component as a preset reads it (a projected or built entry). */
export interface PresetComponent {
  id: string;
  axes?: Readonly<Partial<Record<PresetAxis, { values: readonly string[] }>>>;
  states?: readonly string[];
}

/** One built catalog entry (`@texuli/catalog/build`): axes name the enum prop that drives them. */
export interface BuiltPresetEntry {
  id: string;
  axes?: Readonly<Partial<Record<PresetAxis, string>>>;
  states?: readonly string[];
  props: readonly { name: string; enumValues?: readonly string[] }[];
}

export const PRESET_NAMES = LOCKED_PRESETS;
export type PresetName = (typeof PRESET_NAMES)[number];

/** The `minimal` preset ids (`MINIMAL_LOCKED_COMPONENTS` of `@texuli/spec/design-system`). */
export const MINIMAL_PRESET_IDS: readonly string[] = MINIMAL_LOCKED_COMPONENTS;

/** Project built catalog entries into preset components: axis values from each axis's enum prop. */
export function presetComponentsFromBuild(entries: readonly BuiltPresetEntry[]): PresetComponent[] {
  return entries.map((entry) => {
    const axes: Partial<Record<PresetAxis, { values: readonly string[] }>> = {};
    for (const axis of Object.keys(PRESET_AXES) as PresetAxis[]) {
      const prop = entry.axes?.[axis];
      const values = entry.props.find((candidate) => candidate.name === prop)?.enumValues;
      if (prop && values && values.length > 0) axes[axis] = { values };
    }
    return {
      id: entry.id,
      ...(Object.keys(axes).length > 0 ? { axes } : {}),
      ...(entry.states?.length ? { states: entry.states } : {}),
    };
  });
}

/** One component's full `allow` entry (`fullAllowEntry` of `@texuli/spec/design-system`). */
export function fullAllowEntry(component: PresetComponent): AllowEntry {
  return specFullAllowEntry(component);
}

/** The `allow` section of a preset (`lockedAllowPreset` of `@texuli/spec/design-system`). */
export function allowPreset(
  components: readonly PresetComponent[],
  preset: PresetName
): AllowSection {
  return lockedAllowPreset({ components }, preset);
}

/**
 * Read a preset file's JSON: an `allow` section itself, or a document (or any
 * object) carrying one under `allow`. The result is validated with the
 * document it lands in.
 */
export function allowFromJson(value: unknown): AllowSection {
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!isRecord(value)) throw new TypeError('A preset file holds a JSON object.');
  const section = isRecord(value.allow) ? value.allow : value;
  return section as AllowSection;
}
