<script lang="ts">
import { type Component, onMount } from 'svelte';
import { Command } from 'texuli/command';

/**
 * Site-wide ⌘/Ctrl+K search. The header ships only the trigger and the
 * shortcut; the palette and its static index (`SitePalette.svelte`) load on
 * first use, then the palette handles the shortcut itself.
 */

type Props = {
  /** Astro `import.meta.env.BASE_URL`. */
  base?: string;
  /** Open on first paint (search page). */
  initiallyOpen?: boolean;
  /** Show the header trigger button. */
  showTrigger?: boolean;
  /** Slim header: a search glyph, collapsing to the glyph alone on narrow phones. */
  compact?: boolean;
};

let { base = '/', initiallyOpen = false, showTrigger = true, compact = false }: Props = $props();

type PaletteProps = { base?: string; open?: boolean };

let open = $state(false);
let loading = $state(false);
let Palette = $state<Component<PaletteProps, object, 'open'> | null>(null);

/** Loads the palette once, then opens it. */
async function openPalette(): Promise<void> {
  if (!Palette) {
    loading = true;
    try {
      Palette = (await import('./SitePalette.svelte')).default;
    } finally {
      loading = false;
    }
  }
  open = true;
}

// Until the palette is loaded, the shortcut is ours; afterwards the palette owns it.
function onKeydown(event: KeyboardEvent): void {
  if (Palette || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
  event.preventDefault();
  void openPalette();
}

onMount(() => {
  if (initiallyOpen) void openPalette();
});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="site-search" data-tx-site-search="">
  {#if showTrigger}
    <Command.Trigger
      label="Search the site"
      keys={['⌘', 'K']}
      icon={compact}
      collapse={compact ? 'narrow' : 'never'}
      aria-busy={loading ? 'true' : undefined}
      aria-haspopup="dialog"
      onclick={() => openPalette()}
    />
  {/if}
  {#if Palette}
    <Palette bind:open {base} />
  {/if}
</div>

<style>
  .site-search {
    display: inline-flex;
    align-items: center;
  }
  .site-search :global([data-tx-command-trigger]) {
    min-block-size: 2.75rem;
  }
</style>
