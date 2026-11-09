/**
 * /design-systems/kit/ (PLAN_016 T-t4-site, kit API §6): the data the kit page renders, all
 * built at build time. The fictional example brand Ledgerline
 * (`examples/design-systems/ledgerline.json`, served as `texuli://design-system/ledgerline`)
 * is checked and compiled by the hub's loader; its allow manifest comes from that compile;
 * the catalog is the projected `packages/spec/catalog/components.json`, trimmed to what the
 * kit reads so the island's props stay small. No request at run time.
 */
import type { KitAllowManifest, KitCatalog, KitCompiled } from 'texuli/ds-kit';
import { type BrandId, brandDocument, loadBrands } from '../brands.ts';

/** The brand the page shows: locked to an allow set, with a library entry and a draft approval. */
export const KIT_BRAND: BrandId = 'ledgerline';

const CATALOG_RAW = import.meta.glob<string>(
  '../../../../../../packages/spec/catalog/components.json',
  { query: '?raw', import: 'default', eager: true }
);

type CatalogComponent = KitCatalog['components'][number];

/**
 * The catalog the kit needs: every id with its label and group (for the "not in this design
 * system" list), and the axes and states of the allowed ids (for the matrix). Prop lists are
 * dropped: the kit reads axes, not props.
 */
export function trimCatalog(catalog: KitCatalog, allowed: ReadonlySet<string>): KitCatalog {
  return {
    catalogHash: catalog.catalogHash,
    components: catalog.components.map((component): CatalogComponent => {
      const base = {
        id: component.id,
        label: component.label,
        summary: '',
        group: component.group,
        props: [],
      };
      return allowed.has(component.id)
        ? {
            ...base,
            summary: component.summary,
            ...(component.axes ? { axes: component.axes } : {}),
            ...(component.states ? { states: component.states } : {}),
          }
        : base;
    }),
  };
}

export interface KitPageData {
  readonly document: Record<string, unknown>;
  readonly compiled: KitCompiled;
  readonly allow: KitAllowManifest;
  readonly catalog: KitCatalog;
  readonly name: string;
  readonly version: string;
  readonly allowedCount: number;
  readonly catalogCount: number;
}

/** The kit page's data for the example brand, built once per build. */
export async function loadKitPage(): Promise<KitPageData> {
  const [document, brands] = await Promise.all([brandDocument(KIT_BRAND), loadBrands()]);
  const brand = brands.find((b) => b.id === KIT_BRAND);
  if (!brand) throw new Error(`The example brand ${KIT_BRAND} is missing`);
  const raw = Object.values(CATALOG_RAW)[0];
  if (!raw) throw new Error('packages/spec/catalog/components.json is missing');
  const catalog = JSON.parse(raw) as KitCatalog;
  const manifest = (
    brand.compiled as {
      allowManifest?: { allow?: KitAllowManifest['allow']; contentHash?: string };
    }
  ).allowManifest;
  const allowSection = manifest?.allow;
  const allow: KitAllowManifest = {
    version: brand.version,
    ...(manifest?.contentHash ? { contentHash: manifest.contentHash } : {}),
    ...(allowSection ? { allow: allowSection } : {}),
  };
  const allowed = new Set(Object.keys(allowSection ?? {}));
  const { vars, modes, fontFaces, assets, accessibility, report, id, name, version } =
    brand.compiled;
  return {
    document,
    compiled: { id, name, version, modes, vars, fontFaces, assets, accessibility, report },
    allow,
    catalog: trimCatalog(catalog, allowed),
    name: brand.name,
    version: brand.version,
    allowedCount: allowed.size,
    catalogCount: catalog.components.length,
  };
}
