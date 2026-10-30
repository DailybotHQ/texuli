import type { RenderNode, RenderTier } from '../render/renderer/types.ts';

/**
 * Sheets in blueprints (spec 0.8.0, ADR-012, ADR-015). A `spreadsheet`
 * node carries a Texuli sheet in its `sheet` prop. `validateDraft` checks it
 * with the host's {@link DraftSheetCheck} (`checkSheetDraft` from
 * `@texuli/sheets/model`, which runs `validateSheet`: closed members, the
 * caps, text safety and every formula through the sheet grammar, so agent
 * formulas are validated at draft time), injected like `checkCanvas` so this
 * module stays free of the formula engine. Without it a `spreadsheet` node is
 * refused (`sheet-unchecked`): a sheet never passes on structure alone.
 */

/**
 * The catalog id whose `sheet` prop holds a Texuli sheet (not `sheet`, which
 * is the texuli `Sheet` overlay).
 */
export const SPREADSHEET_ID = 'spreadsheet';

/** One issue the host's sheet validator reports. */
export interface DraftSheetIssue {
  code: string;
  /** Where in the sheet (a JSON path). */
  path: string;
  message: string;
  severity?: 'error' | 'warning';
}

/** The host's sheet validator: `checkSheetDraft` from `@texuli/sheets/model`. */
export type DraftSheetCheck = (
  sheet: unknown,
  tier: RenderTier
) => { ok: boolean; sheet?: unknown; issues: readonly DraftSheetIssue[] };

/** A finding of the sheet check, reported by `validateDraft` under `sheets`. */
export interface SheetFinding {
  code: 'sheet-unchecked' | 'sheet-schema';
  path: string;
  message: string;
}

/** Issues reported per sheet, so a hostile sheet cannot flood the receipt. */
export const MAX_SHEET_FINDINGS = 20;

/** Every `spreadsheet` node in a render tree with its node path. */
export function sheetNodes(
  roots: readonly RenderNode[]
): { node: Extract<RenderNode, { kind: 'component' }>; path: string }[] {
  const out: { node: Extract<RenderNode, { kind: 'component' }>; path: string }[] = [];
  const stack: { node: RenderNode; path: string }[] = roots
    .map((node, index) => ({ node, path: String(index) }))
    .reverse();
  while (stack.length > 0) {
    const { node, path } = stack.pop() as { node: RenderNode; path: string };
    if (node.kind !== 'component') continue;
    if (node.id === SPREADSHEET_ID) out.push({ node, path });
    for (let i = node.children.length - 1; i >= 0; i -= 1)
      stack.push({ node: node.children[i] as RenderNode, path: `${path}.children.${i}` });
  }
  return out;
}

/**
 * Check every `spreadsheet` node of a validated render tree at the tier. Pure;
 * never throws (a throwing host check is reported as `sheet-schema`).
 */
export function checkSheets(
  roots: readonly RenderNode[],
  options: { tier: RenderTier; checkSheet?: DraftSheetCheck }
): SheetFinding[] {
  const findings: SheetFinding[] = [];
  for (const { node, path } of sheetNodes(roots)) {
    const out: SheetFinding[] = [];
    const add = (finding: SheetFinding) => {
      if (out.length < MAX_SHEET_FINDINGS) out.push(finding);
    };
    if (!options.checkSheet) {
      add({
        code: 'sheet-unchecked',
        path,
        message:
          'A spreadsheet node needs the host sheet validator (checkSheet); it is refused without it.',
      });
    } else {
      try {
        const result = options.checkSheet(node.props.sheet, options.tier);
        for (const issue of result.issues.filter((issue) => issue.severity !== 'warning'))
          add({
            code: 'sheet-schema',
            path,
            message: `sheet ${issue.path}: ${issue.code}: ${issue.message}`,
          });
        if (!result.ok && out.length === 0)
          add({ code: 'sheet-schema', path, message: 'The sheet is invalid.' });
      } catch (cause) {
        add({
          code: 'sheet-schema',
          path,
          message: `The sheet validator failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        });
      }
    }
    findings.push(...out);
  }
  return findings;
}
