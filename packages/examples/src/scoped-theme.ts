import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';

/** The library theme examples fall back to when the page carries none. */
const FALLBACK_THEME = 'enterprise-neutral';

/**
 * Svelte action: scope a real theme mode to one example section. It applies
 * the page's library theme (`data-tx-theme` on `<html>`) in `mode` to the
 * node, so every `--tx-*` token switches together: surfaces, soft fills and
 * their foregrounds stay paired. Overriding a few tokens by hand (background
 * and foreground only) leaves soft fills from the page mode under scoped
 * text, which is how a "dark" section ended up with light fills and light
 * text (POLISH_AUDIT P1-02).
 */
export function scopedTheme(node: HTMLElement, mode: 'light' | 'dark' = 'dark') {
  let cancelled = false;
  node.dataset.txMode = mode;
  const id = document.documentElement.dataset.txTheme ?? FALLBACK_THEME;
  const ready = loadLibraryTheme(id)
    .catch(() => loadLibraryTheme(FALLBACK_THEME))
    .then((theme) => {
      if (!cancelled) applyTheme(node, { theme, mode });
    });
  return {
    ready,
    destroy() {
      cancelled = true;
    },
  };
}
