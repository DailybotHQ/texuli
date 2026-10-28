/**
 * The few strings layouts add for assistive tech (comparison cells and the
 * chart data table). English defaults for now: they belong in the stage
 * message catalog (`DECK_STAGE_MESSAGES`) so hosts can localize them, which
 * is a change to `src/stage/**` for the lead to make.
 */
export const DECK_LAYOUT_MESSAGES = Object.freeze({
  'layout.yes': 'Yes',
  'layout.no': 'No',
  'layout.empty': 'Not applicable',
  'layout.chartTable': 'Data for {title}',
  'layout.chartInvalid': 'This chart could not be shown: its data does not match the chart kind.',
  'layout.video': 'Video',
} as const);

export type DeckLayoutMessageKey = keyof typeof DECK_LAYOUT_MESSAGES;

/** Resolve a layout string with `{name}` values. */
export function layoutMessage(
  key: DeckLayoutMessageKey,
  values: Readonly<Record<string, string>> = {}
): string {
  return DECK_LAYOUT_MESSAGES[key].replace(/\{([a-zA-Z]+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? (values[name] as string) : match
  );
}
