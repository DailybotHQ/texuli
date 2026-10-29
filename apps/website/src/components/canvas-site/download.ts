/**
 * Saves a Blob the page made itself (an SVG or PNG export) as a download:
 * a hidden link to the blob: URL it creates, clicked once, then removed and
 * revoked. It never opens any other URL.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** A byte count for people: "812 B" or "3.4 KB". */
export function byteSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
