import type { ArtifactFrame } from '../frame/types.ts';
import type { LimitedRenderResult } from '../limits/types.ts';
import type { RenderCatalog, RenderResult } from '../renderer/types.ts';
import type { RichTextResult } from '../richtext/types.ts';

/** Categories of hostile input the corpus exercises. */
export type HostileCategory =
  | 'script-url'
  | 'fake-dialog'
  | 'bidi'
  | 'giant-tree'
  | 'prompt-injection'
  | 'html-string'
  | 'style-class'
  | 'unknown-id'
  | 'deep-nesting'
  | 'unicode'
  | 'prototype'
  | 'oversized'
  | 'duplicate-key'
  | 'url-trick';

/** One hostile sample (tree and/or richtext). */
export interface HostileSample {
  /** Stable id (`kebab-case`). */
  id: string;
  category: HostileCategory;
  /** Short description for docs and e2e labels. */
  title: string;
  /** Untrusted catalog tree (optional when only richtext is hostile). */
  tree?: unknown;
  /** Untrusted Markdown / plain text for the richtext path. */
  richtext?: string;
  /**
   * Raw JSON text for shapes a JS object cannot hold: own `__proto__` keys,
   * duplicate keys. Parsed with `JSON.parse` (last duplicate wins) and run
   * through the tree path.
   */
  text?: string;
  /**
   * What the sink-free pipeline must guarantee.
   * Defaults: no javascript: hrefs, no script nodes, no style/class passthrough.
   */
  expect?: {
    /** Tree roots must be empty after limits/render. */
    emptyRoots?: boolean;
    /** At least one placeholder root. */
    hasPlaceholder?: boolean;
    /** Limits must reject the tree. */
    limitsReject?: boolean;
    /** Frame label must scrub bidi/controls. */
    scrubbedLabel?: boolean;
  };
}

/** Result of running one sample through the pipeline. */
export interface HostileRunResult {
  sample: HostileSample;
  /** True when every inertness check passed. */
  inert: boolean;
  failures: readonly string[];
  limits?: LimitedRenderResult;
  render?: RenderResult;
  frame?: ArtifactFrame;
  richtext?: RichTextResult;
}

export interface HostileCorpusOptions {
  catalog: RenderCatalog;
  /** Default untrusted. */
  tier?: 'developer' | 'untrusted';
  /** Optional subset of sample ids. */
  only?: readonly string[];
}

export interface HostileCorpusReport {
  results: readonly HostileRunResult[];
  /** All samples rendered inert. */
  ok: boolean;
  failureCount: number;
}
