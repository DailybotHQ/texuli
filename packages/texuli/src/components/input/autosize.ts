/**
 * Resize a textarea to fit its content. Uses scrollHeight; no layout library.
 * Call after value changes and on mount. Pass the element explicitly (SSR-safe).
 */
export function autosizeTextarea(element: HTMLTextAreaElement | null | undefined): void {
  if (!element) return;
  element.style.blockSize = 'auto';
  element.style.blockSize = `${element.scrollHeight}px`;
}
