/**
 * Re-export shared path containment (implementation lives in `../internal/paths.ts`).
 */
export {
  assertNoSymlinkOnPath,
  assertSourceFileInside,
  escapesRoot,
  resolveContainedOutDir,
  resolveContainedSourceDir,
  validateRegistryEntry,
} from '../internal/paths.ts';
