/**
 * Every visible or announced string the diagram family writes that does not
 * come from the block. Hosts pass translations (or set them once through
 * the label dictionary in context, ids `blocks.diagram.<key>`); English is
 * the default. Counts have a `…One` and a `…Other` form; `{count}`,
 * `{index}`, `{total}`, `{label}`, `{title}`, `{columns}` and `{cards}`
 * are filled at render time (plain text, never markup).
 */
export interface DiagramBlockLabels {
  invalid: string;
  unsupported: string;
  flowSummaryOne: string;
  flowSummaryOther: string;
  flowLoopBack: string;
  flowStep: string;
  flowBack: string;
  orgSummaryOne: string;
  orgSummaryOther: string;
  fileTreeSummaryOne: string;
  fileTreeSummaryOther: string;
  boardSummary: string;
  boardColumnsOne: string;
  boardColumnsOther: string;
  boardCardsOne: string;
  boardCardsOther: string;
  boardColumn: string;
  boardEmpty: string;
  terminalSummaryOne: string;
  terminalSummaryOther: string;
  terminalCommand: string;
}

export const DEFAULT_DIAGRAM_BLOCK_LABELS: Readonly<DiagramBlockLabels> =
  /* @__PURE__ */ Object.freeze({
    invalid: 'This diagram could not be shown. The data failed validation.',
    unsupported: 'This block renderer is not available yet.',
    flowSummaryOne: 'Flow with {count} step',
    flowSummaryOther: 'Flow with {count} steps',
    flowLoopBack: ', repeating from the last step to the first',
    flowStep: 'Step {index} of {total}: {label}',
    flowBack: 'Then back to step 1: {label}',
    orgSummaryOne: 'Organization chart with {count} item',
    orgSummaryOther: 'Organization chart with {count} items',
    fileTreeSummaryOne: 'File tree with {count} item',
    fileTreeSummaryOther: 'File tree with {count} items',
    boardSummary: 'Board with {columns} and {cards}',
    boardColumnsOne: '{count} column',
    boardColumnsOther: '{count} columns',
    boardCardsOne: '{count} card',
    boardCardsOther: '{count} cards',
    boardColumn: '{title}, {cards}',
    boardEmpty: 'No cards',
    terminalSummaryOne: 'Terminal session, {count} command',
    terminalSummaryOther: 'Terminal session, {count} commands',
    terminalCommand: 'Command:',
  });

export type DiagramBlockLabelOverrides = Partial<DiagramBlockLabels>;

/** Merges host overrides over the defaults; non-string overrides are ignored. */
export function resolveDiagramBlockLabels(
  overrides: DiagramBlockLabelOverrides = {},
  defaults: Readonly<DiagramBlockLabels> = DEFAULT_DIAGRAM_BLOCK_LABELS
): DiagramBlockLabels {
  const labels = { ...defaults };
  for (const key of Object.keys(labels) as (keyof DiagramBlockLabels)[]) {
    const value = overrides[key];
    if (typeof value === 'string') labels[key] = value;
  }
  return labels;
}

/** Fill `{name}` placeholders (unknown names stay as written). */
export function fillDiagramLabel(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  );
}

/** The one or other form of a counted label, filled with `count` and `values`. */
export function countLabel(
  one: string,
  other: string,
  count: number,
  values: Record<string, string | number> = {}
): string {
  return fillDiagramLabel(count === 1 ? one : other, { ...values, count });
}
