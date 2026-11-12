/** Hand-built `texuli-md/v1` trees for the markdown-html and html tests (until T-md-core lands). */
import type { MdBlock, MdInline, MdListItem, MdRoot } from '../../src/markdown/ast.ts';
import { HTML_ELEMENTS } from '../../src/markup/index.ts';

export const root = (...children: MdBlock[]): MdRoot => ({
  type: 'root',
  version: 'texuli-md/v1',
  children,
});
export const t = (value: string): MdInline => ({ type: 'text', value });
export const p = (...children: MdInline[]): MdBlock => ({ type: 'paragraph', children });
export const item = (children: MdBlock[], checked?: boolean, spread = false): MdListItem =>
  checked === undefined
    ? { type: 'listItem', spread, children }
    : { type: 'listItem', spread, checked, children };

const TAG = /<\/?([A-Za-z][^\s/>]*)([^>]*)>/g;

/**
 * Check a writer's output against the allowlist: every tag is an `HTML_ELEMENTS` name, no
 * attribute is an event handler or `style`/`srcdoc`, and no URL attribute holds a refused scheme.
 * Returns the problems found (empty when the HTML is clean).
 */
export function unsafeParts(
  html: string,
  trust: 'developer' | 'untrusted' = 'untrusted'
): string[] {
  const problems: string[] = [];
  for (const match of html.matchAll(TAG)) {
    const name = (match[1] ?? '').toLowerCase();
    if (!HTML_ELEMENTS.has(name)) problems.push(`element ${name}`);
    const attributes = match[2] ?? '';
    for (const attribute of attributes.matchAll(/\s([^\s="'>/]+)(?:="([^"]*)")?/g)) {
      const key = (attribute[1] ?? '').toLowerCase();
      const value = (attribute[2] ?? '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
      if (key.startsWith('on')) problems.push(`handler ${key}`);
      if (key === 'style' || key === 'srcdoc' || key === 'srcset' || key === 'formaction')
        problems.push(`attribute ${key}`);
      if (key === 'href' || key === 'src') {
        // biome-ignore lint/suspicious/noControlCharactersInRegex: browsers strip these in URLs.
        const compact = value.replace(/[\u0000- \u007f]/g, '').toLowerCase();
        if (/^(?:javascript|vbscript):/.test(compact)) problems.push(`${key} ${value}`);
        if (/^data:/.test(compact) && (key === 'href' || trust === 'untrusted'))
          problems.push(`${key} ${value}`);
        if (/^(?:\/\/|\\)/.test(compact)) problems.push(`${key} ${value}`);
      }
    }
  }
  return problems;
}
