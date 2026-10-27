/**
 * Copy-to-clipboard for the landing's install command (PLAN_006 T-43). The
 * same seam CopyPage.astro rides: copy the text held in the host's
 * `<template data-copy-command-text>`, report through the host's
 * `role="status"` region, and fire the analytics `code_copy` event only
 * after the clipboard write succeeded. A missing or blocked clipboard
 * reports the failure and sends nothing. Analytics disabled is a silent
 * no-op inside `track`, so the copy itself never depends on it.
 */
import { EVENTS } from '../../../lib/analytics.ts';
import { track } from '../../../lib/track.ts';

/** Wire one `[data-copy-command]` host; `page` defaults to the current path. */
export function wireCopyCommand(host: HTMLElement, page?: string): void {
  const button = host.querySelector<HTMLButtonElement>('[data-copy-command-button]');
  const source = host.querySelector<HTMLTemplateElement>('[data-copy-command-text]');
  const status = host.querySelector<HTMLElement>('[data-copy-command-status]');
  button?.addEventListener('click', async () => {
    const text = (source?.content.textContent ?? '').trim();
    try {
      await navigator.clipboard.writeText(text);
      if (status) status.textContent = 'Command copied.';
      track(EVENTS.CODE_COPY, { page: page ?? location.pathname });
    } catch {
      if (status) status.textContent = 'Copy failed: your browser blocked the clipboard.';
    }
  });
}
