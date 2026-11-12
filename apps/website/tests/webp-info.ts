/** Canvas size and alpha flag of an extended (VP8X) WebP, the shape every shipped slot file has. */
export function webpInfo(
  bytes: Uint8Array
): { width: number; height: number; alpha: boolean } | null {
  const text = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.length < 30 || text(0) !== 'RIFF' || text(8) !== 'WEBP' || text(12) !== 'VP8X')
    return null;
  const u24 = (at: number) => bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16);
  return { width: u24(24) + 1, height: u24(27) + 1, alpha: (bytes[20]! & 0x10) !== 0 };
}
