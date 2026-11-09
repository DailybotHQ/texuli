/**
 * Creating locked design systems (ADR-032): allow presets from catalog data,
 * approval stamping and hash reports. Pure helpers behind
 * `texuli ds init --locked`, `texuli ds approve` and `texuli ds hash`.
 */

export {
  APPROVAL_NOTE,
  type DesignSystemHashReport,
  type HashCheck,
  hashReport,
  type StampApprovalOptions,
  stampApproval,
} from './approve.ts';
export {
  type AllowEntry,
  type AllowSection,
  allowFromJson,
  allowPreset,
  type BuiltPresetEntry,
  fullAllowEntry,
  MINIMAL_PRESET_IDS,
  PRESET_AXES,
  PRESET_NAMES,
  type PresetAxis,
  type PresetComponent,
  type PresetName,
  presetComponentsFromBuild,
} from './presets.ts';
