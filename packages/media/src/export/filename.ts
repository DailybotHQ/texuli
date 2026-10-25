export type ExportFormat = 'png' | 'svg' | 'webm';

/** MIME type of each export format. */
export const EXPORT_MIME_TYPES: Readonly<Record<ExportFormat, string>> = Object.freeze({
  png: 'image/png',
  svg: 'image/svg+xml',
  webm: 'video/webm',
});

const MAX_STEM = 80;

/**
 * A safe download name: letters, digits, `.`, `_`, `-` and spaces only (path
 * separators, control, bidi and reserved characters become `-`), no leading
 * dots, at most 80 characters, and always the format's own extension.
 */
export function exportFilename(name: unknown, format: ExportFormat): string {
  const raw = typeof name === 'string' ? name.normalize('NFC') : '';
  const withoutExtension = raw.replace(/\.(?:png|svg|webm)$/i, '');
  const stem = withoutExtension
    .replace(/[^\p{L}\p{N}._ -]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')
    .slice(0, MAX_STEM)
    .replace(/[\s.-]+$/g, '');
  return `${stem || 'composition'}.${format}`;
}
