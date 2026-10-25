/**
 * True when `node` sits under a page `<main>` (previews, example frames).
 * Nested layouts must use a plain `div` so the page keeps one main landmark.
 */
export function isNestedInMain(node: HTMLElement | null | undefined): boolean {
  if (!node) return false;
  try {
    return Boolean(node.parentElement?.closest('main'));
  } catch {
    return false;
  }
}
