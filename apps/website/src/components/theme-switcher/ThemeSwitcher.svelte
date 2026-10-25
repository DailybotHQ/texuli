<script lang="ts">
/**
 * Site theme + mode switcher island. Picks any library theme and light, dark,
 * high-contrast or system mode; persists through the no-flash appearance cache
 * so every page paints the choice before stylesheets. No `window`/`document`
 * access until mount.
 */
import { untrack } from 'svelte';
import { Input } from 'texuli/input';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import { APPEARANCE_NAMESPACE, SITE_THEME } from '../foundation/site.ts';
import { ensureThemeCss, loadThemeList } from '../perf/theme-assets.ts';
import {
  applySiteAppearance,
  type ModeChoice,
  readCachedThemeId,
  readModePreference,
} from './appearance.ts';
import { filterThemeCatalog, type ThemeCatalogEntry } from './catalog.ts';

type Props = {
  /**
   * The themes rendered at build time: the first ones in the catalog plus the
   * site default. The full catalog loads from `/theme-catalog.json` after
   * mount (FIX-site-perf-routes), so the HTML does not carry all 210 rows.
   */
  themes: readonly ThemeCatalogEntry[];
  /** How many themes the full catalog has. */
  total: number;
  /** Precomputed `--tx-*` names for cache capture (from the build, so the island never loads the token engine). */
  varNames: readonly string[];
  namespace?: string;
  defaultThemeId?: string;
};

let {
  themes,
  total,
  varNames,
  namespace = APPEARANCE_NAMESPACE,
  defaultThemeId = SITE_THEME,
}: Props = $props();

let query = $state('');
let themeId = $state(defaultThemeId);
let mode = $state<ModeChoice>('system');
let ready = $state(false);
/** The mode the site paints right now (`system` resolved), for the swatches. */
let paintedMode = $state<'light' | 'dark'>('light');
$effect(() => {
  const root = document.documentElement;
  const read = () => {
    paintedMode = root.dataset.txMode === 'dark' ? 'dark' : 'light';
  };
  read();
  const observer = new MutationObserver(read);
  observer.observe(root, { attributes: true, attributeFilter: ['data-tx-mode'] });
  return () => observer.disconnect();
});
/** Every theme's dark swatches, loaded only while the site is dark. */
let darkSwatches = $state<ReadonlyMap<string, ThemeCatalogEntry['swatches']> | null>(null);
$effect(() => {
  if (paintedMode !== 'dark' || darkSwatches) return;
  void loadThemeList<{ id: string; swatches: ThemeCatalogEntry['swatches'] }>(
    'theme-catalog-dark'
  ).then((list) => {
    if (list) darkSwatches = new Map(list.map((row) => [row.id, row.swatches]));
  });
});
const darkOf = (entry: ThemeCatalogEntry) => darkSwatches?.get(entry.id);
const swatchesOf = (entry: ThemeCatalogEntry) =>
  (paintedMode === 'dark' ? darkOf(entry) : undefined) ?? entry.swatches;

/** The full catalog once fetched; until then, the rows from the build. */
let all = $state<readonly ThemeCatalogEntry[] | null>(null);
const source = $derived(all ?? themes);
const filtered = $derived(filterThemeCatalog(source, query));
const activeMeta = $derived(source.find((entry) => entry.id === themeId));
/** Only an option that is rendered can be the active descendant. */
const activeRendered = $derived(filtered.some((entry) => entry.id === themeId));

$effect(() => {
  void loadThemeList<ThemeCatalogEntry>('theme-catalog').then((list) => {
    if (list) all = list;
  });
});

let applying = 0;

/** Loads the theme's CSS (once, same origin), then applies and caches it. */
async function apply(): Promise<void> {
  if (typeof document === 'undefined') return;
  const token = ++applying;
  const id = themeId;
  if (id !== defaultThemeId) await ensureThemeCss(id);
  if (token !== applying) return;
  applySiteAppearance({
    themeId: id,
    mode,
    varNames,
    namespace,
  });
}

// Runs once on mount: reading state inside `apply` must not re-run it.
$effect(() => {
  untrack(() => {
    themeId = readCachedThemeId(namespace, defaultThemeId);
    mode = readModePreference(namespace);
    ready = true;
    void apply();
  });
});

// Follow the OS while "system" is selected.
$effect(() => {
  if (!ready || mode !== 'system') return;
  const mediaColor = matchMedia('(prefers-color-scheme: dark)');
  const mediaContrast = matchMedia('(prefers-contrast: more)');
  const follow = () => void apply();
  mediaColor.addEventListener('change', follow);
  mediaContrast.addEventListener('change', follow);
  return () => {
    mediaColor.removeEventListener('change', follow);
    mediaContrast.removeEventListener('change', follow);
  };
});

function onModeChange(next: string | string[]): void {
  if (next !== 'light' && next !== 'dark' && next !== 'high-contrast' && next !== 'system') {
    return;
  }
  mode = next;
  void apply();
}

function selectTheme(id: string): void {
  themeId = id;
  void apply();
}
</script>

<section class="switcher" aria-labelledby="theme-switcher-title" data-tx-theme-switcher>
  <header class="intro">
    <h1 id="theme-switcher-title">Theme and mode</h1>
    <p class="lead">
      Pick any of the {all?.length ?? total} library themes and a color mode. The choice is stored for the
      whole site and applied before the first paint (no flash).
    </p>
  </header>

  <div class="controls">
    <div class="field">
      <span class="label" id="mode-label">Mode</span>
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={onModeChange}
        variant="outline"
        size="sm"
        aria-labelledby="mode-label"
      >
        <ToggleGroupItem value="light">Light</ToggleGroupItem>
        <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
        <ToggleGroupItem value="high-contrast">High contrast</ToggleGroupItem>
        <ToggleGroupItem value="system">System</ToggleGroupItem>
      </ToggleGroup>
    </div>

    <div class="field">
      <label class="label" for="theme-filter">Find a theme</label>
      <Input
        id="theme-filter"
        type="search"
        placeholder="Name, id, category or tag"
        bind:value={query}
        autocomplete="off"
        clearable
        clearLabel="Clear theme filter"
      />
    </div>
  </div>

  <p class="status" role="status" aria-live="polite">
    {#if activeMeta}
      Active: <strong>{activeMeta.name}</strong>
      <span class="muted">({activeMeta.id})</span>
      · mode <strong>{mode}</strong>
      · {filtered.length} shown
    {:else}
      Active theme id <strong>{themeId}</strong>
    {/if}
  </p>

  <div
    class="catalog"
    role="listbox"
    aria-label="Theme library"
    aria-activedescendant={activeRendered ? `theme-${themeId}` : undefined}
  >
    {#each filtered as entry (entry.id)}
      {@const sw = swatchesOf(entry)}
      <button
        type="button"
        role="option"
        id={`theme-${entry.id}`}
        class="theme-card"
        class:active={entry.id === themeId}
        aria-selected={entry.id === themeId}
        data-theme-id={entry.id}
        onclick={() => selectTheme(entry.id)}
      >
        <span
          class="swatches"
          aria-hidden="true"
          data-preview-theme={entry.id}
          data-swatch-mode={paintedMode === 'dark' && darkOf(entry) ? 'dark' : 'light'}
          data-tx-swatch-primary={sw.primary}
        >
          <span
            class="swatch swatch-bg"
            style:background={sw.background}
            style:border-color={sw.foreground}
          ></span>
          <span class="swatch swatch-primary" style:background={sw.primary}></span>
          <span class="swatch swatch-accent" style:background={sw.accent}></span>
          <span class="swatch swatch-surface" style:background={sw.surface}></span>
        </span>
        <span class="meta">
          <span class="name">{entry.name}</span>
          <span class="id">{entry.id}</span>
          <span class="tags">{entry.category} · {entry.collection}</span>
        </span>
      </button>
    {:else}
      <p class="empty">No themes match “{query}”.</p>
    {/each}
  </div>
</section>

<style>
  .switcher {
    display: grid;
    gap: 1.25rem;
  }
  .intro h1 {
    margin: 0 0 0.35rem;
    font-size: clamp(1.75rem, 5vw, 2.5rem);
    line-height: 1.15;
  }
  .lead {
    margin: 0;
    color: var(--tx-muted-foreground);
    font-size: 1.05rem;
    max-inline-size: 40rem;
  }
  .controls {
    display: grid;
    gap: 1rem;
  }
  .field {
    display: grid;
    gap: 0.35rem;
    justify-items: start;
  }
  .label {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .status {
    margin: 0;
    font-size: 0.95rem;
  }
  .muted {
    color: var(--tx-muted-foreground);
  }
  .catalog {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.75rem;
    max-block-size: min(70vh, 40rem);
    overflow: auto;
    padding: 0.25rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, var(--tx-background));
  }
  .theme-card {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.75rem;
    align-items: center;
    margin: 0;
    padding: 0.75rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    text-align: start;
    cursor: pointer;
    font: inherit;
  }
  .theme-card:hover {
    border-color: var(--tx-border-strong, var(--tx-ring));
    background: var(--tx-muted);
  }
  .theme-card.active {
    border-color: var(--tx-ring);
    outline: 2px solid var(--tx-ring);
    outline-offset: 1px;
  }
  .theme-card:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .swatches {
    display: grid;
    gap: 0.2rem;
    inline-size: 2.25rem;
  }
  .swatch {
    block-size: 0.55rem;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, CanvasText 25%, transparent);
  }
  /* Hex colors are set inline from that theme's own palette (not the active site theme). */
  .meta {
    display: grid;
    gap: 0.15rem;
    min-inline-size: 0;
  }
  .name {
    font-weight: 600;
  }
  .id,
  .tags {
    font-size: 0.75rem;
    color: var(--tx-muted-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty {
    margin: 1rem;
    color: var(--tx-muted-foreground);
    grid-column: 1 / -1;
  }
</style>
