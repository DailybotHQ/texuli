import type { EditValidation } from '../edit/types.ts';
import type { CatalogTreeInput } from '../render/renderer/types.ts';
import { type ValidateDraftOptions, validateDraft } from './draft.ts';

/**
 * A commit gate for `createEditHistory` that runs the full
 * {@link validateDraft} on every edit result, so an edit that would leave
 * the draft invalid is never committed:
 *
 * ```ts
 * createEditHistory(tree, { validate: draftCommitGate({ catalog }) });
 * ```
 *
 * The history's default gate stays the tree limits; hosts opt in here.
 */
export function draftCommitGate(
  options: ValidateDraftOptions
): (tree: CatalogTreeInput) => EditValidation {
  return (tree) => {
    const result = validateDraft(tree, options);
    return { ok: result.ok, diagnostics: result.diagnostics };
  };
}
