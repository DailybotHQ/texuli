<script lang="ts">
import type { Theme } from '@texuli/tokens/contract';
import type { ResolvedColorMode } from '@texuli/tokens/modes';
import { tick } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { type DeckPrintNotes, type DeckPrintPlan, planDeckPrint } from '../export/index.ts';
import { catalogIdForBlock } from '../grammar/index.ts';
import type { Deck, DeckThemeReference } from '../model/index.ts';
import { resolveSlideMaster, resolveSlideTheme } from '../model/index.ts';
import { loadDeckBlockFamily } from './loaders.ts';
import { type DeckMediaTrust, settleDeckImages } from './media.ts';
import SlideContent from './SlideContent.svelte';
import {
  createDeckThemeCache,
  type DeckThemeLoader,
  deckCatalogThemeIds,
  deckThemeVariables,
  loadDeckLibraryTheme,
} from './theme.ts';

interface Props {
  deck: Deck;
  /** Speaker notes: slides only, a notes appendix, or a titles-and-notes handout. */
  notes?: DeckPrintNotes;
  /** Same contract as `DeckStage`; `null` leaves catalog themes to host CSS. */
  loadTheme?: DeckThemeLoader | null;
  /** Hide on screen and replace the interactive stage when printing. */
  printOnly?: boolean;
  /** Called once block families, themes and images are loaded and painted. */
  onReady?: (plan: DeckPrintPlan) => void;
  /** URL policy tier for media at paint; keep `untrusted` for agent decks. */
  mediaTrust?: DeckMediaTrust;
  resolveAvatar?: (id: string) => string | undefined;
  /** Longest wait for images before reporting ready anyway. */
  mediaTimeoutMs?: number;
}

let {
  deck,
  notes = 'none',
  loadTheme = loadDeckLibraryTheme,
  printOnly = false,
  mediaTrust = 'untrusted',
  resolveAvatar,
  mediaTimeoutMs = 10_000,
  onReady,
}: Props = $props();

let plan = $derived(planDeckPrint(deck, { notes }));
let slidesById = $derived(new Map(deck.slides.map((slide) => [slide.id, slide])));
let themes = $state.raw<Record<string, Theme | null>>({});
let ready = $state(false);
let rootElement: HTMLElement | undefined = $state();

// Paper defaults to light: a `system` or missing mode prints light, explicit modes hold.
function printMode(ref: DeckThemeReference | undefined): ResolvedColorMode {
  return ref?.mode === 'dark' || ref?.mode === 'high-contrast' ? ref.mode : 'light';
}

function themeFor(ref: DeckThemeReference | undefined): Theme | undefined {
  if (ref?.kind === 'embedded') return ref.theme;
  if (ref?.kind === 'catalog') return themes[ref.id] ?? undefined;
  return undefined;
}

function themeId(ref: DeckThemeReference | undefined): string | undefined {
  return ref?.kind === 'catalog' ? ref.id : ref?.theme.id;
}

function applyTheme(ref: DeckThemeReference | undefined): Attachment<HTMLElement> {
  const theme = themeFor(ref);
  const mode = printMode(ref);
  return (element) => {
    if (!theme) return;
    const vars = deckThemeVariables(theme, mode, { reducedMotion: true });
    for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) element.style.removeProperty(name);
    };
  };
}

// Preload every block family and catalog theme the printed pages need, then
// report readiness so a host prints a complete document.
$effect(() => {
  const currentPlan = plan;
  const currentDeck = deck;
  const loader = loadTheme;
  let active = true;
  ready = false;
  const families = new Set(
    currentPlan.pages.flatMap((page) =>
      page.kind === 'slide'
        ? (slidesById.get(page.slideId)?.blocks ?? []).map((block) => catalogIdForBlock(block.type))
        : []
    )
  );
  const cache = loader ? createDeckThemeCache(loader) : null;
  const ids = cache ? deckCatalogThemeIds(currentDeck) : [];
  void Promise.all([
    Promise.all([...families].map((id) => loadDeckBlockFamily(id).catch(() => null))),
    Promise.all(ids.map(async (id) => [id, await cache?.load(id)] as const)),
  ]).then(async ([, loaded]) => {
    if (!active) return;
    themes = Object.fromEntries(loaded.map(([id, theme]) => [id, theme ?? null]));
    // Let block families mount, then load every image eagerly before printing.
    await tick();
    await Promise.resolve();
    await tick();
    if (rootElement) await settleDeckImages(rootElement, mediaTimeoutMs);
    if (!active) return;
    ready = true;
    onReady?.(currentPlan);
  });
  return () => {
    active = false;
  };
});
</script>

<div
  bind:this={rootElement}
  class="tx-deck-print"
  role="document"
  aria-label={`Print: ${plan.title}`}
  data-aspect={plan.pageSize.aspect}
  data-notes={plan.notes}
  data-print-only={printOnly ? 'true' : undefined}
  data-print-ready={ready ? 'true' : 'false'}
  data-tx-theme={themeId(deck.meta.themeRef)}
  data-tx-mode={printMode(deck.meta.themeRef)}
  {@attach applyTheme(deck.meta.themeRef)}
>
  {#each plan.pages as page (`${page.kind}:${page.slideId}`)}
    {@const slide = slidesById.get(page.slideId)}
    {#if page.kind === 'slide' && slide}
      {@const ref = resolveSlideTheme(deck, slide)}
      <section
        class="tx-deck-print__slide"
        data-slide-id={slide.id}
        data-aspect={plan.pageSize.aspect}
        data-arrangement={resolveSlideMaster(slide.master).arrangement}
        data-tx-theme={themeId(ref)}
        data-tx-mode={printMode(ref)}
        aria-label={`Slide ${page.index + 1}: ${page.label}`}
        {@attach applyTheme(ref)}
      >
        {#if slide.title}
          <h2 class="tx-deck-stage__slide-title">{slide.title}</h2>
        {/if}
        <SlideContent {slide} {mediaTrust} {resolveAvatar} showEmpty={false} />
      </section>
    {:else if page.kind === 'notes'}
      <section
        class="tx-deck-print__notes"
        data-slide-id={page.slideId}
        aria-label={`Notes for slide ${page.index + 1}: ${page.label}`}
      >
        <h2 class="tx-deck-print__notes-title">{page.index + 1}. {page.label}</h2>
        {#if page.notes}
          <p class="tx-deck-stage__notes-text">{page.notes}</p>
        {:else}
          <p class="tx-deck-stage__empty">No notes for this slide.</p>
        {/if}
      </section>
    {/if}
  {/each}
</div>
