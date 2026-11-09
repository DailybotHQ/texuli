/**
 * Host catalog extensions (ADR-032, spec 0.13.0): a host library publishes its own components
 * in the catalog's component shape, with ids namespaced `<namespace>:<id>` and a `composes`
 * list of the catalog ids each is built from (empty for a leaf built from host primitives).
 * `mergeCatalogs(texuli, extensions)` checks every
 * extension against the Texuli catalog and returns one catalog that design systems
 * (`checkDesignSystemAllow`), the allow manifest and the kit read, so an `allow` section can
 * enable or disable `acme:kpi-strip` like `button`.
 *
 * Extensions are untrusted input: bounded counts and bytes, closed shapes, no prototype keys,
 * stable codes, never executed or rendered. An extension component is app-tier host code:
 * it is never agent-emittable and never portable, so each component declares
 * `placement: "app"`, `emit: []` and `capability: "web-only"` (the catalog's own shape, so the
 * schema's `$defs.extension` validates the file as written).
 */

import { canonicalJson, sha256 } from './canonical.ts';
import type { SpecCatalog, SpecComponent } from './catalog.ts';
import { checkCatalogVariants, SPEC_STATE_NAMES } from './catalog.ts';

export const CATALOG_EXTENSION_FORMAT = 'texuli/catalog-extension';
export const CATALOG_EXTENSION_VERSION = 1;

/** Bounds for untrusted extension files. */
export const CATALOG_EXTENSION_LIMITS = Object.freeze({
  /** Extension files merged at once. */
  extensions: 16,
  /** Components in one extension. */
  components: 256,
  /** Catalog ids one component composes. */
  composes: 32,
  /** Props of one component. */
  props: 64,
  /** Bytes of one extension as JSON. */
  bytes: 262_144,
});

/** A namespace: 2 to 16 lowercase letters and digits. */
export const CATALOG_NAMESPACE = /^[a-z][a-z0-9]{1,15}$/;
/** Namespaces no host may claim. */
export const RESERVED_NAMESPACES: readonly string[] = ['texuli', 'tx', 'spec', 'catalog'];
const LOCAL_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Stable refusal codes of {@link mergeCatalogs}. */
export const CATALOG_EXTENSION_CODES = [
  'extension-format',
  'extension-oversize',
  'extension-namespace',
  'extension-id',
  'extension-collision',
  'extension-composes',
  'extension-props',
  'extension-axis',
  'extension-state',
] as const;
export type CatalogExtensionCode = (typeof CATALOG_EXTENSION_CODES)[number];

export interface CatalogExtensionIssue {
  readonly code: CatalogExtensionCode;
  /** `extensions[<i>]` and a JSON path inside it. */
  readonly path: string;
  readonly message: string;
}

/** What {@link mergeCatalogs} returns. */
export interface MergedCatalog {
  readonly ok: boolean;
  /**
   * The Texuli catalog plus every accepted extension component, sorted by id, with
   * `catalogHash` the SHA-256 of the merged canonical JSON (the Texuli catalog's own hash
   * when nothing was merged). Refused extensions are left out whole.
   */
  readonly catalog: SpecCatalog;
  /** The namespaces merged, with each extension's digest, in namespace order. */
  readonly extensions: readonly { readonly namespace: string; readonly digest: string }[];
  readonly issues: readonly CatalogExtensionIssue[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const COMPONENT_KEYS = new Set([
  'id',
  'label',
  'summary',
  'group',
  'placement',
  'emit',
  'capability',
  'props',
  'events',
  'bindable',
  'sourceable',
  'axes',
  'states',
  'composes',
  'deprecated',
]);
const PROP_KINDS = new Set([
  'string',
  'number',
  'boolean',
  'enum',
  'array',
  'object',
  'slot',
  'event',
  'unknown',
]);

const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value : undefined;

/**
 * Merge host extensions into the Texuli catalog. An extension is refused whole when any of
 * its components is (so a half-checked library never reaches a design system); the others
 * still merge. Total over JSON values; never throws; never mutates its inputs.
 */
export function mergeCatalogs(texuli: SpecCatalog, extensions: readonly unknown[]): MergedCatalog {
  const issues: CatalogExtensionIssue[] = [];
  const base = Array.isArray(texuli?.components) ? texuli.components : [];
  const baseIds = new Set(base.map((component) => component.id));
  const accepted: { namespace: string; components: SpecComponent[]; digest: string }[] = [];
  const namespaces = new Set<string>();
  const list = Array.isArray(extensions) ? extensions : [];

  if (list.length > CATALOG_EXTENSION_LIMITS.extensions)
    issues.push({
      code: 'extension-oversize',
      path: 'extensions',
      message: `At most ${CATALOG_EXTENSION_LIMITS.extensions} extensions merge at once.`,
    });

  // First pass: shape, namespace and ids of each extension (their composes need every id).
  const candidates: { index: number; namespace: string; components: SpecComponent[] }[] = [];
  list.slice(0, CATALOG_EXTENSION_LIMITS.extensions).forEach((raw, index) => {
    const at = `extensions[${index}]`;
    const local: CatalogExtensionIssue[] = [];
    const push = (code: CatalogExtensionCode, path: string, message: string) =>
      local.push({ code, path: `${at}${path}`, message });
    let bytes = Number.POSITIVE_INFINITY;
    try {
      bytes = JSON.stringify(raw)?.length ?? 0;
    } catch {
      // A cycle or a BigInt: not JSON.
    }
    if (bytes > CATALOG_EXTENSION_LIMITS.bytes) {
      issues.push({
        code: Number.isFinite(bytes) ? 'extension-oversize' : 'extension-format',
        path: at,
        message: Number.isFinite(bytes)
          ? `An extension is at most ${CATALOG_EXTENSION_LIMITS.bytes} bytes of JSON.`
          : 'An extension is JSON data.',
      });
      return;
    }
    if (
      !isRecord(raw) ||
      raw.format !== CATALOG_EXTENSION_FORMAT ||
      raw.version !== CATALOG_EXTENSION_VERSION ||
      !Array.isArray(raw.components) ||
      Object.keys(raw).some(
        (key) => !['format', 'version', 'namespace', 'components'].includes(key)
      )
    ) {
      issues.push({
        code: 'extension-format',
        path: at,
        message: `An extension is { format: "${CATALOG_EXTENSION_FORMAT}", version: 1, namespace, components }.`,
      });
      return;
    }
    const namespace = typeof raw.namespace === 'string' ? raw.namespace : '';
    if (!CATALOG_NAMESPACE.test(namespace) || RESERVED_NAMESPACES.includes(namespace)) {
      issues.push({
        code: 'extension-namespace',
        path: `${at}.namespace`,
        message: 'A namespace is 2 to 16 lowercase letters and digits, not a reserved name.',
      });
      return;
    }
    if (namespaces.has(namespace)) {
      issues.push({
        code: 'extension-collision',
        path: `${at}.namespace`,
        message: `Namespace "${namespace}" is already merged.`,
      });
      return;
    }
    if (
      raw.components.length === 0 ||
      raw.components.length > CATALOG_EXTENSION_LIMITS.components
    ) {
      issues.push({
        code: raw.components.length === 0 ? 'extension-format' : 'extension-oversize',
        path: `${at}.components`,
        message: `An extension has 1 to ${CATALOG_EXTENSION_LIMITS.components} components.`,
      });
      return;
    }
    const seen = new Set<string>();
    const components: SpecComponent[] = [];
    raw.components.forEach((entry, i) => {
      const path = `.components[${i}]`;
      if (!isRecord(entry)) {
        push('extension-format', path, 'A component is an object.');
        return;
      }
      for (const key of Object.keys(entry))
        if (!COMPONENT_KEYS.has(key))
          push('extension-format', `${path}.${key.slice(0, 40)}`, 'Unknown component field.');
      const id = typeof entry.id === 'string' ? entry.id : '';
      const [ns, localId, extra] = id.split(':');
      if (
        ns !== namespace ||
        !localId ||
        extra !== undefined ||
        !LOCAL_ID.test(localId) ||
        id.length > 64
      ) {
        push(
          'extension-id',
          `${path}.id`,
          `An id is "${namespace}:<kebab-case id>", at most 64 characters.`
        );
        return;
      }
      if (seen.has(id) || baseIds.has(id)) {
        push('extension-collision', `${path}.id`, `"${id}" is declared twice.`);
        return;
      }
      seen.add(id);
      const label = text(entry.label, 80);
      const summary = text(entry.summary, 300);
      const group =
        typeof entry.group === 'string' && LOCAL_ID.test(entry.group) ? entry.group : undefined;
      if (!label || !summary || !group) {
        push(
          'extension-format',
          path,
          'A component needs a label, a summary and a kebab-case group.'
        );
        return;
      }
      if (
        entry.placement !== 'app' ||
        !(Array.isArray(entry.emit) && entry.emit.length === 0) ||
        entry.capability !== 'web-only' ||
        entry.events !== undefined ||
        entry.bindable !== undefined ||
        entry.sourceable !== undefined
      ) {
        push(
          'extension-format',
          path,
          'An extension component is app-tier host code: placement "app", emit [], capability "web-only", no events, bindings or sources.'
        );
        return;
      }
      const props = Array.isArray(entry.props) ? entry.props : null;
      if (
        props === null ||
        props.length > CATALOG_EXTENSION_LIMITS.props ||
        !props.every(
          (prop) =>
            isRecord(prop) &&
            typeof prop.name === 'string' &&
            /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(prop.name) &&
            PROP_KINDS.has(prop.kind as string) &&
            Object.keys(prop).every((key) =>
              ['name', 'kind', 'required', 'enumValues'].includes(key)
            ) &&
            (prop.enumValues === undefined ||
              (Array.isArray(prop.enumValues) &&
                prop.enumValues.length > 0 &&
                prop.enumValues.length <= 32 &&
                prop.enumValues.every(
                  (v) => typeof v === 'string' && v.length > 0 && v.length <= 48
                )))
        ) ||
        new Set(props.map((prop) => (prop as { name: string }).name)).size !== props.length
      ) {
        push(
          'extension-props',
          `${path}.props`,
          `At most ${CATALOG_EXTENSION_LIMITS.props} props of { name, kind, required?, enumValues? }, names unique.`
        );
        return;
      }
      const composes = entry.composes;
      if (
        !Array.isArray(composes) ||
        composes.length > CATALOG_EXTENSION_LIMITS.composes ||
        !composes.every((c) => typeof c === 'string')
      ) {
        push(
          'extension-composes',
          `${path}.composes`,
          `An extension component composes at most ${CATALOG_EXTENSION_LIMITS.composes} catalog ids; an empty list marks a leaf built from host primitives.`
        );
        return;
      }
      const states = entry.states;
      if (
        states !== undefined &&
        (!Array.isArray(states) ||
          new Set(states).size !== states.length ||
          !states.every((s) => (SPEC_STATE_NAMES as readonly unknown[]).includes(s)))
      ) {
        push(
          'extension-state',
          `${path}.states`,
          `States are ${SPEC_STATE_NAMES.join(', ')}, each once.`
        );
        return;
      }
      const component = {
        id,
        label,
        summary,
        group,
        placement: 'app',
        emit: [],
        capability: 'web-only',
        props: (props as SpecComponent['props'])
          .map((prop) => ({
            name: prop.name,
            kind: prop.kind,
            ...(prop.required === true ? { required: true } : {}),
            ...(prop.enumValues ? { enumValues: [...prop.enumValues] } : {}),
          }))
          .sort((a, b) => (a.name < b.name ? -1 : 1)),
        ...(entry.axes !== undefined ? { axes: entry.axes as SpecComponent['axes'] } : {}),
        ...(states
          ? { states: SPEC_STATE_NAMES.filter((s) => (states as unknown[]).includes(s)) }
          : {}),
        composes: [...(composes as string[])],
      } as SpecComponent;
      // Axes follow the same contract as the catalog's own (values = the prop's enumValues).
      if (component.axes !== undefined) {
        const axisIssues = isRecord(entry.axes)
          ? checkCatalogVariants({ catalogHash: '', components: [component] })
          : [{ path: '', message: 'axes is an object' }];
        const shapeOk =
          isRecord(entry.axes) &&
          Object.entries(entry.axes).every(
            ([axis, value]) =>
              ['variant', 'size', 'tone', 'density'].includes(axis) &&
              isRecord(value) &&
              typeof value.prop === 'string' &&
              Array.isArray(value.values) &&
              typeof value.default === 'string' &&
              Object.keys(value).every((k) => ['prop', 'values', 'default'].includes(k))
          );
        if (!shapeOk || axisIssues.length > 0) {
          push(
            'extension-axis',
            `${path}.axes`,
            'Each axis is { prop, values, default } over an enum prop: values equal its enumValues, default one of them.'
          );
          return;
        }
      }
      components.push(component);
    });
    if (local.length > 0) {
      issues.push(...local);
      return;
    }
    namespaces.add(namespace);
    candidates.push({ index, namespace, components });
  });

  // Second pass: composes resolve in the merged catalog (Texuli ids and every accepted extension id).
  const known = new Set([...baseIds, ...candidates.flatMap((c) => c.components.map((x) => x.id))]);
  for (const candidate of candidates) {
    const local: CatalogExtensionIssue[] = [];
    candidate.components.forEach((component, i) => {
      for (const [j, ref] of (component.composes ?? []).entries()) {
        if (ref === component.id || !known.has(ref))
          local.push({
            code: 'extension-composes',
            path: `extensions[${candidate.index}].components[${i}].composes[${j}]`,
            message:
              ref === component.id
                ? 'A component cannot compose itself.'
                : `"${ref.slice(0, 64)}" is not a catalog id.`,
          });
      }
    });
    if (local.length > 0) {
      issues.push(...local);
      continue;
    }
    accepted.push({
      namespace: candidate.namespace,
      components: candidate.components,
      digest: sha256(
        canonicalJson({ namespace: candidate.namespace, components: candidate.components })
      ),
    });
  }
  // A refused extension that others compose leaves dangling references: refuse those too.
  let changed = true;
  while (changed) {
    changed = false;
    const ids = new Set([...baseIds, ...accepted.flatMap((a) => a.components.map((c) => c.id))]);
    for (let k = accepted.length - 1; k >= 0; k--) {
      const ext = accepted[k] as (typeof accepted)[number];
      const dangling = ext.components.find((c) => (c.composes ?? []).some((ref) => !ids.has(ref)));
      if (dangling) {
        issues.push({
          code: 'extension-composes',
          path: `extensions[${candidates.find((c) => c.namespace === ext.namespace)?.index ?? 0}]`,
          message: `"${dangling.id}" composes an id from a refused extension.`,
        });
        accepted.splice(k, 1);
        changed = true;
      }
    }
  }

  accepted.sort((a, b) => (a.namespace < b.namespace ? -1 : 1));
  const components = [...base, ...accepted.flatMap((a) => a.components)].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  const merged = accepted.length > 0;
  return {
    ok: issues.length === 0,
    catalog: {
      catalogHash: merged
        ? sha256(
            canonicalJson({
              texuli: texuli?.catalogHash,
              extensions: accepted.map((a) => a.digest),
            })
          )
        : (texuli?.catalogHash ?? ''),
      components,
    },
    extensions: accepted.map((a) => ({ namespace: a.namespace, digest: a.digest })),
    issues,
  };
}
