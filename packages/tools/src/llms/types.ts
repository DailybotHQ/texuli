import type { Catalog, CatalogEntry } from '@texuli/catalog/build';
import type { CatalogManifest } from '@texuli/catalog/manifest';

/** One file in the agent docs bundle. */
export interface LlmsFile {
  /** Path relative to the output root, always POSIX (`llms.txt`, `components/card.md`). */
  path: string;
  /** UTF-8 text body (no BOM). */
  body: string;
}

/** Options for building the llms.txt / agent-docs bundle from manifests. */
export interface LlmsBundleOptions {
  /**
   * Built catalog (preferred) or a plain list of manifests.
   * When manifests are passed, they are treated as developer-tier entries.
   */
  catalog?: Catalog;
  manifests?: readonly CatalogManifest[];
  /** Site / docs base URL for links (no trailing slash). Default empty (relative). */
  baseUrl?: string;
  /** Project title in llms.txt. Default `Texuli`. */
  title?: string;
  /** One-line project blurb. */
  summary?: string;
  /** Optional extra intro paragraphs under the title. */
  intro?: readonly string[];
  /**
   * When true, only `agentEmittable` components appear in the untrusted
   * section of llms.txt. Default true.
   */
  splitTiers?: boolean;
}

/** Full in-memory bundle. */
export interface LlmsBundle {
  /** Compact index (`llms.txt`). */
  llmsTxt: string;
  /** Full concatenated docs (`llms-full.txt`). */
  llmsFullTxt: string;
  /** Per-component Markdown files. */
  components: readonly LlmsFile[];
  /** Every file including the two roots, sorted by path. */
  files: readonly LlmsFile[];
  /** Entry count used to build the bundle. */
  entryCount: number;
}

export type { Catalog, CatalogEntry, CatalogManifest };

/** Write result when persisting the bundle. */
export interface LlmsWriteResult {
  outDir: string;
  written: readonly string[];
  dryRun: boolean;
}
