import type { CatalogManifest, ManifestDiagnostic } from '../manifest/types.ts';
import { validateCatalogManifests } from '../manifest/validate.ts';
import { canonicalJson, sha256Hex } from './canonical.ts';
import { type CatalogEmitTier, emitTiers, isOverlayId } from './tiers.ts';

/** The catalog file format. */
export const CATALOG_FORMAT = 'texuli-catalog';
export const CATALOG_VERSION = 1;

/** One manifest group: a folder of `src/manifests/` (or any named list). */
export interface ManifestGroup {
  name: string;
  manifests: readonly CatalogManifest[];
}

/** One catalog entry: the manifest, its group and the tiers that may emit it. */
export type CatalogEntry = CatalogManifest & {
  group: string;
  emit: CatalogEmitTier[];
};

/** The built catalog (the file's content). */
export interface Catalog {
  format: typeof CATALOG_FORMAT;
  version: typeof CATALOG_VERSION;
  /** Group name → its component ids, sorted. */
  groups: Record<string, string[]>;
  /** Every component, sorted by id. */
  entries: CatalogEntry[];
  /** Tier → the component ids it may emit, sorted. */
  tiers: Record<CatalogEmitTier, string[]>;
}

export interface CatalogBuild {
  catalog: Catalog;
  /** The exact file bytes (canonical JSON). */
  json: string;
  /** SHA-256 of `json`: the catalog's address. */
  hash: string;
  /** `catalog-<hash>.json`. */
  fileName: string;
}

/** The build refuses invalid or contradictory manifests. */
export class CatalogBuildError extends Error {
  readonly diagnostics: readonly ManifestDiagnostic[];
  constructor(diagnostics: readonly ManifestDiagnostic[]) {
    super(
      `Catalog build failed:\n${diagnostics.map((d) => `- ${d.code} at ${d.jsonPath}: ${d.message}`).join('\n')}`
    );
    this.name = 'CatalogBuildError';
    this.diagnostics = diagnostics;
  }
}

const GROUP_NAME = /^[a-z][a-z0-9-]*$/;
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The file name a catalog with this hash is stored under. */
export function catalogFileName(hash: string): string {
  return `catalog-${hash}.json`;
}

/**
 * Builds the catalog from every manifest group: validates all manifests
 * together (unique ids across groups), refuses agent-emittable overlays,
 * assigns emit tiers, and content-addresses the canonical JSON. The input
 * order of groups and manifests does not change the result.
 */
export async function buildCatalog(groups: readonly ManifestGroup[]): Promise<CatalogBuild> {
  const diagnostics: ManifestDiagnostic[] = [];
  const issue = (code: string, path: (string | number)[], message: string, hint: string) =>
    diagnostics.push({
      code,
      path,
      jsonPath: `$${path.map((p) => (typeof p === 'number' ? `[${p}]` : `.${p}`)).join('')}`,
      message,
      hint,
    });

  const names = new Set<string>();
  for (const group of groups) {
    if (!GROUP_NAME.test(group.name)) {
      issue(
        'invalid-group',
        ['groups', group.name],
        `Bad group name "${group.name}".`,
        'Use a kebab-case folder name.'
      );
    } else if (names.has(group.name)) {
      issue(
        'duplicate-group',
        ['groups', group.name],
        `Group "${group.name}" appears twice.`,
        'Merge the two lists.'
      );
    }
    names.add(group.name);
  }

  const flat = groups.flatMap((group) =>
    group.manifests.map((manifest) => ({ manifest, group: group.name }))
  );
  const validation = validateCatalogManifests(flat.map((item) => item.manifest));
  diagnostics.push(...validation.diagnostics);
  flat.forEach(({ manifest }, index) => {
    if (
      manifest.agentEmittable === true &&
      (isOverlayId(manifest.id) || flat[index]?.group === 'overlays')
    ) {
      issue(
        'overlay-emittable',
        [index, 'agentEmittable'],
        `"${manifest.id}" is an overlay or focus trap marked agentEmittable.`,
        'Overlays, menus and focus traps are never agent-emittable: remove agentEmittable.'
      );
    }
  });
  if (diagnostics.length > 0) throw new CatalogBuildError(diagnostics);

  const entries: CatalogEntry[] = flat
    .map(({ manifest, group }) => {
      // `schemaVersion` is authoring metadata: it is stripped before
      // content-addressing so a manifest that declares it and one that
      // omits it build byte-identical catalogs.
      const { schemaVersion: _omit, ...body } = manifest;
      void _omit;
      return { ...body, group, emit: emitTiers(manifest, group) };
    })
    .sort(byId);
  const catalog: Catalog = {
    format: CATALOG_FORMAT,
    version: CATALOG_VERSION,
    groups: Object.fromEntries(
      [...names]
        .sort()
        .map((name) => [
          name,
          entries.filter((entry) => entry.group === name).map((entry) => entry.id),
        ])
    ),
    entries,
    tiers: {
      developer: entries.filter((entry) => entry.emit.includes('developer')).map((e) => e.id),
      untrusted: entries.filter((entry) => entry.emit.includes('untrusted')).map((e) => e.id),
    },
  };
  const json = canonicalJson(catalog);
  const hash = await sha256Hex(json);
  return { catalog, json, hash, fileName: catalogFileName(hash) };
}

/**
 * Checks a stored catalog against its name: the content's SHA-256 must be
 * the hash in `catalog-<hash>.json`. Returns the parsed catalog, or `null`
 * when the name or content does not match.
 */
export async function verifyCatalog(fileName: string, json: string): Promise<Catalog | null> {
  const match = /^catalog-([0-9a-f]{64})\.json$/.exec(fileName.split(/[\\/]/).pop() ?? '');
  if (!match || (await sha256Hex(json)) !== match[1]) return null;
  const catalog = JSON.parse(json) as Catalog;
  return catalog.format === CATALOG_FORMAT && catalog.version === CATALOG_VERSION ? catalog : null;
}

/** Whether untrusted model output may emit this component id. */
export function isTierU(catalog: Pick<Catalog, 'tiers'>, id: string): boolean {
  return catalog.tiers.untrusted.includes(id);
}
