<script lang="ts">
/**
 * Theme gallery island: live preview cards (light / dark / high-contrast),
 * WCAG AA scores, filter, and one-click apply via the site appearance cache.
 * No window/document access until mount.
 */
import { tick } from 'svelte';
import { Button } from 'texuli/button';
import { Input } from 'texuli/input';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import { APPEARANCE_NAMESPACE, SITE_THEME } from '../foundation/site.ts';
import { ensureThemeCss, loadThemeCssWhenVisible, loadThemeList } from '../perf/theme-assets.ts';
import {
  applySiteAppearance,
  type ModeChoice,
  readCachedThemeId,
  readModePreference,
} from '../theme-switcher/appearance.ts';
import type { GalleryThemeCard } from './build.ts';
import {
  filterGalleryByPass,
  filterGalleryCards,
  formatRatio,
  GALLERY_PAGE_SIZE,
  type GalleryPreviewMode,
} from './scores.ts';

type Props = {
  /**
   * The first page of cards, rendered at build time. The full list loads
   * from `/theme-gallery.json` after mount (FIX-site-perf-routes), so the
   * HTML does not carry all 210 cards as island props.
   */
  cards: readonly GalleryThemeCard[];
  /** How many themes the full list has. */
  total: number;
  /** How many of them pass AA in every mode. */
  passTotal: number;
  /** `--tx-*` names for cache capture, computed at build (keeps the token engine out of the island). */
  varNames: readonly string[];
  namespace?: string;
  defaultThemeId?: string;
};

let {
  cards,
  total,
  passTotal,
  varNames,
  namespace = APPEARANCE_NAMESPACE,
  defaultThemeId = SITE_THEME,
}: Props = $props();

let query = $state('');
let passFilter = $state<'all' | 'pass' | 'fail'>('all');
let previewMode = $state<GalleryPreviewMode>('light');
let activeThemeId = $state(defaultThemeId);
let activeMode = $state<ModeChoice>('light');
let ready = $state(false);

/** The full list once fetched; until then, the first page from the build. */
let all = $state<readonly GalleryThemeCard[] | null>(null);
const source = $derived(all ?? cards);
const filtered = $derived(filterGalleryByPass(filterGalleryCards(source, query), passFilter));
const filtering = $derived(query.trim() !== '' || passFilter !== 'all');
/** Matches in the whole library (the build's total until the list arrives, when not filtering). */
const matchCount = $derived(all || filtering ? filtered.length : total);

/**
 * Cards render a page at a time (T-site-perf): the build ships 24 cards of
 * markup instead of all 210, and each shown card loads its theme CSS only
 * when near the viewport. "Show more" adds a page; a new filter starts over.
 */
const PAGE_SIZE = GALLERY_PAGE_SIZE;
let pageCount = $state(1);
const visible = $derived(filtered.slice(0, pageCount * PAGE_SIZE));
const remaining = $derived(matchCount - visible.length);

/** Loads the whole list once; repeated calls share one request. */
async function loadAll(): Promise<void> {
  if (all) return;
  const list = await loadThemeList<GalleryThemeCard>('theme-gallery');
  if (list) all = list;
}

$effect(() => {
  void loadAll();
});
let grid = $state<HTMLElement>();

$effect(() => {
  // Reading the filters resets paging whenever they change.
  void query;
  void passFilter;
  pageCount = 1;
});

async function showMore(): Promise<void> {
  await loadAll();
  const firstNew = visible.length;
  pageCount += 1;
  await tick();
  // Move focus to the first new card so keyboard users continue from there.
  grid
    ?.querySelectorAll<HTMLElement>('[data-theme-id]')
    [firstNew]?.querySelector<HTMLElement>('button')
    ?.focus();
}

/** Reveals every matching theme at once for visitors who want to scan all. */
async function showAll(): Promise<void> {
  await loadAll();
  const firstNew = visible.length;
  pageCount = Math.ceil(matchCount / PAGE_SIZE);
  await tick();
  grid
    ?.querySelectorAll<HTMLElement>('[data-theme-id]')
    [firstNew]?.querySelector<HTMLElement>('button')
    ?.focus();
}

const themeCount = $derived(all?.length ?? total);
const passCount = $derived(all ? all.filter((c) => c.pass).length : passTotal);
const failCount = $derived(themeCount - passCount);

async function apply(themeId: string, mode: GalleryPreviewMode): Promise<void> {
  if (typeof document === 'undefined') return;
  activeThemeId = themeId;
  activeMode = mode;
  previewMode = mode;
  // The theme's CSS is a same-origin file; it must be in before the cache captures it.
  if (themeId !== defaultThemeId) await ensureThemeCss(themeId);
  if (activeThemeId !== themeId) return;
  applySiteAppearance({
    themeId,
    mode,
    varNames,
    namespace,
  });
}

$effect(() => {
  activeThemeId = readCachedThemeId(namespace, defaultThemeId);
  const pref = readModePreference(namespace);
  // `system` resolves to what the site paints now: cards preview that palette.
  const painted = document.documentElement.dataset.txMode === 'dark' ? 'dark' : 'light';
  activeMode = pref === 'system' ? painted : pref;
  previewMode = pref === 'system' ? painted : pref;
  ready = true;
});

function onPreviewMode(next: string | string[]): void {
  if (next !== 'light' && next !== 'dark' && next !== 'high-contrast') return;
  previewMode = next;
}

function onPassFilter(next: string | string[]): void {
  if (next !== 'all' && next !== 'pass' && next !== 'fail') return;
  passFilter = next;
}

function scoreFor(card: GalleryThemeCard, mode: GalleryPreviewMode) {
  return card.scores.find((s) => s.mode === mode);
}
</script>

<section class="gallery" aria-labelledby="gallery-themes-title" data-tx-theme-gallery>
  <header class="intro">
    <h1 id="gallery-themes-title">Theme gallery</h1>
    <p class="lead">
      Every library theme as a live preview with its palette and WCAG 2.x AA contrast scores.
      Apply one click to use it site-wide (no flash on the next load).
    </p>
    <p class="summary" role="status">
      {themeCount} themes · {passCount} AA pass · {failCount} with issues · showing {visible.length} of {matchCount}
      {#if ready}
        · active <strong>{activeThemeId}</strong> / <strong>{activeMode}</strong>
      {/if}
    </p>
  </header>

  <div class="controls">
    <div class="field">
      <span class="label" id="preview-mode-label">Card preview mode</span>
      <ToggleGroup
        type="single"
        value={previewMode}
        onValueChange={onPreviewMode}
        variant="outline"
        size="sm"
        aria-labelledby="preview-mode-label"
      >
        <ToggleGroupItem value="light">Light</ToggleGroupItem>
        <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
        <ToggleGroupItem value="high-contrast">High contrast</ToggleGroupItem>
      </ToggleGroup>
    </div>
    <div class="field">
      <span class="label" id="pass-filter-label">AA status</span>
      <ToggleGroup
        type="single"
        value={passFilter}
        onValueChange={onPassFilter}
        variant="outline"
        size="sm"
        aria-labelledby="pass-filter-label"
      >
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        <ToggleGroupItem value="pass">Pass</ToggleGroupItem>
        <ToggleGroupItem value="fail">Issues</ToggleGroupItem>
      </ToggleGroup>
    </div>
    <div class="field grow">
      <label class="label" for="gallery-filter">Find a theme</label>
      <Input
        id="gallery-filter"
        type="search"
        placeholder="Name, id, category or tag"
        bind:value={query}
        autocomplete="off"
        clearable
        clearLabel="Clear gallery filter"
      />
    </div>
  </div>

  <ul class="grid" bind:this={grid}>
    {#each visible as card (card.id)}
      {@const score = scoreFor(card, previewMode)}
      {@const dots = card.swatches[previewMode]}
      <li class="grid-item">
      <article
        class="card"
        class:active={card.id === activeThemeId}
        class:fail={!card.pass}
        data-theme-id={card.id}
        data-gallery-pass={card.pass ? 'true' : 'false'}
      >
        <!-- Decorative live sample; scores and Apply controls carry the accessible meaning. -->
        <div
          class="preview"
          data-tx-theme={card.id}
          data-tx-mode={previewMode}
          data-preview-surface
          {@attach loadThemeCssWhenVisible(card.id)}
          aria-hidden="true"
        >
          <div class="preview-chrome">
            <span class="chip primary">Primary</span>
            <span class="chip accent">Accent</span>
            <span class="chip muted">Muted</span>
          </div>
          <p class="preview-text">The quick brown fox — Aa 123</p>
          <div class="swatch-row" data-tx-swatch-primary={dots.primary}>
            <span class="dot" style:background={dots.background} title="background"></span>
            <span class="dot" style:background={dots.foreground} title="foreground"></span>
            <span class="dot" style:background={dots.primary} title="primary"></span>
            <span class="dot" style:background={dots.accent} title="accent"></span>
            <span class="dot" style:background={dots.muted} title="muted"></span>
            <span class="dot" style:background={dots.border} title="border"></span>
          </div>
        </div>

        <div class="body">
          <header class="card-head">
            <h2 class="name">{card.name}</h2>
            <p class="id">{card.id}</p>
            <p class="meta">{card.category} · {card.collection} · {card.contrastLevel}</p>
          </header>

          <div class="scores" role="group" aria-label={`${card.name} contrast scores`}>
            {#each card.scores as modeScore (modeScore.mode)}
              <div class="score-row" data-mode={modeScore.mode} data-pass={modeScore.pass}>
                <span class="mode-label">{modeScore.mode}</span>
                <span class="mode-value">
                  {#if modeScore.pass}
                    <span class="badge pass">AA pass</span>
                  {:else if modeScore.skippedCount > 0 && modeScore.checkedCount === 0}
                    <span class="badge skip">system colors</span>
                  {:else}
                    <span class="badge fail"
                      >{modeScore.issueCount} issue{modeScore.issueCount === 1 ? '' : 's'}</span
                    >
                  {/if}
                  <span class="ratio">
                    text {formatRatio(modeScore.worstTextRatio)} · ui {formatRatio(
                      modeScore.worstUiRatio
                    )}
                  </span>
                </span>
              </div>
            {/each}
          </div>

          <div class="actions">
            <button
              type="button"
              class="apply"
              data-apply-theme={card.id}
              data-apply-mode={previewMode}
              aria-label={`Apply ${previewMode} — ${card.name}`}
              onclick={() => apply(card.id, previewMode)}
            >
              Apply {previewMode}
            </button>
            {#if previewMode !== 'dark'}
              <button
                type="button"
                class="apply secondary"
                data-apply-theme={card.id}
                data-apply-mode="dark"
                aria-label={`Apply dark — ${card.name}`}
                onclick={() => apply(card.id, 'dark')}
              >
                Apply dark
              </button>
            {/if}
            {#if previewMode !== 'light'}
              <button
                type="button"
                class="apply secondary"
                data-apply-theme={card.id}
                data-apply-mode="light"
                aria-label={`Apply light — ${card.name}`}
                onclick={() => apply(card.id, 'light')}
              >
                Apply light
              </button>
            {/if}
          </div>
          {#if score && !score.pass && score.issueCount > 0}
            <p class="hint">{score.issueCount} pair{score.issueCount === 1 ? '' : 's'} below AA in {previewMode}.</p>
          {/if}
        </div>
      </article>
      </li>
    {:else}
      <li class="grid-item"><p class="empty" role="status">No themes match the current filters.</p></li>
    {/each}
  </ul>
  {#if remaining > 0}
    <div class="more">
      <p class="more__count" role="status">{remaining} of {matchCount} themes hidden to keep the page light.</p>
      <div class="more__buttons">
        <Button variant="outline" onclick={showMore}>
          Show {Math.min(PAGE_SIZE, remaining)} more
        </Button>
        <Button variant="ghost" onclick={showAll}>
          Show all {matchCount} themes
        </Button>
      </div>
    </div>
  {/if}
</section>

<style>
  .more {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .more__count {
    margin: 0;
    color: var(--tx-muted-foreground);
    font-size: 0.875rem;
  }
  .more__buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
  .gallery {
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
    color: var(--tx-foreground);
    font-size: 1.05rem;
    max-inline-size: 42rem;
  }
  .summary {
    margin: 0.75rem 0 0;
    font-size: 0.95rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: end;
  }
  .field {
    display: grid;
    gap: 0.35rem;
    justify-items: start;
  }
  .field.grow {
    flex: 1 1 14rem;
    min-inline-size: 12rem;
  }
  .label {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* A real list item (not display: contents, which drops list semantics in some browsers). */
  .grid-item {
    display: grid;
  }
  .card {
    display: grid;
    grid-template-rows: auto 1fr;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, var(--tx-background));
    overflow: hidden;
    color: var(--tx-foreground);
  }
  .card.active {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .card.fail {
    border-color: color-mix(in oklab, var(--tx-destructive, #b91c1c) 45%, var(--tx-border));
  }
  .preview {
    padding: 1rem;
    background: var(--tx-background);
    color: var(--tx-foreground);
    border-block-end: 1px solid var(--tx-border);
    min-block-size: 7.5rem;
  }
  .preview-chrome {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-block-end: 0.75rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    min-block-size: 1.75rem;
    padding-inline: 0.55rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .chip.primary {
    background: var(--tx-primary);
    color: var(--tx-primary-foreground);
  }
  .chip.accent {
    background: var(--tx-accent);
    color: var(--tx-accent-foreground);
  }
  .chip.muted {
    background: var(--tx-muted);
    color: var(--tx-muted-foreground);
  }
  .preview-text {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
  }
  .swatch-row {
    display: flex;
    gap: 0.35rem;
  }
  .dot {
    inline-size: 1rem;
    block-size: 1rem;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, CanvasText 30%, transparent);
  }
  /* Dot fills are inline hex from card.swatches[previewMode] — that theme's palette. */
  .body {
    display: grid;
    gap: 0.75rem;
    padding: 0.9rem 1rem 1rem;
  }
  .card-head .name {
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.25;
  }
  .id,
  .meta {
    margin: 0.15rem 0 0;
    font-size: 0.8125rem;
    color: var(--tx-foreground);
  }
  .scores {
    margin: 0;
    display: grid;
    gap: 0.35rem;
  }
  .score-row {
    display: grid;
    grid-template-columns: 7.5rem 1fr;
    gap: 0.35rem;
    align-items: baseline;
    font-size: 0.8125rem;
  }
  .mode-label {
    font-weight: 600;
    text-transform: capitalize;
    color: var(--tx-foreground);
  }
  .mode-value {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.5rem;
    align-items: center;
  }
  .badge {
    display: inline-flex;
    padding: 0.15rem 0.45rem;
    border-radius: 0.25rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    border: 1px solid var(--tx-border);
  }
  .badge.pass {
    background: var(--tx-secondary, var(--tx-muted));
    color: var(--tx-secondary-foreground, var(--tx-foreground));
    border-color: var(--tx-border-strong, var(--tx-border));
  }
  .badge.fail {
    background: var(--tx-destructive);
    color: var(--tx-destructive-foreground);
    border-color: var(--tx-destructive);
  }
  .badge.skip {
    background: var(--tx-muted);
    color: var(--tx-foreground);
  }
  .ratio {
    color: var(--tx-foreground);
    font-variant-numeric: tabular-nums;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .apply {
    appearance: none;
    margin: 0;
    min-block-size: 2.25rem;
    padding-inline: 0.75rem;
    border-radius: var(--tx-radius, 0.375rem);
    border: 1px solid var(--tx-border);
    background: var(--tx-primary);
    color: var(--tx-primary-foreground);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }
  .apply.secondary {
    background: var(--tx-secondary, var(--tx-muted));
    color: var(--tx-secondary-foreground, var(--tx-foreground));
  }
  .apply:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-foreground);
  }
  .empty {
    grid-column: 1 / -1;
    margin: 1rem 0;
    color: var(--tx-foreground);
  }
</style>
