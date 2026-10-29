/**
 * The stage landmark's name before the deck has validated. During SSR and
 * while the lazy defaults load, the stage is a `region` already; naming it
 * from the raw input's title (`meta.title`, or a Protoyard `outline.title`)
 * keeps several stages on one page distinct, and a stage whose input names
 * no title stays unnamed (an unnamed `region` is not a landmark) instead of
 * repeating the same "Presentation: " name. Reading never throws.
 */
const MAX_TITLE = 200;

function titleOf(bag: unknown): string | undefined {
  if (bag === null || typeof bag !== 'object' || Array.isArray(bag)) return undefined;
  const title = (bag as { title?: unknown }).title;
  if (typeof title !== 'string') return undefined;
  const trimmed = title.trim();
  return trimmed === '' ? undefined : trimmed.slice(0, MAX_TITLE);
}

/** The title a deck input names, before validation; `undefined` when it names none. */
export function deckInputTitle(input: unknown): string | undefined {
  try {
    if (input === null || typeof input !== 'object') return undefined;
    const bag = input as { meta?: unknown; outline?: unknown };
    return titleOf(bag.meta) ?? titleOf(bag.outline);
  } catch {
    return undefined;
  }
}
