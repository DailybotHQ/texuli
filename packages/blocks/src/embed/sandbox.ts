/**
 * Host helper for sandboxed embed iframes (F5 / SECURITY.md embed contract).
 *
 * Texuli never evaluates embed-app JSON. When a host needs a URL frame, this
 * module builds an iframe that:
 * - uses a sandbox **without** `allow-same-origin` (opaque origin)
 * - sets `referrerpolicy="no-referrer"`
 * - accepts only HTTPS `src` values whose origin is on an explicit allowlist
 * - omits `allow-popups-to-escape-sandbox` by default (opt in only)
 *
 * The host must still set CSP `frame-src`, check `postMessage` origins, and
 * must never widen the sandbox string returned here casually.
 */
/** Cleanup returned by a host mountEmbed implementation. */
export type EmbedMountCleanup = () => void;
// biome-ignore lint/suspicious/noConfusingVoidType: Hosts may intentionally omit a cleanup return.
export type EmbedMountResult = void | EmbedMountCleanup;

/**
 * Default sandbox tokens for embed iframes. Intentionally omits:
 * - `allow-same-origin` (frame cannot read the parent document)
 * - `allow-popups-to-escape-sandbox` (popups stay sandboxed unless opted in)
 */
export const EMBED_IFRAME_SANDBOX = 'allow-scripts allow-forms allow-popups' as const;

/** Optional extra token when the host accepts unsandboxed popups from the frame. */
export const EMBED_IFRAME_SANDBOX_POPUPS_ESCAPE = 'allow-popups-to-escape-sandbox' as const;

/** Referrer policy applied to every sandboxed embed iframe. */
export const EMBED_IFRAME_REFERRER_POLICY = 'no-referrer' as const;

export type EmbedSandboxOptions = {
  /**
   * When true, appends `allow-popups-to-escape-sandbox` so a user-gesture popup
   * from the frame runs with a full top-level origin (phishing risk). Default false.
   */
  allowPopupsToEscapeSandbox?: boolean;
};

/** Build the sandbox attribute value for an embed iframe. */
export function embedIframeSandbox(options: EmbedSandboxOptions = {}): string {
  if (options.allowPopupsToEscapeSandbox === true) {
    return `${EMBED_IFRAME_SANDBOX} ${EMBED_IFRAME_SANDBOX_POPUPS_ESCAPE}`;
  }
  return EMBED_IFRAME_SANDBOX;
}

export type ResolveEmbedFrameSrcOptions = {
  /** Exact HTTPS origins permitted as iframe `src` (e.g. `https://widgets.example.com`). */
  allowedOrigins: readonly string[];
};

function normalizeAllowedOrigins(origins: readonly string[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const entry of origins) {
    if (typeof entry !== 'string' || entry.trim() === '') continue;
    try {
      const url = new URL(entry.includes('://') ? entry : `https://${entry}`);
      if (url.protocol !== 'https:') continue;
      if (url.username !== '' || url.password !== '') continue;
      out.add(url.origin);
    } catch {
      // ignore malformed allowlist rows
    }
  }
  return out;
}

/**
 * Validate an iframe `src` for an untrusted embed frame.
 * Returns the cleaned URL or `undefined` when the value must not load.
 */
export function resolveEmbedFrameSrc(
  value: unknown,
  options: ResolveEmbedFrameSrcOptions
): string | undefined {
  if (typeof value !== 'string') return undefined;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control chars are stripped on purpose
  const cleaned = value.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (cleaned === '' || cleaned.startsWith('//') || cleaned.startsWith('\\')) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:') return undefined;
  if (parsed.username !== '' || parsed.password !== '') return undefined;
  if (!normalizeAllowedOrigins(options.allowedOrigins).has(parsed.origin)) return undefined;
  return parsed.href;
}

export type CreateSandboxedEmbedIframeOptions = {
  /** Candidate frame URL (validated against `allowedOrigins`). */
  src: unknown;
  /** Exact HTTPS origins allowed for `src`. */
  allowedOrigins: readonly string[];
  /** Accessible name for the iframe. */
  title?: string;
  /**
   * Opt-in: allow popups opened by the frame to escape the sandbox.
   * Default false — popups stay constrained.
   */
  allowPopupsToEscapeSandbox?: boolean;
};

/**
 * Build a sandboxed iframe element, or `null` when `src` is refused.
 * Does not attach the element to the document.
 */
export function createSandboxedEmbedIframe(
  options: CreateSandboxedEmbedIframeOptions
): HTMLIFrameElement | null {
  const src = resolveEmbedFrameSrc(options.src, {
    allowedOrigins: options.allowedOrigins,
  });
  if (!src) return null;

  const iframe = document.createElement('iframe');
  iframe.setAttribute(
    'sandbox',
    embedIframeSandbox({ allowPopupsToEscapeSandbox: options.allowPopupsToEscapeSandbox })
  );
  iframe.setAttribute('referrerpolicy', EMBED_IFRAME_REFERRER_POLICY);
  iframe.setAttribute('title', options.title?.trim() || 'Embedded app');
  iframe.src = src;
  return iframe;
}

export type SandboxedEmbedMountOptions = {
  /** Exact HTTPS origins allowed when `app.src` (or `resolveSrc`) yields a URL. */
  allowedOrigins: readonly string[];
  /**
   * Optional map from validated embed-app JSON to a frame URL.
   * Default reads `app.src` when it is a string.
   */
  resolveSrc?: (app: Record<string, unknown>) => unknown;
  /** Iframe accessible name; defaults to `app.title` or "Embedded app". */
  title?: string | ((app: Record<string, unknown>) => string);
  /**
   * Opt-in: allow popups from the frame to escape the sandbox.
   * Default false.
   */
  allowPopupsToEscapeSandbox?: boolean;
};

/**
 * Factory for a host `mountEmbed` that loads allowlisted HTTPS URLs in a
 * sandboxed, no-referrer iframe. Returns a cleanup that removes the frame.
 *
 * If the resolved src is not allowlisted, the mount throws so EmbedApp shows
 * the start-error label instead of painting an open frame.
 */
export function createSandboxedEmbedMount(
  options: SandboxedEmbedMountOptions
): (target: HTMLElement, app: Record<string, unknown>) => EmbedMountResult {
  const allowedOrigins = options.allowedOrigins;
  return (target, app) => {
    const rawSrc =
      options.resolveSrc?.(app) ??
      (typeof app.src === 'string' ? app.src : typeof app.url === 'string' ? app.url : undefined);
    const title =
      typeof options.title === 'function'
        ? options.title(app)
        : (options.title ??
          (typeof app.title === 'string' ? app.title : undefined) ??
          'Embedded app');
    const iframe = createSandboxedEmbedIframe({
      src: rawSrc,
      allowedOrigins,
      title,
      allowPopupsToEscapeSandbox: options.allowPopupsToEscapeSandbox,
    });
    if (!iframe) {
      throw new Error('Embed frame src is missing or not on the host allowlist.');
    }
    target.replaceChildren(iframe);
    const cleanup: EmbedMountCleanup = () => {
      iframe.removeAttribute('src');
      iframe.remove();
      target.replaceChildren();
    };
    return cleanup;
  };
}
