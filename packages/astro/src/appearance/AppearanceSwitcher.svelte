<script lang="ts">
/**
 * Light, dark or system appearance for an Astro site, as a native radio
 * group (arrow keys move and select, one tab stop). The choice persists in
 * the namespaced appearance cache the `@texuli/astro` bootstrap reads before
 * paint. Nothing touches `window`, `document` or storage until it mounts; it
 * renders no inline script or style.
 */
import { applyColorMode, type ColorMode } from '@texuli/tokens/modes';
import { appearanceCacheKey } from '@texuli/tokens/no-flash';
import {
  APPEARANCE_CHANGE_EVENT,
  APPEARANCE_CHOICES,
  type AppearanceChangeDetail,
  type AppearanceChoice,
  applyAppearanceChoice,
  readAppearanceChoice,
  type StoredAppearanceChoice,
} from './appearance.ts';

type Props = {
  /** Same namespace as the `texuli({ namespace })` integration option. */
  namespace?: string;
  /** Same fallback as the integration's `fallbackMode`; System returns to it. */
  fallbackMode?: ColorMode;
  /** Theme id cached when neither the cache nor the root names one. */
  themeId?: string;
  /** Accessible name of the radio group. */
  label?: string;
  /** Visible option names. */
  labels?: Partial<Record<AppearanceChoice, string>>;
  /** Called after a choice is stored and applied. */
  onValueChange?: (choice: AppearanceChoice) => void;
  /** `md` (default) or `sm`, a compact segmented control for toolbars and headers. */
  size?: 'sm' | 'md';
  class?: string;
};

let {
  namespace = 'site',
  fallbackMode = 'system',
  themeId,
  label = 'Appearance',
  labels,
  onValueChange,
  size = 'md',
  class: className,
}: Props = $props();

const DEFAULT_LABELS: Record<AppearanceChoice, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};
const id = $props.id();
const name = `tx-appearance-${id}`;
const labelId = `${name}-label`;
// Unknown until mounted, so the server never guesses a stored choice.
let choice = $state<StoredAppearanceChoice | undefined>(undefined);

$effect(() => {
  const key = appearanceCacheKey(namespace);
  choice = readAppearanceChoice(namespace);
  // Another tab changed the choice: follow it in the radios and on <html>.
  // The other tab already wrote the cache, so only the mode is applied here.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== key) return;
    const next = readAppearanceChoice(namespace);
    choice = next;
    applyColorMode(document.documentElement, next === 'system' ? fallbackMode : next);
  };
  // The same tab changed it (another switcher, a command palette): follow the radios.
  // `applyAppearanceChoice` already wrote the cache and the root.
  const onChange = (event: Event) => {
    const detail = (event as CustomEvent<AppearanceChangeDetail>).detail;
    if (detail?.namespace !== namespace) return;
    choice = readAppearanceChoice(namespace);
  };
  addEventListener('storage', onStorage);
  addEventListener(APPEARANCE_CHANGE_EVENT, onChange);
  return () => {
    removeEventListener('storage', onStorage);
    removeEventListener(APPEARANCE_CHANGE_EVENT, onChange);
  };
});

// While System is chosen and the fallback follows the OS, follow it live.
$effect(() => {
  if (choice !== 'system' || fallbackMode !== 'system' || typeof matchMedia !== 'function') return;
  const queries = ['(prefers-color-scheme: dark)', '(prefers-contrast: more)'].map((query) =>
    matchMedia(query)
  );
  const follow = () => {
    if (readAppearanceChoice(namespace) === 'system') {
      applyAppearanceChoice(namespace, 'system', { fallbackMode });
    }
  };
  for (const query of queries) query.addEventListener?.('change', follow);
  return () => {
    for (const query of queries) query.removeEventListener?.('change', follow);
  };
});

function choose(next: AppearanceChoice): void {
  choice = next;
  applyAppearanceChoice(namespace, next, { fallbackMode, ...(themeId ? { themeId } : {}) });
  onValueChange?.(next);
}
</script>

<div
  role="radiogroup"
  aria-labelledby={labelId}
  class={['tx-astro-appearance', className].filter(Boolean).join(' ')}
  data-tx-appearance={choice ?? ''}
  data-size={size === 'sm' ? 'sm' : 'md'}
>
  <span id={labelId} class="tx-astro-appearance__label">{label}</span>
  {#each APPEARANCE_CHOICES as option (option)}
    <label class="tx-astro-appearance__option">
      <input
        type="radio"
        {name}
        value={option}
        checked={choice === option}
        onchange={() => choose(option)}
      />
      <span>{labels?.[option] ?? DEFAULT_LABELS[option]}</span>
    </label>
  {/each}
</div>

<style>
  .tx-astro-appearance {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.125rem;
    border: 1px solid var(--tx-border, currentColor);
    border-radius: calc(var(--tx-radius, 0.5rem) + 0.125rem);
    background: var(--tx-surface, transparent);
    color: var(--tx-foreground, inherit);
  }

  .tx-astro-appearance__label {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .tx-astro-appearance__option {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-block-size: 2rem;
    padding-block: 0.25rem;
    padding-inline: 0.75rem;
    border-radius: var(--tx-radius, 0.5rem);
    color: var(--tx-muted-foreground, inherit);
    cursor: pointer;
  }

  .tx-astro-appearance__option input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .tx-astro-appearance[data-size='sm'] .tx-astro-appearance__option {
    min-block-size: 1.5rem;
    padding-block: 0.125rem;
    padding-inline: 0.5rem;
  }

  .tx-astro-appearance__option:has(input:checked) {
    background: var(--tx-accent, Highlight);
    color: var(--tx-accent-foreground, HighlightText);
  }

  .tx-astro-appearance__option:has(input:focus-visible) {
    outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
    outline-offset: var(--tx-focus-ring-offset, 2px);
  }

  @media (forced-colors: active) {
    .tx-astro-appearance__option:has(input:checked) {
      outline: 2px solid CanvasText;
    }
  }
</style>
