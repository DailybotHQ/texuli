/**
 * URL policy for every link a Texuli component renders.
 *
 * Two trust tiers:
 * - `developer`: props written by the app's own developers. Every scheme is
 *   allowed except the ones that execute or smuggle content: `javascript:`,
 *   `vbscript:`, `data:` and protocol-relative `//host` URLs.
 * - `untrusted`: content an agent or a user produced. Only `https:`,
 *   `mailto:` and same-document `#fragment` links pass, and additionally:
 *   - no invisible formatting characters anywhere (zero-width, bidi
 *     overrides and isolates, BOM, soft hyphen): they make a link read
 *     differently from where it goes;
 *   - `https:` links use the authority form (`https://host`) and parse to a
 *     host, so `https:evil.example` is refused;
 *   - no credentials before the host (`https://bank.example@evil.example`
 *     shows a trusted name while it opens another origin).
 *
 * Any trust value other than the exact string `'developer'` is treated as
 * `untrusted` (`resolveTrust`). A rejected value returns `undefined`, so the
 * caller renders inert text.
 */
import { resolveTrust } from '../url-policy/trust.ts';

export type HrefTrust = 'developer' | 'untrusted';

const BLOCKED_SCHEMES = new Set(['javascript:', 'vbscript:', 'data:']);
const UNTRUSTED_SCHEMES = new Set(['https:', 'mailto:']);

/**
 * Whether `value` holds an invisible formatting character: soft hyphen,
 * zero-width space and joiners, left-to-right and right-to-left marks,
 * bidi embeddings, overrides and isolates, word joiner and invisible
 * operators, or a byte-order mark. Checked by code point.
 */
export function hasInvisibleFormatting(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (
      code === 0x00ad ||
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2060 && code <= 0x2064) ||
      (code >= 0x2066 && code <= 0x2069) ||
      code === 0xfeff
    ) {
      return true;
    }
  }
  return false;
}

/** An untrusted https link: authority form, a real host, no credentials. */
function isPlainHttpsLink(href: string): boolean {
  if (!/^https:\/\//i.test(href)) return false;
  try {
    const url = new URL(href);
    return (
      url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === ''
    );
  } catch {
    return false;
  }
}

export function safeHref(value: unknown, requested: HrefTrust = 'untrusted'): string | undefined {
  const trust = resolveTrust(requested);
  if (typeof value !== 'string') return undefined;
  // Browsers drop ASCII whitespace and control characters inside a scheme.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are the target
  const href = value.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (href === '') return undefined;
  if (trust === 'untrusted' && hasInvisibleFormatting(href)) return undefined;
  if (href.startsWith('#')) return href;
  if (href.startsWith('//') || href.startsWith('\\')) return undefined;

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]?.toLowerCase();
  if (trust === 'untrusted') {
    if (!scheme || !UNTRUSTED_SCHEMES.has(`${scheme}:`)) return undefined;
    return scheme === 'https' && !isPlainHttpsLink(href) ? undefined : href;
  }
  if (scheme && BLOCKED_SCHEMES.has(`${scheme}:`)) return undefined;
  return href;
}
