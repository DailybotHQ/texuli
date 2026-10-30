import type { RenderNode, RenderTier } from '../render/renderer/types.ts';

/**
 * Forms in blueprints (spec 0.8.0, ADR-015). A `schema-form` node carries a
 * closed form schema in its `schema` prop. `validateDraft` checks it with
 * the host's {@link DraftFormCheck} at the draft's tier: `checkFormDraft`
 * from `@texuli/forms/model` (`validateFormSchema`: closed members per field
 * type, unique names, options and defaults, ranges, named formats (never a
 * pattern), help links through the URL policy, and conditions and
 * cross-field rules as typed expressions of the closed language over
 * declared fields). Injected like `checkDocument`, so this module stays
 * free of the forms runtime. Without it a `schema-form` node is refused
 * (`form-unchecked`): a form never passes on structure alone.
 */

/** The catalog id whose `schema` prop holds a form schema. */
export const SCHEMA_FORM_ID = 'schema-form';

/** One issue the host's form validator reports. */
export interface DraftFormIssue {
  code: string;
  /** Where in the schema (a JSON path from `$`). */
  path: string;
  message: string;
}

/**
 * The host's form validator: `checkFormDraft` from `@texuli/forms/model`
 * (`validateFormSchema` at the given tier). `validators` are the names the
 * host registered (`ValidateDraftOptions.formValidators`).
 */
export type DraftFormCheck = (
  schema: unknown,
  tier: RenderTier,
  validators?: readonly string[]
) => { ok: boolean; issues: readonly DraftFormIssue[] };

/** A finding of the form check, reported by `validateDraft` under `forms`. */
export interface FormFinding {
  code: 'form-unchecked' | 'form-schema';
  /** The node path, then the JSON path inside the schema. */
  path: string;
  message: string;
}

export interface FormCheckOptions {
  tier: RenderTier;
  checkForm?: DraftFormCheck;
  /** The validator names the host registered. */
  validators?: readonly string[];
}

/** Issues reported per form, so a hostile schema cannot flood the receipt. */
export const MAX_FORM_FINDINGS = 50;

/** Every `schema-form` node of a render tree with its path, in document order. */
export function schemaFormNodes(
  roots: readonly RenderNode[]
): { node: Extract<RenderNode, { kind: 'component' }>; path: string }[] {
  const out: { node: Extract<RenderNode, { kind: 'component' }>; path: string }[] = [];
  const stack: { node: RenderNode; path: string }[] = roots
    .map((node, index) => ({ node, path: String(index) }))
    .reverse();
  while (stack.length > 0) {
    const { node, path } = stack.pop() as { node: RenderNode; path: string };
    if (node.kind !== 'component') continue;
    if (node.id === SCHEMA_FORM_ID) out.push({ node, path });
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push({ node: node.children[i] as RenderNode, path: `${path}.children.${i}` });
    }
  }
  return out;
}

/**
 * Check every `schema-form` node's schema at the tier. Pure; never throws
 * (a throwing host check is reported as `form-schema`).
 */
export function checkForms(roots: readonly RenderNode[], options: FormCheckOptions): FormFinding[] {
  const findings: FormFinding[] = [];
  for (const { node, path } of schemaFormNodes(roots)) {
    const at = `${path}.props.schema`;
    if (!options.checkForm) {
      findings.push({
        code: 'form-unchecked',
        path: at,
        message:
          'A schema-form node needs the host form validator (checkForm); it is refused without it.',
      });
      continue;
    }
    let result: ReturnType<DraftFormCheck>;
    try {
      result = options.checkForm(node.props.schema, options.tier, options.validators);
    } catch (cause) {
      findings.push({
        code: 'form-schema',
        path: at,
        message: `The form validator failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
      continue;
    }
    if (result.ok) continue;
    const issues =
      result.issues.length > 0
        ? result.issues
        : [{ code: 'form', path: '$', message: 'The form validator refused the schema.' }];
    for (const issue of issues.slice(0, MAX_FORM_FINDINGS)) {
      const inner =
        typeof issue.path === 'string' && issue.path.startsWith('$') ? issue.path.slice(1) : '';
      findings.push({
        code: 'form-schema',
        path: `${at}${inner}`,
        message: `${String(issue.code).slice(0, 64)}: ${String(issue.message).slice(0, 300)}`,
      });
    }
  }
  return findings;
}
