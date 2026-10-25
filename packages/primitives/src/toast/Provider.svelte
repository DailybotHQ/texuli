<script lang="ts">
import { getAnnouncer } from '@texuli/core/announcer';
import { getOwnerDocument } from '@texuli/core/env';
import { onDestroy, type Snippet, untrack } from 'svelte';
import { setToastProviderContext, type ToastProviderContext } from './context.ts';
import { createToastManager } from './manager.ts';
import type { ToastManager } from './types.ts';

type Props = {
  /** Accessible name for the toast region. */
  label?: string;
  /** Keyboard shortcut to focus the region (default F6). */
  hotkey?: string;
  manager?: ToastManager;
  children?: Snippet;
};

let { label = 'Notifications', hotkey = 'F6', manager: managerProp, children }: Props = $props();

// Resolve once so publish/dismiss share one queue identity with the host.
const manager = untrack(() => managerProp) ?? createToastManager();
const pausers = new Set<(paused: boolean) => void>();
let paused = false;
let focusHandler: (() => void) | null = null;

function pauseAll(): void {
  if (paused) return;
  paused = true;
  for (const fn of pausers) fn(true);
}

function resumeAll(): void {
  if (!paused) return;
  paused = false;
  for (const fn of pausers) fn(false);
}

const ctx: ToastProviderContext = {
  manager,
  get label() {
    return label;
  },
  get hotkey() {
    return hotkey;
  },
  pauseAll,
  resumeAll,
  isPaused: () => paused,
  registerPauser(fn) {
    pausers.add(fn);
    fn(paused);
    return () => {
      pausers.delete(fn);
    };
  },
  focusRegion() {
    focusHandler?.();
  },
  setFocusHandler(fn) {
    focusHandler = fn;
  },
};

setToastProviderContext(ctx);

let lastAnnouncedAt = 0;
$effect(() => {
  return manager.subscribe((toasts) => {
    const newest = [...toasts].sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!newest || newest.createdAt <= lastAnnouncedAt) return;
    lastAnnouncedAt = newest.createdAt;
    try {
      const doc = getOwnerDocument(typeof document !== 'undefined' ? document.body : null);
      if (!doc) return;
      const announcer = getAnnouncer(doc);
      const message = [newest.title, newest.description].filter(Boolean).join('. ');
      if (!message) return;
      announcer.announce(message, {
        politeness: newest.tone === 'foreground' ? 'assertive' : 'polite',
        immediate: true,
      });
    } catch {
      // Announcer optional in unit tests without a document.
    }
  });
});

$effect(() => {
  const doc = getOwnerDocument(typeof document !== 'undefined' ? document.body : null);
  if (!doc) return;
  const key = hotkey;
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== key && event.code !== key) return;
    if (key === 'F6' && event.key !== 'F6') return;
    if (event.defaultPrevented) return;
    event.preventDefault();
    ctx.focusRegion();
  };
  doc.addEventListener('keydown', onKey, true);
  return () => doc.removeEventListener('keydown', onKey, true);
});

onDestroy(() => {
  pausers.clear();
  focusHandler = null;
});
</script>

{@render children?.()}
