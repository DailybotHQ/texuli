<script lang="ts">
/**
 * Light, dark or system appearance, built from Texuli's own ToggleGroup.
 * It keeps the theme picked on the theme page: that theme's CSS loads, the
 * inline `--tx-*` values the no-flash script replayed (captured in the other
 * mode) are cleared so the mode's rules win, and the new values are cached
 * for the next page. Nothing touches `window` or `document` until the
 * component mounts.
 */
import { readCachedAppearance } from '@texuli/tokens/no-flash';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import { track } from '../../lib/track.ts';
import { ensureThemeCss } from '../perf/theme-assets.ts';
import {
  applySiteAppearance,
  type ModeChoice,
  readCachedThemeId,
  readModePreference,
} from '../theme-switcher/appearance.ts';
import { APPEARANCE_NAMESPACE, SITE_THEME } from './site.ts';

type Choice = 'light' | 'dark' | 'system';

let choice = $state<Choice>('system');

$effect(() => {
  const stored = readModePreference(APPEARANCE_NAMESPACE);
  const initial: Choice = stored === 'light' || stored === 'dark' ? stored : 'system';
  choice = initial;
  // The cache holds the mode resolved on the last visit; "system" re-resolves it.
  if (initial === 'system') void apply('system');
});

/** Every `--tx-*` name the cache or the root's inline style carries. */
function themeVarNames(root: HTMLElement): string[] {
  const names = new Set(Object.keys(readCachedAppearance(APPEARANCE_NAMESPACE)?.vars ?? {}));
  for (const name of Array.from(root.style)) {
    if (name.startsWith('--tx-')) names.add(name);
  }
  return [...names];
}

let applying = 0;

async function apply(mode: ModeChoice): Promise<void> {
  const token = ++applying;
  const themeId = readCachedThemeId(APPEARANCE_NAMESPACE, SITE_THEME);
  if (themeId !== SITE_THEME) await ensureThemeCss(themeId);
  if (token !== applying) return;
  applySiteAppearance({
    themeId,
    mode,
    varNames: themeVarNames(document.documentElement),
    namespace: APPEARANCE_NAMESPACE,
  });
}

function choose(next: string | string[]): void {
  if (next !== 'light' && next !== 'dark' && next !== 'system') return;
  track('theme_switch', { from: choice, to: next });
  choice = next;
  void apply(next);
}

// While "system" is chosen, follow the operating system live.
$effect(() => {
  if (choice !== 'system') return;
  const media = matchMedia('(prefers-color-scheme: dark)');
  const follow = () => void apply('system');
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
