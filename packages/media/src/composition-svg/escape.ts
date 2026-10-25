/** Escape text for XML/SVG text nodes and attribute values. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Keep only safe attribute names (no injection via attr keys). */
export function isSafeAttrName(name: string): boolean {
  return /^[A-Za-z_:][\w:.-]*$/.test(name);
}
