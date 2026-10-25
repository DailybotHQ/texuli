/**
 * Deterministic initials and palette slot for avatar fallbacks.
 * Stable across sessions so colors never shuffle for the same name.
 */

/** FNV-1a style hash; unsigned 32-bit. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** One or two uppercase letters from a display name; `?` when empty. */
export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Palette slot 0–4 derived from the name. */
export function avatarToneIndex(name: string, toneCount = 5): number {
  const count = Math.max(1, toneCount | 0);
  return hashString(name) % count;
}
