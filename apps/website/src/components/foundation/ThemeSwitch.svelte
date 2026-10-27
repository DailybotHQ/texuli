<script lang="ts">
/**
 * Light, dark or system appearance, built from Texuli's own ToggleGroup.
 * A chosen mode is cached for the no-flash script; "system" clears the cache
 * so the script follows the operating system again. Nothing touches
 * `window` or `document` until the component mounts.
 */
import {
  appearanceCacheKey,
  cacheAppearance,
  localStorageOrUndefined,
  readCachedAppearance,
} from '@texuli/tokens/no-flash';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import { track } from '../../lib/track.ts';
import { APPEARANCE_NAMESPACE, SITE_THEME } from './site.ts';

type Choice = 'light' | 'dark' | 'system';

let choice = $state<Choice>('system');

$effect(() => {
  const cached = readCachedAppearance(APPEARANCE_NAMESPACE);
  choice = cached?.mode === 'light' || cached?.mode === 'dark' ? cached.mode : 'system';
});

function systemMode(): 'light' | 'dark' {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(mode: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.dataset.txMode = mode;
  root.classList.toggle('dark', mode === 'dark');
  root.classList.toggle('light', mode === 'light');
  root.style.colorScheme = mode;
}

function choose(next: string | string[]): void {
  if (next !== 'light' && next !== 'dark' && next !== 'system') return;
  track('theme_switch', { from: choice, to: next });
  choice = next;
  if (next === 'system') {
    try {
      localStorageOrUndefined()?.removeItem(appearanceCacheKey(APPEARANCE_NAMESPACE));
    } catch {
      // Storage can be blocked; the page still switches.
    }
    apply(systemMode());
    return;
  }
  cacheAppearance(APPEARANCE_NAMESPACE, { themeId: SITE_THEME, mode: next, vars: {} });
  apply(next);
}

// While "system" is chosen, follow the operating system live.
$effect(() => {
  if (choice !== 'system') return;
  const media = matchMedia('(prefers-color-scheme: dark)');
  const follow = () => apply(media.matches ? 'dark' : 'light');
  media.addEventListener('change', follow);
  return () => media.removeEventListener('change', follow);
});
</script>

<ToggleGroup
  type="single"
  value={choice}
  onValueChange={choose}
  variant="outline"
  size="sm"
  aria-label="Appearance"
>
  <ToggleGroupItem value="light">Light</ToggleGroupItem>
  <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
  <ToggleGroupItem value="system">System</ToggleGroupItem>
</ToggleGroup>
