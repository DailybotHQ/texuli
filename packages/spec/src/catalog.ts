/**
 * The spec's catalog vocabulary (`catalog/components.json`) and its
 * projection from a built catalog. The projection is the bootstrap step of
 * spec/Compose design §2.3; the parity check reruns it to catch drift.
 */

import type {
  SpecCatalog,
  SpecComponent,
  SpecDeprecation,
  SpecEventName,
  SpecProp,
  SpecPropSchema,
} from '../generated/typescript/catalog-schema.ts';

export type {
  SpecCatalog,
  SpecComponent,
  SpecDeprecation,
  SpecEventName,
  SpecProp,
  SpecPropSchema,
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
    deprecated?: SpecDeprecation;
    props: readonly {
      name: string;
      kind: SpecPropKind;
      required?: boolean;
      enumValues?: readonly string[];
      schema?: SpecPropSchema;
      deprecated?: SpecDeprecation;
    }[];
  }[];
}

/**
 * Project a built catalog into the spec vocabulary. Deterministic: components
 * sorted by id, props by name, emit tiers, events and bindable props sorted;
 * events, bindable, property schemas and deprecations only when present. Capability is `unknown`
 * unless `capabilities` (the reviewed `catalog/capabilities.json`) records an
 * audited value (ADR-003: no id is portable until audited).
 */
export function projectCatalog(
  catalog: BuiltCatalogLike,
  catalogHash: string,
  capabilities: Readonly<Record<string, Capability>> = {}
): SpecCatalog {
  const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : 1);
  const components = [...catalog.entries]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(
      (entry): SpecComponent => ({
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
        ...(entry.deprecated ? { deprecated: { ...entry.deprecated } } : {}),
      })
    );
  return { catalogHash, components };
}
