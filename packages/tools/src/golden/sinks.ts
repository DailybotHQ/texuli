import { scanSinks } from '@texuli/catalog/validate';

/**
 * Sink checks on the raw model output, before the renderer cleans it: a tree
 * that tries an HTML string, a script URL or a style is penalized even though
 * the sink-free renderer would have made it inert. The scan is the shared
 * `scanSinks` that `validateDraft` runs.
 */

/** Every sink-like value in an untrusted tree (any shape), with its path. */
export function checkSinks(tree: unknown): string[] {
  return scanSinks(tree).map((finding) => `${finding.path}: ${finding.message}`);
}
