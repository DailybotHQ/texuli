/**
 * Host catalog extensions for the design-system checks (ADR-032): the Texuli catalog with a
 * host's extension manifests (`texuli/catalog-extension`, ids `<ns>:<id>`) merged in by
 * `mergeCatalogs` from `@texuli/spec`, the same merge a host runs before its own
 * `checkDesignSystemAllow`. An `allow` section that enables `acme:kpi-strip` then passes
 * `texuli ds check --extensions acme.json` as it passes the host's validation.
 *
 * Extensions are untrusted input: `mergeCatalogs` bounds them, refuses a bad one whole with a
 * stable code (`extension-format`, `extension-namespace`, …) and never executes anything.
 * Edge-safe: no file system.
 */
import type { SpecCatalog } from '@texuli/spec';
import { type MergedCatalog, mergeCatalogs } from '@texuli/spec/catalog-extensions';
import { loadSpecCatalog } from '../ops/catalog.ts';
import type { DsCheckIssue } from './types.ts';

export interface LoadMergedCatalogOptions {
  /** The catalog to merge into. Default: the agent catalog `@texuli/tools` builds. */
  readonly catalog?: SpecCatalog;
}

/**
 * The Texuli catalog (or `options.catalog`) with `extensions` merged in. A refused extension
 * is left out whole and listed in `issues` with its code; `ok` is false when any was refused.
 * Never throws on JSON values.
 */
export async function loadMergedCatalog(
  extensions: readonly unknown[],
  options: LoadMergedCatalogOptions = {}
): Promise<MergedCatalog> {
  return mergeCatalogs(options.catalog ?? (await loadSpecCatalog()), extensions);
}

/** Stable code of a refused extension on a `ds check` report; the merge's own code leads the message. */
export const DS_CATALOG_EXTENSION_CODE = 'catalog-extension';

/**
 * The merge refusals as `ds check` issues: code `catalog-extension` (as on the full report),
 * the merge's code (`extension-namespace`, …) first in the message, and `source` naming the
 * file when `files` lists the extension files in order.
 */
export function catalogExtensionIssues(
  merged: Pick<MergedCatalog, 'issues'>,
  files: readonly string[] = []
): DsCheckIssue[] {
  return merged.issues.map((issue) => {
    const index = /^extensions\[(\d+)\]/.exec(issue.path)?.[1];
    const file = index === undefined ? undefined : files[Number(index)];
    return {
      code: DS_CATALOG_EXTENSION_CODE,
      path: issue.path,
      message: `${issue.code}: ${issue.message}`,
      hint: 'Fix the extension; an extension with a refused component is left out whole.',
      ...(file ? { source: file } : {}),
    };
  });
}
