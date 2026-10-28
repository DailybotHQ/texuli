/**
 * Authored catalog manifest format for Texuli components (build-time only).
 *
 * Agents and tools read validated manifests. The sink-free renderer never
 * imports this module — validation runs at catalog build / CI, not on the
 * hot render path, and there is no schema library dependency here.
 */

/** Which product surface the component primarily serves. */
export type CatalogTier = 'app' | 'content';

/**
 * Closed set of prop kinds an authored schema may declare. Kept small so
 * agents and MCP can reason about props without a full JSON Schema engine.
 */
export type CatalogPropKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'array'
  | 'object'
  | 'slot'
  | 'event'
  | 'unknown';

/**
 * The closed event vocabulary a node's `on` may name (spec 0.3.0,
 * `SPEC_EVENT_NAMES`). A component lists the events it really fires.
 */
export type CatalogEventName = 'press' | 'change' | 'select' | 'submit' | 'dismiss' | 'move';

/**
 * A property schema for an `array` or `object` prop: the spec dialect
 * subset (`SpecPropSchema`). `$ref` names a contract `$defs` entry
 * (`#/$defs/reorder`, `#/$defs/workflowGraph` …) and stands alone.
 */
export interface CatalogValueSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  properties?: Readonly<Record<string, CatalogValueSchema>>;
  required?: readonly string[];
  additionalProperties?: CatalogValueSchema;
  items?: CatalogValueSchema;
  enum?: readonly string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  $ref?: string;
}

/** Deprecated since a spec version; warns for one minor before removal. */
export interface CatalogDeprecation {
  since: string;
  replacement?: string;
}

/** One prop in the component's public surface. */
export interface CatalogPropSchema {
  /** Prop name as authors and agents pass it (camelCase). */
  name: string;
  kind: CatalogPropKind;
  /** When true the renderer / host must supply a value. */
  required?: boolean;
  /** Human description for docs and MCP. */
  description?: string;
  /** Closed list when `kind` is `enum`. */
  enumValues?: readonly string[];
  /** Documented default (plain JSON data only). */
  default?: unknown;
  /**
   * Trust tier for values that become href/src or visible copy.
   * Defaults to `developer` for app chrome and `untrusted` when omitted on
   * agent-emittable content components is a host concern — the field is optional.
   */
  trust?: 'developer' | 'untrusted';
  /** Item or field schema for `array` and `object` props (spec property schema). */
  schema?: CatalogValueSchema;
  deprecated?: CatalogDeprecation;
}

/** A concrete usage sample (props only; no live Svelte in the manifest). */
export interface CatalogExample {
  /** Stable example id within the component (`kebab-case`). */
  id: string;
  /** Short title for the website gallery. */
  title: string;
  description?: string;
  /** Props the example would pass. Unknown keys fail validation. */
  props: Readonly<Record<string, unknown>>;
}

/**
 * One catalog entry. Authors write these; the catalog build validates them
 * and content-addresses the closed list. `agentEmittable` defaults to false
 * so a missing field never silently opens a component to agents.
 */
export interface CatalogManifest {
  /** Closed component id (`kebab-case`, unique in the catalog). */
  id: string;
  /** Workspace package that exports the component (e.g. `texuli`, `@texuli/data`). */
  package: string;
  /** Display name. */
  label: string;
  /** One-line summary for MCP and search. */
  summary: string;
  tier: CatalogTier;
  /**
   * When true, agents may emit this component id. Default **false**.
   * Overlay and navigation chrome stay non-emittable even if tier is `app`.
   */
  agentEmittable?: boolean;
  /**
   * Optional declaration of the authored-manifest schema version. Must be
   * `1` (the current `MANIFEST_SCHEMA_VERSION`) when set; omitting it means
   * the same. Authoring metadata only: the catalog build strips it before
   * content-addressing, so declaring it or omitting it yields the same
   * built catalog and the same digest.
   */
  schemaVersion?: 1;
  /** Situations where this component is the right choice. */
  useWhen: readonly string[];
  /** Situations where another component (or none) is better. */
  dontUseWhen: readonly string[];
  /** How the component stays usable with keyboard, SR, contrast, RTL, motion. */
  a11y: string | readonly string[];
  /** Public props the host may pass. */
  props: readonly CatalogPropSchema[];
  /** At least one example when `agentEmittable` is true. */
  examples: readonly CatalogExample[];
  /** Optional related component ids. */
  related?: readonly string[];
  /** Events the component fires that a node's `on` may handle (closed vocabulary). */
  events?: readonly CatalogEventName[];
  /** Props a node may two-way `bind` to a state variable; each a portable, data prop. */
  bindable?: readonly string[];
  deprecated?: CatalogDeprecation;
}

/** Path segment in a manifest diagnostic. */
export type ManifestPath = string | number;

/** One stable diagnostic from {@link validateCatalogManifest}. */
export interface ManifestDiagnostic {
  code: string;
  path: ManifestPath[];
  /** JSONPath-style path, e.g. `$.props[0].name`. */
  jsonPath: string;
  message: string;
  /** Next step an author or agent can take. */
  hint: string;
}

/** Full validity and diagnostics for one or many manifests. */
export interface ManifestValidation {
  valid: boolean;
  diagnostics: ManifestDiagnostic[];
}
