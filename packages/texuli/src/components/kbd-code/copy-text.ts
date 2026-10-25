/**
 * Copy plain text to the clipboard. Framework-free; takes no ambient globals
 * at import time. Returns whether the write succeeded.
 */

export type ClipboardLike = {
  writeText?: (text: string) => Promise<void>;
};

export type CopyTextOptions = {
  /** Injected clipboard (tests). Defaults to `navigator.clipboard` when present. */
  clipboard?: ClipboardLike | null;
  /** Document used for the execCommand fallback. */
  ownerDocument?: Document | null;
};

/**
 * Write `text` to the clipboard. Prefers `clipboard.writeText`, then a hidden
 * textarea + `document.execCommand('copy')` fallback for older environments.
 */
export async function copyText(text: string, options: CopyTextOptions = {}): Promise<boolean> {
  if (typeof text !== 'string') return false;

  const clipboard =
    options.clipboard !== undefined
      ? options.clipboard
      : typeof navigator !== 'undefined'
        ? navigator.clipboard
        : null;

  if (clipboard && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path.
    }
  }

  const doc = options.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  if (!doc?.body) return false;

  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.inlineSize = '1px';
  area.style.blockSize = '1px';
  area.style.insetInlineStart = '-9999px';
  area.style.opacity = '0';
  doc.body.append(area);
  area.select();
  area.setSelectionRange(0, area.value.length);
  let ok = false;
  try {
    ok = typeof doc.execCommand === 'function' ? doc.execCommand('copy') : false;
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}
