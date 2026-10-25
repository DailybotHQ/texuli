/**
 * Saves a blob as a file through a temporary `<a download>`: no network
 * request, no navigation. The object URL is revoked right after the click.
 * Returns `false` when the platform cannot create object URLs or links.
 */
export function downloadBlob(blob: Blob, filename: string, documentRef?: Document): boolean {
  const doc = documentRef ?? (typeof document === 'undefined' ? undefined : document);
  const urls = doc?.defaultView?.URL ?? (typeof URL === 'undefined' ? undefined : URL);
  if (!doc?.body || typeof urls?.createObjectURL !== 'function') return false;
  const url = urls.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.hidden = true;
  doc.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Revoke after the click has been handed to the browser's download manager.
    setTimeout(() => urls.revokeObjectURL(url), 0);
  }
  return true;
}
