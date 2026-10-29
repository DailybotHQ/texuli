import type {
  CatalogDeprecation,
  CatalogEventName,
  CatalogExample,
  CatalogManifest,
  CatalogPropSchema,
  CatalogTier,
} from './types.ts';

/**
 * A manifest as plain, frozen data: the normalization `defineCatalogManifest`
 * applies (trimmed strings, `agentEmittable` defaulting to `false`, only the
 * known fields), without the validator. The manifest groups use it so a
 * runtime that only needs the data (the player's render catalog) does not
 * ship the validator. Validation is not skipped: `buildCatalog` validates
 * every manifest of every group, and the catalog tests check that each group
 * entry passes `validateCatalogManifest` and equals its validated form.
 */
/* @__NO_SIDE_EFFECTS__ */
export function manifestData(input: CatalogManifest): Readonly<CatalogManifest> {
  const a11y =
    typeof input.a11y === 'string' ? input.a11y.trim() : input.a11y.map((s) => String(s).trim());
  const manifest: CatalogManifest = {
    id: String(input.id).trim(),
    package: String(input.package).trim(),
    label: String(input.label).trim(),
    summary: String(input.summary).trim(),
    tier: input.tier as CatalogTier,
    agentEmittable: input.agentEmittable === true,
    useWhen: input.useWhen.map((s) => s.trim()),
    dontUseWhen: input.dontUseWhen.map((s) => s.trim()),
    a11y,
    props: input.props as CatalogPropSchema[],
    examples: input.examples as CatalogExample[],
    ...(Array.isArray(input.related) ? { related: input.related.map((s) => s.trim()) } : {}),
    ...(Array.isArray(input.events) && input.events.length > 0
      ? { events: input.events as CatalogEventName[] }
      : {}),
    ...(Array.isArray(input.bindable) && input.bindable.length > 0
      ? { bindable: input.bindable as string[] }
      : {}),
    ...(Array.isArray(input.sourceable) && input.sourceable.length > 0
      ? { sourceable: input.sourceable as string[] }
      : {}),
    ...(input.deprecated !== null && typeof input.deprecated === 'object'
      ? { deprecated: input.deprecated as CatalogDeprecation }
      : {}),
  };
  return Object.freeze(manifest);
}
