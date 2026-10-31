import type { RenderTier } from '../render/renderer/types.ts';

/**
 * The envelope's design system (spec 0.10.0, ADR-024): `{ ref }` or
 * `{ inline }`. `validateDraft` always checks the reference's shape and the
 * `ref` grammar here (a few bytes, no vocabulary). An inline document is
 * checked by the host's {@link DraftDesignSystemCheck}, usually
 * `checkDesignSystemReference` from `@texuli/spec/design-system` passed as
 * is, at the draft's tier; without one the inline document's own rules are
 * `skipped` in the receipt, and the players validate and compile it before
 * anything reaches CSS (a refused document paints with the default theme).
 */

/** An exact `id@x.y.z` or `texuli:<theme>`: never a range, a URL or a path. */
export const DESIGN_SYSTEM_REF =
  /^(?:texuli:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|[a-z][a-z0-9]*(?:-[a-z0-9]+)*@(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/;

/** One issue, with a design-system code and a JSON path from the reference (`$`). */
export interface DraftDesignSystemIssue {
  code: string;
  path: string;
  message: string;
  hint?: string;
}

/**
 * The host's design-system check: `checkDesignSystemReference` from
 * `@texuli/spec/design-system` fits as is. A host with `@texuli/tokens`
 * can also compile an inline document (`compileDesignSystem`) to add the
 * guarantee codes (`aa-text`, `aa-focus`, `target-size`).
 */
export type DraftDesignSystemCheck = (
  reference: unknown,
  options: { trust: RenderTier }
) => { ok: boolean; errors: readonly DraftDesignSystemIssue[] };

/**
 * Check `designSystem` (the envelope value): issues with paths under
 * `$.designSystem`, and whether the inline document's own rules ran.
 */
export function checkDraftDesignSystem(
  value: unknown,
  tier: RenderTier,
  check?: DraftDesignSystemCheck
): { issues: DraftDesignSystemIssue[]; checked: boolean } {
  const issues: DraftDesignSystemIssue[] = [];
  const at = (code: string, path: string, message: string, hint?: string) =>
    issues.push({
      code,
      path: `$.designSystem${path.slice(1)}`,
      message,
      ...(hint ? { hint } : {}),
    });
  const object = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);
  if (check) {
    for (const i of check(value, { trust: tier }).errors.slice(0, 64))
      at(i.code, i.path, i.message, i.hint);
    return { issues, checked: true };
  }
  if (!object(value)) {
    at('invalid-type', '$', 'Expected { ref } or { inline }.');
    return { issues, checked: false };
  }
  for (const key of Object.keys(value))
    if (key !== 'ref' && key !== 'inline') at('unknown-key', `$.${key}`, 'Allowed: ref, inline.');
  const hasRef = Object.hasOwn(value, 'ref');
  if (hasRef === Object.hasOwn(value, 'inline'))
    at(hasRef ? 'invalid-value' : 'required', '$', 'Set exactly one of ref and inline.');
  else if (hasRef && !(typeof value.ref === 'string' && DESIGN_SYSTEM_REF.test(value.ref)))
    at('invalid-value', '$.ref', 'Not an exact id@x.y.z or texuli:<theme>.');
  else if (!hasRef && !object(value.inline)) at('invalid-type', '$.inline', 'Not an object.');
  return { issues, checked: hasRef };
}
