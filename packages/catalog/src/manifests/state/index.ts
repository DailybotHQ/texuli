/**
 * Catalog manifests for the state and action surfaces `@texuli/player`
 * paints (spec 0.3.0). Build-time only — the sink-free renderer must not
 * import this module. A subpath group: the catalog root does not re-export it.
 */
export {
  AUTOCOMPLETE_ALLOWLIST,
  actionFormManifest,
  CONTROL_STATE_TYPES,
  choiceControlManifest,
  FIELD_KINDS,
  FIELD_PATTERN_NAMES,
  filterControlManifest,
  flowActionManifest,
  flowViewManifest,
  formFieldManifest,
  formSubmitManifest,
  HOST_REGION_NAME,
  hostRegionManifest,
  STATE_GRAMMAR_ROLES,
  STATE_MANIFESTS,
  sliderControlManifest,
  sortableListManifest,
  toggleControlManifest,
} from './manifests.ts';
