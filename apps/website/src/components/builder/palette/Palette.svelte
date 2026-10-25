<script lang="ts">
import {
  AVAILABILITY_NOTES,
  groupPalette,
  moveActive,
  type PaletteEntry,
  paletteCountText,
  searchPalette,
} from './model.ts';

/**
 * Manifest-driven component palette: an APG editable combobox with list
 * autocomplete and automatic selection, whose listbox is always shown.
 * Focus stays in the search box; typing makes the first insertable match
 * active, Arrow keys move the active option (`aria-activedescendant`),
 * Enter inserts it, Escape clears the search. Unavailable entries stay
 * listed as disabled options.
 */
let {
  entries,
  oninsert,
  heading = 'Palette',
  searchId,
}: {
  entries: readonly PaletteEntry[];
  oninsert: (id: string) => void;
  heading?: string;
  /** Id for the search box, when the host links to it. */
  searchId?: string;
} = $props();

const uid = $props.id();
const headingId = `${uid}-heading`;
const inputId = $derived(searchId ?? `${uid}-search`);
const listId = `${uid}-list`;
const optionId = (id: string) => `${uid}-option-${id}`;

let query = $state('');
let active = $state(-1);
let message = $state('');

const results = $derived(searchPalette(entries, query));
const groups = $derived(groupPalette(results));
// Option order in the DOM equals the grouped order, so keyboard order matches reading order.
const ordered = $derived(groups.flatMap((section) => section.entries));
const activeEntry = $derived(active >= 0 ? ordered[active] : undefined);
const count = $derived(paletteCountText(results.length, entries.length));

// Automatic selection: while a query is typed, the first insertable match is active.
$effect(() => {
  active = query.trim() ? ordered.findIndex((entry) => entry.availability === 'insertable') : -1;
});

function choose(entry: PaletteEntry) {
  if (entry.availability !== 'insertable') {
    message = `${entry.label} cannot be inserted. ${AVAILABILITY_NOTES[entry.availability]}`;
    return;
  }
  message = `Inserted ${entry.label}.`;
  oninsert(entry.id);
}

function onkeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    active = moveActive(active, ordered.length, event.key === 'ArrowDown' ? 1 : -1);
    document
      .getElementById(optionId(ordered[active]?.id ?? ''))
      ?.scrollIntoView({ block: 'nearest' });
  } else if (event.key === 'Enter') {
    const target = activeEntry;
    if (!target) return;
    event.preventDefault();
    choose(target);
  } else if (event.key === 'Escape' && query !== '') {
    event.preventDefault();
    query = '';
    active = -1;
    message = '';
  }
}

function oninput() {
  message = '';
}
</script>

<section class="palette" aria-labelledby={headingId} data-tx-palette>
  <h2 id={headingId}>{heading}</h2>
  <label class="palette__label" for={inputId}>Search components</label>
  <input
    id={inputId}
    class="palette__search"
    type="text"
    role="combobox"
    autocomplete="off"
    spellcheck="false"
    aria-expanded="true"
    aria-controls={listId}
    aria-autocomplete="list"
    aria-activedescendant={activeEntry ? optionId(activeEntry.id) : undefined}
    aria-describedby={`${uid}-hint`}
    bind:value={query}
    {oninput}
    {onkeydown}
  />
  <p id={`${uid}-hint`} class="palette__hint">
    Arrow keys choose a component, Enter inserts it, Escape clears the search.
  </p>
  <p class="palette__count" role="status" aria-live="polite" data-palette-count>
    {message || count}
  </p>
  <!-- The combobox owns navigation (aria-activedescendant); the scrolling list is not a second Tab stop. -->
  <div id={listId} class="palette__list" role="listbox" aria-labelledby={headingId} tabindex="-1">
    {#each groups as section (section.group)}
      <div class="palette__group" role="group" aria-label={section.group}>
        <div class="palette__group-label" aria-hidden="true">{section.group}</div>
        {#each section.entries as entry (entry.id)}
          {@const unavailable = entry.availability !== 'insertable'}
          <!-- Pointer insert; keyboard users reach options through the combobox. -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            id={optionId(entry.id)}
            class="palette__option"
            class:palette__option--active={activeEntry?.id === entry.id}
            role="option"
            tabindex="-1"
            aria-selected={activeEntry?.id === entry.id}
            aria-disabled={unavailable ? 'true' : undefined}
            data-palette-option={entry.id}
            data-availability={entry.availability}
            onpointerdown={(event) => event.preventDefault()}
            onclick={() => choose(entry)}
          >
            <span class="palette__option-label">{entry.label}</span>
            <span class="palette__option-summary">{entry.summary}</span>
            <span class="palette__badges">
              <span class="palette__badge">Tier U · {entry.tier}</span>
              <span class="palette__badge">
                {entry.requiredProps === 1 ? '1 required prop' : `${entry.requiredProps} required props`}
              </span>
            </span>
            {#if unavailable}
              <span class="palette__note">{AVAILABILITY_NOTES[entry.availability as Exclude<typeof entry.availability, 'insertable'>]}</span>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</section>

<style>
  .palette {
    display: grid;
    gap: 0.5rem;
    min-inline-size: 0;
  }
  h2 {
    margin: 0;
    font-size: 1rem;
  }
  .palette__label {
    font-size: 0.875rem;
    font-weight: 600;
  }
  .palette__search {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.55rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    color: inherit;
    background: var(--tx-background, Canvas);
  }
  .palette__search:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .palette__hint,
  .palette__count {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.8125rem;
  }
  .palette__list {
    display: grid;
    gap: 0.75rem;
    max-block-size: 32rem;
    overflow-y: auto;
  }
  .palette__group {
    display: grid;
    gap: 0.25rem;
  }
  .palette__group-label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tx-muted-foreground, GrayText);
  }
  .palette__option {
    display: grid;
    gap: 0.2rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    cursor: pointer;
  }
  .palette__option--active {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 1px;
  }
  .palette__option[aria-disabled='true'] {
    cursor: not-allowed;
    border-style: dashed;
  }
  .palette__option-label {
    font-weight: 600;
  }
  .palette__option-summary,
  .palette__note {
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .palette__badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .palette__badge {
    padding-inline: 0.4rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 999px;
    font-size: 0.75rem;
  }
  @media (forced-colors: active) {
    .palette__option--active {
      outline-color: Highlight;
    }
  }
</style>
