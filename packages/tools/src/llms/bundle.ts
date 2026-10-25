import type { CatalogEntry } from '@texuli/catalog/build';
import type { CatalogManifest } from '@texuli/catalog/manifest';
import {
  componentDocPath,
  formatComponentMarkdown,
  formatLlmsFullTxt,
  formatLlmsTxt,
} from './format.ts';
import type { LlmsBundle, LlmsBundleOptions, LlmsFile } from './types.ts';

function entriesFromOptions(options: LlmsBundleOptions): (CatalogManifest | CatalogEntry)[] {
  if (options.catalog) {
    return [...options.catalog.entries];
  }
  if (options.manifests) {
    return [...options.manifests];
  }
  throw new Error('LlmsBundleOptions requires either catalog or manifests.');
}

/**
 * Build `llms.txt`, `llms-full.txt` and per-component Markdown from catalog data.
 * Pure: no filesystem.
 */
export function buildLlmsBundle(options: LlmsBundleOptions): LlmsBundle {
  const entries = entriesFromOptions(options);
  const baseUrl = options.baseUrl ?? '';
  const title = options.title ?? 'Texuli';
  const summary =
    options.summary ??
    'Texuli is a Svelte 5 component system with a closed agent catalog and a sink-free renderer.';

  const llmsTxt = formatLlmsTxt(entries, {
    title,
    summary,
    intro: options.intro,
    baseUrl,
    splitTiers: options.splitTiers,
  });
  const llmsFullTxt = formatLlmsFullTxt(entries, { title, baseUrl });

  const components: LlmsFile[] = [...entries]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((entry) => ({
      path: componentDocPath(entry.id),
      body: formatComponentMarkdown(entry, { baseUrl, fromComponents: true }),
    }));

  const files: LlmsFile[] = [
    { path: 'llms.txt', body: llmsTxt },
    { path: 'llms-full.txt', body: llmsFullTxt },
    ...components,
  ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return {
    llmsTxt,
    llmsFullTxt,
    components,
    files,
    entryCount: entries.length,
  };
}
