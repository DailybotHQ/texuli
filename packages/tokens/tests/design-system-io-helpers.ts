/** Helpers shared by the T-ds-io tests (not a test file). */

/** The distinct tag names of an HTML string, sorted. */
export const tags = (html: string) =>
  [
    ...new Set([...html.matchAll(/<\/?([a-z0-9!]+)/gi)].map((m) => (m[1] as string).toLowerCase())),
  ].sort();
/** Every tag the report may write. */
export const REPORT_TAGS = [
  '!doctype',
  'body',
  'button',
  'code',
  'dd',
  'div',
  'dl',
  'dt',
  'h1',
  'h2',
  'h3',
  'head',
  'html',
  'input',
  'li',
  'main',
  'meta',
  'p',
  'section',
  'span',
  'style',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'title',
  'tr',
  'ul',
];
