/**
 * JSON for an inline `<script type="application/ld+json">` block (S-7).
 *
 * `JSON.stringify` leaves `<`, `>` and `&` as-is, so a string holding
 * `</script>` or `<!--` would end or confuse the script element. Each of
 * them, plus U+2028 and U+2029 (line terminators in older JavaScript
 * parsers), is written as its `\uXXXX` escape: still the same JSON value,
 * but no character the HTML tokenizer reacts to. Plain data comes out
 * byte-identical to `JSON.stringify`.
 */
const ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (char) => ESCAPES[char] ?? char);
}
