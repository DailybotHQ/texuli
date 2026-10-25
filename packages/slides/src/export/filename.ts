const MAX_FILENAME_STEM = 80;

/** Sanitized download name from the deck title, e.g. `Quarterly update.pdf`. */
export function deckExportFilename(title: unknown, extension = 'pdf'): string {
  const ext = /^[a-z0-9]{1,8}$/.test(extension) ? extension : 'pdf';
  const raw = typeof title === 'string' ? title.normalize('NFC') : '';
  const stem = raw
    .replace(new RegExp(`\\.${ext}$`, 'i'), '')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')
    .slice(0, MAX_FILENAME_STEM)
    .replace(/[\s.-]+$/g, '');
  return `${stem || 'presentation'}.${ext}`;
}
