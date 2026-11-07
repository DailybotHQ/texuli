/**
 * Whether closing a non-modal overlay may move focus back to its trigger.
 *
 * Only when focus is lost (nothing focused, or `body`) or stranded inside the
 * closing `content`. Focus already on a live element elsewhere stays there:
 * the user (or the app) moved it, for example into another overlay opened in
 * the same handler, and pulling it back to the trigger would dismiss that
 * overlay on focus outside. `trigger` supplies the document when the content
 * is gone.
 */
export function focusNeedsReturn(
  content: Element | null | undefined,
  trigger?: Element | null
): boolean {
  const ownerDocument = (content ?? trigger)?.ownerDocument;
  const active = ownerDocument?.activeElement;
  return !active || active === ownerDocument.body || !!content?.contains(active);
}
