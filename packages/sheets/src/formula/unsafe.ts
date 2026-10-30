/*
 * Characters text in a sheet may not hold: C0 and C1 controls (tab, line
 * feed and carriage return are allowed in cell text when `lines` is set),
 * DEL, and the bidi embedding, override and isolate controls that can make
 * text read differently from what it is. A code-unit scan (linear, no
 * regular expression with control characters).
 */
export function hasUnsafeCharacters(text: string, lines = false): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x20) {
      if (lines && (code === 0x09 || code === 0x0a || code === 0x0d)) continue;
      return true;
    }
    if (code >= 0x7f && code <= 0x9f) return true;
    if (code === 0x200e || code === 0x200f) return true;
    if (code >= 0x202a && code <= 0x202e) return true;
    if (code >= 0x2066 && code <= 0x2069) return true;
  }
  return false;
}
