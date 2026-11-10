/**
 * The matrix model of the kit (kit API §5.2, §11.4; ADR-032): every enabled catalog
 * component with the values of each axis split into allowed and disallowed, its allowed
 * states, its default combination, and the cells the matrix renders — deterministic (catalog
 * order, then axis value order, then state order) so a render check can crawl the kit.
 * Disallowed values and components are reported for marking, never as cells. Pure and total
 * over JSON values.
 */
import { KIT_LIMITS, kitText } from '../shared/limits.ts';
import type { KitAllowManifest, KitAxis, KitCatalog, KitState } from '../shared/types.ts';

/** The axes in render order and the allow list each reads. */
export const MATRIX_AXES: readonly (readonly [
  KitAxis,
  'variants' | 'sizes' | 'tones' | 'densities' | 'colors',
])[] = [
  ['variant', 'variants'],
  ['size', 'sizes'],
  ['tone', 'tones'],
  ['density', 'densities'],
  ['color', 'colors'],
];

/** The catalog's closed state order. */
export const MATRIX_STATES: readonly KitState[] = [
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

/** States the kit cannot set through a prop: one live sample the reader hovers, focuses or presses. */
export const PSEUDO_STATES: ReadonlySet<KitState> = new Set(['hover', 'focus-visible', 'active']);

export interface MatrixAxis {
  readonly axis: KitAxis;
  /** The component prop that drives the axis. */
  readonly prop: string;
  readonly allowed: readonly string[];
  readonly disallowed: readonly string[];
  /** The value the default combination uses (the catalog default when allowed). */
  readonly default?: string;
}

export interface MatrixComponent {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly axes: readonly MatrixAxis[];
  readonly states: {
    readonly allowed: readonly KitState[];
    readonly disallowed: readonly KitState[];
  };
  /** The default combination: axis → value. */
  readonly defaults: Readonly<Partial<Record<KitAxis, string>>>;
}

export interface MatrixIssue {
  /** `unknown-component`, `unknown-value` or `unknown-state`, as `checkDesignSystemAllow` names them. */
  readonly code: 'unknown-component' | 'unknown-value' | 'unknown-state';
  readonly id: string;
  readonly detail?: string;
}

export interface MatrixModel {
  /** False when no allow set applies: every catalog component is enabled. */
  readonly locked: boolean;
  readonly enabled: readonly MatrixComponent[];
  /** Catalog ids the design system does not allow (listed, never rendered). */
  readonly disallowedComponents: readonly string[];
  /** Allow ids, values or states the catalog does not list (a warning list, never rendered). */
  readonly issues: readonly MatrixIssue[];
}

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.slice(0, KIT_LIMITS.listItems).filter((v): v is string => typeof v === 'string')
    : undefined;

/** The matrix of a catalog under an allow manifest (omitted or without `allow`: unlocked). */
export function matrixModel(
  catalog: KitCatalog | undefined,
  allow?: KitAllowManifest
): MatrixModel {
  const components = (catalog?.components ?? []).slice(0, KIT_LIMITS.components);
  const section = allow?.allow;
  const known = new Set(components.map((c) => c.id));
  const issues: MatrixIssue[] = [];
  if (section)
    for (const id of Object.keys(section).sort())
      if (!known.has(id))
        issues.push({ code: 'unknown-component', id: kitText(id, 64)?.text ?? id });

  const enabled: MatrixComponent[] = [];
  const disallowedComponents: string[] = [];
  for (const component of components) {
    const entry = section
      ? Object.hasOwn(section, component.id)
        ? section[component.id]
        : undefined
      : {};
    if (!entry) {
      disallowedComponents.push(component.id);
      continue;
    }
    const axes: MatrixAxis[] = [];
    const defaults: Partial<Record<KitAxis, string>> = {};
    for (const [axis, list] of MATRIX_AXES) {
      const spec = component.axes?.[axis];
      const listed = strings((entry as Record<string, unknown>)[list]);
      if (!spec) {
        for (const value of listed ?? [])
          issues.push({ code: 'unknown-value', id: component.id, detail: `${axis} ${value}` });
        continue;
      }
      const values = [...spec.values];
      const allowed = listed ? values.filter((v) => listed.includes(v)) : values;
      for (const value of listed ?? [])
        if (!values.includes(value))
          issues.push({ code: 'unknown-value', id: component.id, detail: `${axis} ${value}` });
      const fallback = allowed.includes(spec.default) ? spec.default : allowed[0];
      if (fallback !== undefined) defaults[axis] = fallback;
      axes.push({
        axis,
        prop: spec.prop,
        allowed,
        disallowed: values.filter((v) => !allowed.includes(v)),
        ...(fallback !== undefined ? { default: fallback } : {}),
      });
    }
    const catalogStates = MATRIX_STATES.filter((s) => component.states?.includes(s));
    const listedStates = strings((entry as Record<string, unknown>).states);
    for (const state of listedStates ?? [])
      if (!catalogStates.includes(state as KitState))
        issues.push({ code: 'unknown-state', id: component.id, detail: state });
    const allowedStates = listedStates
      ? catalogStates.filter((s) => listedStates.includes(s))
      : catalogStates;
    enabled.push({
      id: component.id,
      label: kitText(component.label, 200)?.text ?? component.id,
      group: component.group,
      axes,
      states: {
        allowed: allowedStates,
        disallowed: catalogStates.filter((s) => !allowedStates.includes(s)),
      },
      defaults,
    });
  }
  return { locked: section !== undefined, enabled, disallowedComponents, issues };
}

/**
 * Groups stay open (and mounted) when the allow set is this size or smaller.
 * A 251-key allow is above it: groups start closed and mount on open.
 */
export const MATRIX_LAZY_THRESHOLD = 32;
/** When the allow is above the threshold, this many groups start open. */
export const MATRIX_OPEN_GROUPS = 1;

export interface MatrixGroup {
  readonly id: string;
  readonly label: string;
  readonly components: readonly MatrixComponent[];
}

/** Consecutive catalog-group runs, so flattening the groups is catalog order. */
export function matrixGroups(model: MatrixModel): readonly MatrixGroup[] {
  const groups: MatrixGroup[] = [];
  for (const component of model.enabled) {
    const id = component.group || 'other';
    const last = groups[groups.length - 1];
    if (last && last.id === id)
      groups[groups.length - 1] = { ...last, components: [...last.components, component] };
    else groups.push({ id, label: id, components: [component] });
  }
  return groups;
}

/** Open (and SSR-mounted) when the allow is small, or for the first `MATRIX_OPEN_GROUPS`. */
export function matrixGroupOpenByDefault(model: MatrixModel, groupIndex: number): boolean {
  if (model.enabled.length <= MATRIX_LAZY_THRESHOLD) return true;
  return groupIndex < MATRIX_OPEN_GROUPS;
}

/** Where a cell sits: the variant × size grid, a strip (state, tone, density, color), or the full product. */
export type MatrixCellKind = 'grid' | 'state' | 'tone' | 'density' | 'color' | 'full';

export interface MatrixCell {
  /** Stable within the component: `variant=default,size=md,state=disabled`. */
  readonly key: string;
  readonly kind: MatrixCellKind;
  /** Axis → value of this combination. */
  readonly values: Readonly<Partial<Record<KitAxis, string>>>;
  readonly state?: KitState;
}

export interface MatrixCells {
  readonly view: 'grid' | 'full';
  readonly cells: readonly MatrixCell[];
  /** `full` was asked for but the product exceeds `KIT_LIMITS.cellsPerComponent`: grid instead. */
  readonly capped: boolean;
}

const keyOf = (values: Partial<Record<KitAxis, string>>, state?: KitState) =>
  [
    ...MATRIX_AXES.flatMap(([axis]) =>
      values[axis] !== undefined ? [`${axis}=${values[axis]}`] : []
    ),
    ...(state ? [`state=${state}`] : []),
  ].join(',') || 'default';

const axisOf = (component: MatrixComponent, axis: KitAxis) =>
  component.axes.find((a) => a.axis === axis);

/** The prop-backed states, rendered statically (pseudo-states get one live sample instead). */
export function staticStates(component: MatrixComponent): KitState[] {
  return component.states.allowed.filter((s) => !PSEUDO_STATES.has(s));
}

/**
 * The cells of one component. `grid`: allowed variants × allowed sizes at the default state,
 * then a strip per prop-backed state at the default combination, then a tone, density and
 * color strip. `full`: every allowed combination of the five axes and each prop-backed
 * state (plus the default), capped by `KIT_LIMITS.cellsPerComponent` (over it: grid).
 */
export function matrixCells(
  component: MatrixComponent,
  view: 'grid' | 'full' = 'grid'
): MatrixCells {
  const states = staticStates(component);
  if (view === 'full') {
    let combos: Partial<Record<KitAxis, string>>[] = [{}];
    for (const [axis] of MATRIX_AXES) {
      const a = axisOf(component, axis);
      if (!a || a.allowed.length === 0) continue;
      combos = combos.flatMap((c) => a.allowed.map((v) => ({ ...c, [axis]: v })));
    }
    const total = combos.length * (states.length + 1);
    if (total <= KIT_LIMITS.cellsPerComponent) {
      const cells: MatrixCell[] = [];
      for (const values of combos)
        for (const state of [undefined, ...states])
          cells.push({
            key: keyOf(values, state),
            kind: 'full',
            values,
            ...(state ? { state } : {}),
          });
      return { view: 'full', cells, capped: false };
    }
    return { ...matrixCells(component, 'grid'), capped: true };
  }
  const base = component.defaults;
  const variants = axisOf(component, 'variant')?.allowed ?? [];
  const sizes = axisOf(component, 'size')?.allowed ?? [];
  const cells: MatrixCell[] = [];
  for (const variant of variants.length > 0 ? variants : [undefined])
    for (const size of sizes.length > 0 ? sizes : [undefined]) {
      const values = { ...base, ...(variant ? { variant } : {}), ...(size ? { size } : {}) };
      cells.push({ key: keyOf(values), kind: 'grid', values });
    }
  for (const state of states)
    cells.push({ key: keyOf(base, state), kind: 'state', values: base, state });
  for (const axis of ['tone', 'density', 'color'] as const)
    for (const value of axisOf(component, axis)?.allowed ?? []) {
      const values = { ...base, [axis]: value };
      if (cells.some((c) => c.key === keyOf(values))) continue;
      cells.push({ key: keyOf(values), kind: axis, values });
    }
  return { view: 'grid', cells: cells.slice(0, KIT_LIMITS.cellsPerComponent), capped: false };
}

/** The root attributes a sample of this combination carries (T3: names from ADR-032). */
export function matrixAttributes(
  component: MatrixComponent,
  values: Partial<Record<KitAxis, string>>
): Record<string, string> {
  const out: Record<string, string> = { 'data-tx-component': component.id };
  for (const [axis] of MATRIX_AXES) {
    const value = values[axis];
    if (value !== undefined && axisOf(component, axis) && !(axis === 'color' && value === 'none'))
      out[`data-tx-${axis}`] = value;
  }
  return out;
}

/** The component props of a combination: each axis value set on its prop. */
export function matrixProps(
  component: MatrixComponent,
  values: Partial<Record<KitAxis, string>>
): Record<string, string> {
  const props: Record<string, string> = {};
  for (const axis of component.axes) {
    const value = values[axis.axis];
    if (value !== undefined) props[axis.prop] = value;
  }
  return props;
}
