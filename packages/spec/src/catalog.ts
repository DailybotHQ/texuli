/**
 * The spec's catalog vocabulary (`catalog/components.json`) and its
 * projection from a built catalog. The projection is the bootstrap step of
 * spec/Compose design §2.3; the parity check reruns it to catch drift.
 */

import type {
  SpecAxes,
  SpecAxis,
  SpecCatalog,
  SpecComponent,
  SpecDeprecation,
  SpecEventName,
  SpecProp,
  SpecPropSchema,
  SpecStateName,
} from '../generated/typescript/catalog-schema.ts';

export type {
  SpecAxes,
  SpecAxis,
  SpecCatalog,
  SpecComponent,
  SpecDeprecation,
  SpecEventName,
  SpecProp,
  SpecPropSchema,
  SpecStateName,
};

export const CAPABILITIES = ['portable-core', 'web-only', 'native-only', 'unknown'] as const;
export type Capability = SpecComponent['capability'];
export type SpecPropKind = SpecProp['kind'];

/** Prop kinds that cannot cross the shared boundary: they become web extensions. */
export const WEB_ONLY_KINDS: readonly SpecPropKind[] = ['slot', 'event', 'unknown'];

/**
 * Props that are web implementation details whatever their kind (spec/Compose
 * design §6): CSS hooks and the chart renderer choice (`svg`, `canvas`, `auto`).
 */
export const WEB_ONLY_PROP_NAMES: readonly string[] = ['class', 'className', 'style', 'renderer'];

/** The fields of a built catalog the projection reads (no dependency on the catalog package). */
export interface BuiltCatalogLike {
  entries: readonly {
    id: string;
    label: string;
    summary: string;
    group: string;
    tier: 'app' | 'content';
    emit: readonly string[];
    events?: readonly SpecEventName[];
    bindable?: readonly string[];
    sourceable?: readonly string[];
    deprecated?: SpecDeprecation;
    /** ADR-032: axis name → the enum prop that drives it (authored in the manifest). */
    axes?: Readonly<Partial<Record<SpecAxisName, string>>>;
    /** ADR-032: the observable states (authored in the manifest). */
    states?: readonly string[];
    /** Public module + export names that belong to this catalog id. */
    imports?: readonly { readonly module: string; readonly exports: readonly string[] }[];
    props: readonly {
      name: string;
      kind: SpecPropKind;
      required?: boolean;
      enumValues?: readonly string[];
      default?: unknown;
      schema?: SpecPropSchema;
      deprecated?: SpecDeprecation;
    }[];
  }[];
}

/**
 * Project a built catalog into the spec vocabulary. Deterministic: components
 * sorted by id, props by name, emit tiers, events, bindable and sourceable
 * props sorted; events, bindable, sourceable, property schemas and deprecations only when present. Capability is `unknown`
 * unless `capabilities` (the reviewed `catalog/capabilities.json`) records an
 * audited value (ADR-003: no id is portable until audited).
 */
export function projectCatalog(
  catalog: BuiltCatalogLike,
  catalogHash: string,
  capabilities: Readonly<Record<string, Capability>> = {},
  variants: readonly unknown[] = []
): SpecCatalog {
  const merged = mergeCatalogVariants(catalog, variants);
  if (merged.issues.length > 0) throw new CatalogVariantsError(merged.issues);
  const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : 1);
  const components = [...catalog.entries]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((entry): SpecComponent => {
      const declared = merged.byId.get(entry.id);
      const axes = declared ? projectAxes(entry, declared.axes) : undefined;
      const states = declared?.states.length
        ? SPEC_STATE_NAMES.filter((state) => declared.states.includes(state))
        : undefined;
      return {
        id: entry.id,
        label: entry.label,
        summary: entry.summary,
        group: entry.group,
        placement: entry.tier,
        emit: [...entry.emit].sort() as SpecComponent['emit'],
        capability: Object.hasOwn(capabilities, entry.id)
          ? (capabilities[entry.id] as Capability)
          : 'unknown',
        props: [...entry.props].sort(byName).map(
          (prop): SpecProp => ({
            name: prop.name,
            kind: prop.kind,
            ...(prop.required === true ? { required: true } : {}),
            ...(prop.enumValues ? { enumValues: [...prop.enumValues] } : {}),
            ...(WEB_ONLY_KINDS.includes(prop.kind) || WEB_ONLY_PROP_NAMES.includes(prop.name)
              ? { extension: 'web' as const }
              : {}),
            ...(prop.schema ? { schema: prop.schema } : {}),
            ...(prop.deprecated ? { deprecated: { ...prop.deprecated } } : {}),
          })
        ),
        ...(entry.events?.length ? { events: [...entry.events].sort() } : {}),
        ...(entry.bindable?.length ? { bindable: [...entry.bindable].sort() } : {}),
        ...(entry.sourceable?.length ? { sourceable: [...entry.sourceable].sort() } : {}),
        ...(axes ? { axes } : {}),
        ...(states ? { states } : {}),
        ...(entry.imports && entry.imports.length > 0
          ? {
              imports: entry.imports.map((item) => ({
                module: item.module,
                exports: [...item.exports],
              })),
            }
          : {}),
        ...(entry.deprecated ? { deprecated: { ...entry.deprecated } } : {}),
      };
    });
  return { catalogHash, components };
}

/* ------------------------------------------------------------------------ */
/* Variants, sizes and states (ADR-032, spec 0.13.0)                         */
/* ------------------------------------------------------------------------ */

/** The styling axes, in their canonical order. */
export const SPEC_AXIS_NAMES = ['variant', 'size', 'tone', 'density', 'color'] as const;
export type SpecAxisName = (typeof SPEC_AXIS_NAMES)[number];

/** The closed list of observable states, in their canonical order (`$defs.stateName`). */
export const SPEC_STATE_NAMES: readonly SpecStateName[] = [
  'hover',
  'focus-visible',
  'active',
  'disabled',
  'loading',
  'invalid',
  'selected',
  'expanded',
  'checked',
  'open',
  'readonly',
];

/** The format tag of a per-group variants source file (`catalog/variants/*.json`). */
export const CATALOG_VARIANTS_FORMAT = 'texuli-catalog-variants';
export const CATALOG_VARIANTS_VERSION = 1;
/** Bounds for an untrusted variants file. */
export const CATALOG_VARIANTS_LIMITS = { components: 512, bytes: 262_144 } as const;

/**
 * One axis in a source: the enum prop's name, or the prop with the default to
 * use when the manifest prop declares none.
 */
export type CatalogVariantAxisSource =
  | string
  | { readonly prop: string; readonly default?: string };

/** What a source declares for one component. */
export interface CatalogVariantSource {
  readonly axes?: Readonly<Partial<Record<SpecAxisName, CatalogVariantAxisSource>>>;
  readonly states?: readonly string[];
}

/**
 * A per-group variants source file: the catalog generator merges every file
 * with the axes and states the manifests declare. An id is declared once
 * (in one file, or in its manifest).
 */
export interface CatalogVariantsFile {
  readonly format: typeof CATALOG_VARIANTS_FORMAT;
  readonly version: typeof CATALOG_VARIANTS_VERSION;
  /** A name for diagnostics (e.g. `part-a`). */
  readonly name?: string;
  readonly components: Readonly<Record<string, CatalogVariantSource>>;
}

/** Stable codes of the variants checks (source files and the projected catalog). */
export const CATALOG_VARIANTS_CODES = [
  'variants-format',
  'variants-oversize',
  'variants-unknown-component',
  'variants-duplicate-component',
  'variants-unknown-axis',
  'variants-axis-prop',
  'variants-axis-default',
  'variants-axis-drift',
  'variants-unknown-state',
  'variants-duplicate-state',
] as const;
export type CatalogVariantsCode = (typeof CATALOG_VARIANTS_CODES)[number];

export interface CatalogVariantsIssue {
  readonly code: CatalogVariantsCode;
  /** The source (`<file name>` or `manifest`) and the JSON path inside it. */
  readonly path: string;
  readonly message: string;
}

/** The projection refuses inconsistent variants sources. */
export class CatalogVariantsError extends Error {
  readonly issues: readonly CatalogVariantsIssue[];
  constructor(issues: readonly CatalogVariantsIssue[]) {
    super(
      `Catalog variants are inconsistent:\n${issues.map((i) => `- ${i.code} at ${i.path}: ${i.message}`).join('\n')}`
    );
    this.name = 'CatalogVariantsError';
    this.issues = issues;
  }
}

interface DeclaredVariants {
  readonly axes: Partial<Record<SpecAxisName, { prop: string; default?: string }>>;
  readonly states: readonly SpecStateName[];
}

type Entry = BuiltCatalogLike['entries'][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Reads every variants source (untrusted JSON: bounded, never executed) and
 * the manifests' own `axes` and `states`, and checks them against the built
 * catalog. Each issue has a stable code; `byId` holds what passed.
 */
export function mergeCatalogVariants(
  catalog: BuiltCatalogLike,
  files: readonly unknown[]
): { byId: Map<string, DeclaredVariants>; issues: CatalogVariantsIssue[] } {
  const issues: CatalogVariantsIssue[] = [];
  const byId = new Map<string, DeclaredVariants>();
  const origin = new Map<string, string>();
  const entries = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  const push = (code: CatalogVariantsCode, path: string, message: string) =>
    issues.push({ code, path, message });

  const declare = (source: string, id: string, raw: unknown) => {
    const at = `${source}:$.components.${id}`;
    const entry = entries.get(id);
    if (!entry) {
      push('variants-unknown-component', at, `"${id}" is not a catalog id`);
      return;
    }
    const previous = origin.get(id);
    if (previous !== undefined) {
      push('variants-duplicate-component', at, `"${id}" is already declared in ${previous}`);
      return;
    }
    origin.set(id, source);
    if (!isRecord(raw)) {
      push('variants-format', at, 'a component declares { axes?, states? }');
      return;
    }
    for (const key of Object.keys(raw)) {
      if (key !== 'axes' && key !== 'states')
        push('variants-format', `${at}.${key}`, `unknown field "${key}"`);
    }
    const axes: DeclaredVariants['axes'] = {};
    if (raw.axes !== undefined) {
      if (!isRecord(raw.axes)) push('variants-format', `${at}.axes`, 'axes is an object');
      else {
        for (const [axis, value] of Object.entries(raw.axes)) {
          const where = `${at}.axes.${axis}`;
          if (!(SPEC_AXIS_NAMES as readonly string[]).includes(axis)) {
            push('variants-unknown-axis', where, `axes are ${SPEC_AXIS_NAMES.join(', ')}`);
            continue;
          }
          const declared =
            typeof value === 'string'
              ? { prop: value }
              : isRecord(value) &&
                  typeof value.prop === 'string' &&
                  (value.default === undefined || typeof value.default === 'string') &&
                  Object.keys(value).every((k) => k === 'prop' || k === 'default')
                ? {
                    prop: value.prop,
                    ...(typeof value.default === 'string' ? { default: value.default } : {}),
                  }
                : undefined;
          if (!declared) {
            push('variants-format', where, 'an axis is a prop name or { prop, default? }');
            continue;
          }
          const problem = axisProblem(entry, declared);
          if (problem) push(problem.code, where, problem.message);
          else axes[axis as SpecAxisName] = declared;
        }
      }
    }
    const states: SpecStateName[] = [];
    if (raw.states !== undefined) {
      if (!Array.isArray(raw.states) || raw.states.length > SPEC_STATE_NAMES.length)
        push('variants-format', `${at}.states`, 'states is an array of state names');
      else
        raw.states.forEach((state, i) => {
          if (!(SPEC_STATE_NAMES as readonly unknown[]).includes(state))
            push(
              'variants-unknown-state',
              `${at}.states[${i}]`,
              `states are ${SPEC_STATE_NAMES.join(', ')}`
            );
          else if (states.includes(state as SpecStateName))
            push('variants-duplicate-state', `${at}.states[${i}]`, `"${state}" repeats`);
          else states.push(state as SpecStateName);
        });
    }
    byId.set(id, { axes, states });
  };

  for (const entry of [...catalog.entries].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (entry.axes === undefined && entry.states === undefined) continue;
    declare('manifest', entry.id, {
      ...(entry.axes ? { axes: entry.axes } : {}),
      ...(entry.states ? { states: entry.states } : {}),
    });
  }
  files.forEach((file, index) => {
    const name =
      isRecord(file) && typeof file.name === 'string' && /^[a-z0-9-]{1,32}$/.test(file.name)
        ? file.name
        : `variants[${index}]`;
    if (
      !isRecord(file) ||
      file.format !== CATALOG_VARIANTS_FORMAT ||
      file.version !== CATALOG_VARIANTS_VERSION ||
      !isRecord(file.components) ||
      Object.keys(file).some((k) => !['format', 'version', 'name', 'components'].includes(k))
    ) {
      push(
        'variants-format',
        `${name}:$`,
        `a variants file is { format: "${CATALOG_VARIANTS_FORMAT}", version: ${CATALOG_VARIANTS_VERSION}, name?, components }`
      );
      return;
    }
    const ids = Object.keys(file.components);
    if (
      ids.length > CATALOG_VARIANTS_LIMITS.components ||
      JSON.stringify(file).length > CATALOG_VARIANTS_LIMITS.bytes
    ) {
      push(
        'variants-oversize',
        `${name}:$`,
        `at most ${CATALOG_VARIANTS_LIMITS.components} components and ${CATALOG_VARIANTS_LIMITS.bytes} bytes`
      );
      return;
    }
    for (const id of ids.sort()) declare(name, id, file.components[id]);
  });
  return { byId, issues };
}

/** Why an axis cannot be derived from the component's prop, if it cannot. */
function axisProblem(
  entry: Entry,
  axis: { prop: string; default?: string }
): { code: CatalogVariantsCode; message: string } | undefined {
  const prop = entry.props.find((candidate) => candidate.name === axis.prop);
  if (prop?.kind !== 'enum' || !prop.enumValues?.length)
    return {
      code: 'variants-axis-prop',
      message: `"${axis.prop}" is not an enum prop of ${entry.id}`,
    };
  const manifestDefault = typeof prop.default === 'string' ? prop.default : undefined;
  if (
    axis.default !== undefined &&
    manifestDefault !== undefined &&
    axis.default !== manifestDefault
  )
    return {
      code: 'variants-axis-default',
      message: `default "${axis.default}" contradicts the prop default "${manifestDefault}"`,
    };
  const value = axis.default ?? manifestDefault;
  if (value === undefined || !prop.enumValues.includes(value))
    return {
      code: 'variants-axis-default',
      message: `the "${axis.prop}" axis needs a default among ${prop.enumValues.join(', ')}`,
    };
  return undefined;
}

function projectAxes(entry: Entry, declared: DeclaredVariants['axes']): SpecAxes | undefined {
  const out: Partial<Record<SpecAxisName, SpecAxis>> = {};
  for (const axis of SPEC_AXIS_NAMES) {
    const source = declared[axis];
    if (!source) continue;
    const prop = entry.props.find((candidate) => candidate.name === source.prop);
    const values = [...(prop?.enumValues ?? [])];
    const value =
      source.default ?? (typeof prop?.default === 'string' ? prop.default : (values[0] as string));
    out[axis] = { prop: source.prop, values, default: value };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The rules the catalog schema cannot express for `axes` and `states` in a
 * projected catalog: an axis still matches its prop (`variants-axis-drift`),
 * its default is one of its values (`variants-axis-default`), and no state
 * repeats (`variants-duplicate-state`). Unknown axes and states are refused by
 * the schema itself.
 */
export function checkCatalogVariants(catalog: SpecCatalog): CatalogVariantsIssue[] {
  const issues: CatalogVariantsIssue[] = [];
  for (const component of catalog?.components ?? []) {
    const at = `catalog/components.json:${component.id}`;
    for (const axis of SPEC_AXIS_NAMES) {
      const declared = component.axes?.[axis];
      if (!declared) continue;
      const prop = component.props.find((candidate) => candidate.name === declared.prop);
      const values = prop?.kind === 'enum' ? (prop.enumValues ?? []) : [];
      if (
        values.length === 0 ||
        values.length !== declared.values.length ||
        values.some((value, i) => declared.values[i] !== value)
      ) {
        issues.push({
          code: 'variants-axis-drift',
          path: `${at}.axes.${axis}`,
          message: `values must equal the enumValues of the "${declared.prop}" enum prop`,
        });
      } else if (!declared.values.includes(declared.default)) {
        issues.push({
          code: 'variants-axis-default',
          path: `${at}.axes.${axis}`,
          message: `default "${declared.default}" is not one of the values`,
        });
      }
    }
    const states = component.states ?? [];
    if (new Set(states).size !== states.length)
      issues.push({
        code: 'variants-duplicate-state',
        path: `${at}.states`,
        message: 'a state repeats',
      });
  }
  return issues;
}
