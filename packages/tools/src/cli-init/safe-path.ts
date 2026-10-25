/// <reference types="node" />
/**
 * Path rules for `texuli init` and `texuli theme`: CLI and config paths must
 * be relative, normalized and inside the project. Writes use the shared
 * containment in `src/internal/paths.ts`.
 */
import { isAbsolute, normalize } from 'node:path';

/** Why `value` is not an acceptable project-relative path, or `null`. */
export function projectPathError(name: string, value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return `${name} must be a non-empty path.`;
  if (value.includes('\0')) return `${name} must not contain NUL.`;
  if (isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\')) {
    return `${name} must be relative to the project root (got absolute: ${value}).`;
  }
  const segments = value.split(/[/\\]/);
  if (segments.some((segment) => segment === '..')) {
    return `${name} must not contain '..' segments (got: ${value}).`;
  }
  const normalized = normalize(value).replace(/\\/g, '/');
  if (normalized !== value.replace(/\\/g, '/') || segments.some((segment) => segment === '.')) {
    return `${name} must be normalized (got: ${value}; use ${normalized}).`;
  }
  return null;
}
