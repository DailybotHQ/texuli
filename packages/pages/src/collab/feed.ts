/**
 * The keyboard of the WAI-ARIA APG feed pattern for the comment and
 * suggestion lists: Page Down and Page Up move focus to the next and the
 * previous article, Control+End and Control+Home move it to the first
 * focusable element after and before the feed.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** The feed's articles (its direct children). */
export function feedArticles(feed: HTMLElement): HTMLElement[] {
  return [...feed.children].filter((child): child is HTMLElement => child.localName === 'article');
}

function outside(feed: HTMLElement, direction: -1 | 1): HTMLElement | null {
  const all = [...feed.ownerDocument.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !feed.contains(element) && !element.closest('[hidden],[inert]')
  );
  if (direction > 0)
    return all.find((element) => (feed.compareDocumentPosition(element) & 4) !== 0) ?? null;
  return all.reverse().find((element) => (feed.compareDocumentPosition(element) & 2) !== 0) ?? null;
}

/** Handle a keydown inside a feed; returns true when it moved focus. */
export function feedKeydown(event: KeyboardEvent, feed: HTMLElement): boolean {
  const articles = feedArticles(feed);
  const current = (event.target as Element | null)?.closest?.('article') as HTMLElement | null;
  const index = current ? articles.indexOf(current) : -1;
  let target: HTMLElement | null | undefined = null;
  if (event.key === 'PageDown') target = articles[Math.min(articles.length - 1, index + 1)];
  else if (event.key === 'PageUp') target = articles[Math.max(0, index - 1)];
  else if ((event.ctrlKey || event.metaKey) && event.key === 'End') target = outside(feed, 1);
  else if ((event.ctrlKey || event.metaKey) && event.key === 'Home') target = outside(feed, -1);
  else return false;
  event.preventDefault();
  target?.focus();
  return Boolean(target);
}
