<script lang="ts">
import { untrack } from 'svelte';
/**
 * Color and token explorer island: pick a library theme + light/dark, browse
 * OKLCH scales, semantic roles, WCAG pairs, and copy CSS / JSON / Tailwind.
 * No window/document until mount; only same-origin theme files (T-site-perf).
 */

import type { TailwindThemeEntry } from '@texuli/tokens/tailwind';
import { Button } from 'texuli/button';
import { Input } from 'texuli/input';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import { APPEARANCE_NAMESPACE, SITE_THEME } from '../foundation/site.ts';
import { ensureThemeCss, loadThemeData } from '../perf/theme-assets.ts';
import {
  applySiteAppearance,
  type ModeChoice,
  readCachedThemeId,
  readModePreference,
} from '../theme-switcher/appearance.ts';
import type { ExplorerThemePayload } from './build.ts';
import { buildExportText, type ExportFormat } from './export-formats.ts';
import { formatRatio } from './format.ts';

/** A theme in the list; its payload is a same-origin file loaded on selection. */
type ExplorerThemeRow = Pick<
  ExplorerThemePayload,
  'id' | 'name' | 'category' | 'contrastLevel' | 'description'
>;

type Props = {
  catalog: readonly ExplorerThemeRow[];
  /** The default theme's payload, shipped in the page so it renders before any fetch. */
  initial?: ExplorerThemePayload;
  tailwindEntries: readonly TailwindThemeEntry[];
  /** `--tx-*` names for cache capture, computed at build (keeps the token engine out of the island). */
  varNames: readonly string[];
  namespace?: string;
  defaultThemeId?: string;
};

let {
  catalog,
  initial,
  tailwindEntries,
  varNames,
  namespace = APPEARANCE_NAMESPACE,
  defaultThemeId = SITE_THEME,
}: Props = $props();

let query = $state('');
let themeId = $state(defaultThemeId);
let mode = $state<'light' | 'dark'>('light');
let exportFormat = $state<ExportFormat>('css');
let copyStatus = $state('');
let ready = $state(false);

const filtered = $derived(
  (() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (t) =>
        t.id.includes(q) || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    );
  })()
);
/** Loaded payloads by id (the initial one is already in the page). */
let loaded = $state<Record<string, ExplorerThemePayload>>(initial ? { [initial.id]: initial } : {});
let loadingId = $state<string | null>(null);
let loadError = $state('');
const active = $derived(
  loaded[themeId] ?? (initial && themeId === initial.id ? initial : undefined)
);
const payload = $derived(active ? (mode === 'dark' ? active.dark : active.light) : null);

const exportText = $derived(
  active && payload ? buildExportText(exportFormat, active, mode, tailwindEntries) : ''
);

const pairPass = $derived(payload ? payload.pairs.filter((p) => p.pass).length : 0);
const pairTotal = $derived(payload ? payload.pairs.length : 0);

// Runs once on mount; selection later goes through `selectTheme`.
$effect(() => {
  untrack(() => {
    themeId = readCachedThemeId(namespace, defaultThemeId);
    const pref = readModePreference(namespace);
    // `system` (and high contrast) show the palette the site paints now.
    if (pref === 'light' || pref === 'dark') mode = pref;
    else mode = document.documentElement.dataset.txMode === 'dark' ? 'dark' : 'light';
    ready = true;
    // A theme chosen on another page: fetch its payload now (same origin).
    if (!loaded[themeId]) void show(themeId, mode);
  });
});

/** Loads a theme's payload and CSS (same origin, once each), then applies it. */
async function show(id: string, nextMode: 'light' | 'dark'): Promise<void> {
  loadError = '';
  if (!loaded[id]) {
    loadingId = id;
    const data = await loadThemeData<ExplorerThemePayload>(id);
    if (loadingId !== id && loadingId !== null) return;
    loadingId = null;
    if (!data || data.id !== id) {
      loadError = 'This theme could not be loaded.';
      return;
    }
    loaded = { ...loaded, [id]: data };
  }
  if (id !== defaultThemeId) await ensureThemeCss(id);
  if (themeId !== id) return;
  applySiteAppearance({
    themeId: id,
    mode: nextMode as ModeChoice,
    varNames,
    namespace,
  });
}

function selectTheme(id: string): Promise<void> {
  themeId = id;
  return show(id, mode);
}

function setMode(next: string | string[]): void {
  if (next !== 'light' && next !== 'dark') return;
  mode = next;
  void show(themeId, next);
}

function setFormat(next: string | string[]): void {
  if (next !== 'css' && next !== 'json' && next !== 'tailwind') return;
  exportFormat = next;
}

async function copyExport(): Promise<void> {
  if (!exportText || typeof navigator === 'undefined' || !navigator.clipboard) {
    copyStatus = 'Clipboard unavailable';
    return;
  }
  try {
    await navigator.clipboard.writeText(exportText);
    copyStatus = 'Copied';
  } catch {
    copyStatus = 'Copy failed';
  }
  window.setTimeout(() => {
    copyStatus = '';
  }, 2000);
}
</script>

<section class="explorer" aria-labelledby="color-explorer-title" data-tx-color-explorer>
  <header class="intro">
    <h1 id="color-explorer-title">Color and token explorer</h1>
    <p class="lead">
      OKLCH scales, semantic roles, WCAG 2.x contrast pairs and exportable tokens for any library
      theme. Everything is computed at build time; a theme's data loads from this site when you pick
      it, never from another origin.
    </p>
    {#if loadError}
      <p class="status" role="alert">{loadError}</p>
    {:else if loadingId}
      <p class="status" role="status" aria-busy="true">Loading {loadingId}…</p>
    {:else if ready && active}
      <p class="status" role="status">
        Active <strong>{active.name}</strong> (<code>{active.id}</code>) · {mode} · pairs {pairPass}/{pairTotal}
        pass {active.contrastLevel}
      </p>
    {/if}
  </header>

  <div class="toolbar" role="group" aria-label="Explorer controls">
    <div class="toolbar__search">
      <Input
        id="color-explorer-filter"
        type="search"
        placeholder="Search by name, id or category"
        aria-label="Filter themes"
        bind:value={query}
        autocomplete="off"
        clearable
        clearLabel="Clear theme filter"
      />
    </div>
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={setMode}
      aria-label="Color mode"
      class="toolbar__mode"
    >
      <ToggleGroupItem value="light">Light</ToggleGroupItem>
      <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
    </ToggleGroup>
  </div>

  <div class="layout">
    <nav class="themes" aria-label="Theme list">
      <h2 class="sr-only">Themes</h2>
      <ul>
        {#each filtered as theme (theme.id)}
          <li>
            <button
              type="button"
              class="theme-btn"
              class:theme-btn--active={theme.id === themeId}
              aria-current={theme.id === themeId ? 'true' : undefined}
              onclick={() => selectTheme(theme.id)}
            >
              <span class="theme-btn__name">{theme.name}</span>
              <span class="theme-btn__meta">{theme.category} · {theme.contrastLevel}</span>
            </button>
          </li>
        {:else}
          <li class="empty">No themes match.</li>
        {/each}
      </ul>
    </nav>

    {#if payload && active}
      <div class="panels">
        <section class="panel" aria-labelledby="scales-title">
          <h2 id="scales-title">OKLCH scales</h2>
          <p class="panel__hint">Eleven-step ramps from primary, accent and secondary seeds.</p>
          {#each Object.entries(payload.scales) as [name, scale] (name)}
            <div class="scale">
              <h3>{name}</h3>
              <div class="scale__row" role="list" aria-label="{name} scale">
                {#each Object.entries(scale) as [step, hex] (step)}
                  <div class="swatch" role="listitem" title="{step}: {hex}">
                    <span class="swatch__chip" style:background={hex}></span>
                    <span class="swatch__label">{step}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </section>

        <section class="panel" aria-labelledby="roles-title">
          <h2 id="roles-title">Semantic roles</h2>
          <div class="roles" role="list">
            {#each payload.roles as role (role.role)}
              <div class="role" role="listitem">
                <span class="role__chip" style:background={role.default}></span>
                <div class="role__meta">
                  <code>{role.role}</code>
                  <span class="role__hex">{role.default}</span>
                </div>
              </div>
            {/each}
          </div>
        </section>

        <section class="panel" aria-labelledby="pairs-title">
          <h2 id="pairs-title">Contrast pairs</h2>
          <p class="panel__hint">
            WCAG 2.x floors: text {active.contrastLevel === 'AAA' ? '7:1' : '4.5:1'}, UI 3:1.
          </p>
          <!-- On phones the table scrolls sideways: a focusable, named region keyboard users can scroll. -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div class="table-wrap" role="region" aria-label="Contrast pairs table, scrollable" tabindex="0">
            <table>
              <caption class="sr-only">Contrast pairs for {active.name} {mode}</caption>
              <thead>
                <tr>
                  <th scope="col">Foreground</th>
                  <th scope="col">Background</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Ratio</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {#each payload.pairs as pair (pair.id)}
                  <tr data-pass={pair.pass ? 'true' : 'false'}>
                    <td>
                      <span class="pair-chip" style:background={pair.fg}></span>
                      <code>{pair.foreground}</code>
                    </td>
                    <td>
                      <span class="pair-chip" style:background={pair.bg}></span>
                      <code>{pair.background}</code>
                    </td>
                    <td>{pair.kind}</td>
                    <td>{formatRatio(pair.ratio)}</td>
                    <td>{pair.pass ? 'Pass' : 'Fail'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel" aria-labelledby="export-title">
          <h2 id="export-title">Export</h2>
          <ToggleGroup
            type="single"
            value={exportFormat}
            onValueChange={setFormat}
            aria-label="Export format"
          >
            <ToggleGroupItem value="css">CSS</ToggleGroupItem>
            <ToggleGroupItem value="json">JSON</ToggleGroupItem>
            <ToggleGroupItem value="tailwind">Tailwind</ToggleGroupItem>
          </ToggleGroup>
          <div class="export-actions">
            <Button type="button" variant="outline" onclick={() => void copyExport()}>
              Copy {exportFormat}
            </Button>
            <span class="copy-status" role="status" aria-live="polite">{copyStatus}</span>
          </div>
          <pre class="export" tabindex="0"><code>{exportText}</code></pre>
        </section>
      </div>
    {/if}
  </div>
</section>

<style>
  .explorer {
    display: grid;
    gap: 1.5rem;
    color: var(--tx-foreground);
  }
  .intro h1 {
    margin: 0 0 0.35rem;
    font-size: clamp(2rem, 6vw, 3rem);
    line-height: 1.15;
  }
  .lead {
    margin: 0;
    max-inline-size: 44rem;
    font-size: 1.125rem;
  }
  .status {
    margin-block: 0.75rem 0;
    font-size: 0.9375rem;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: end;
  }
  .toolbar__search {
    flex: 1 1 16rem;
    min-inline-size: 0;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
  }
  .themes {
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius-lg, 0.75rem);
    background: var(--tx-background);
    max-block-size: min(70vh, 40rem);
    overflow: auto;
  }
  .themes ul {
    list-style: none;
    margin: 0;
    padding: 0.35rem;
  }
  .theme-btn {
    display: grid;
    gap: 0.15rem;
    width: 100%;
    text-align: start;
    margin: 0;
    padding: 0.55rem 0.65rem;
    border: 0;
    border-radius: var(--tx-radius-md, 0.5rem);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
  }
  .theme-btn:hover,
  .theme-btn--active {
    background: color-mix(in oklab, var(--tx-foreground) 8%, transparent);
  }
  .theme-btn:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .theme-btn__name {
    font-weight: 600;
  }
  .theme-btn__meta {
    font-size: 0.75rem;
  }
  .empty {
    padding: 0.75rem;
  }
  .panels {
    display: grid;
    gap: 1.25rem;
    min-inline-size: 0;
  }
  .panel {
    /* Grid items default to their content's width; let the panel shrink to the
       column so phones never get a zoomed-out, horizontally scrolling page. */
    min-inline-size: 0;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius-lg, 0.75rem);
    padding: 1rem;
    background: var(--tx-background);
  }
  .panel h2 {
    margin: 0 0 0.35rem;
    font-size: 1.15rem;
  }
  .panel h3 {
    margin: 0.75rem 0 0.35rem;
    font-size: 0.95rem;
    text-transform: capitalize;
  }
  .panel__hint {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
  }
  .scale__row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .swatch {
    display: grid;
    gap: 0.2rem;
    justify-items: center;
    inline-size: 2.75rem;
  }
  .swatch__chip {
    display: block;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border-radius: 0.35rem;
    border: 1px solid var(--tx-border);
  }
  .swatch__label {
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
  }
  .roles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
    gap: 0.5rem;
  }
  .role {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.5rem;
    align-items: center;
    padding: 0.35rem;
    border: 1px solid var(--tx-border);
    border-radius: 0.5rem;
  }
  .role__chip {
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border-radius: 0.3rem;
    border: 1px solid var(--tx-border);
  }
  .role__meta {
    display: grid;
    gap: 0.1rem;
    min-inline-size: 0;
  }
  .role__hex {
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .table-wrap:focus-visible {
    outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .table-wrap {
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  th,
  td {
    text-align: start;
    padding: 0.4rem 0.5rem;
    border-block-end: 1px solid var(--tx-border);
    vertical-align: middle;
  }
  .pair-chip {
    display: inline-block;
    inline-size: 0.9rem;
    block-size: 0.9rem;
    border-radius: 0.2rem;
    border: 1px solid var(--tx-border);
    margin-inline-end: 0.35rem;
    vertical-align: middle;
  }
  tr[data-pass='false'] td:last-child {
    font-weight: 600;
  }
  .export-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-block: 0.75rem;
  }
  .copy-status {
    font-size: 0.875rem;
    min-block-size: 1.25em;
  }
  .export {
    margin: 0;
    max-block-size: 18rem;
    overflow: auto;
    padding: 0.75rem;
    border: 1px solid var(--tx-border);
    border-radius: 0.5rem;
    background: color-mix(in oklab, var(--tx-foreground) 4%, var(--tx-background));
    font-size: 0.75rem;
    white-space: pre;
  }
  .explorer :global([data-tx-button]) {
    color: var(--tx-foreground) !important;
    background: var(--tx-background) !important;
    border-color: var(--tx-border) !important;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  @media (max-width: 48rem) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .themes {
      max-block-size: 14rem;
    }
  }
</style>
