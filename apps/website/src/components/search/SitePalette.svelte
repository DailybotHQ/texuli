<script lang="ts">
import { type CommandItemData, CommandPalette } from 'texuli/command';
import { withBase } from '../foundation/site.ts';
import { SEARCH_INDEX, SEARCH_KIND_LABEL } from './index-data.ts';
import { defaultRecentEntries, searchSiteIndex } from './search.ts';
import type { SearchEntry } from './types.ts';

/**
 * The site search palette with its static index. `SiteSearch` loads this on
 * the first press of the trigger or of ⌘/Ctrl+K, so pages ship only the
 * trigger until someone searches. Selecting a hit navigates with a
 * same-origin location assign (no network API).
 */

type Props = {
  /** Astro `import.meta.env.BASE_URL`. */
  base?: string;
  open?: boolean;
};

let { base = '/', open = $bindable(false) }: Props = $props();

const recentSource = defaultRecentEntries(SEARCH_INDEX);
const recentItems: CommandItemData[] = recentSource.map(toCommandItem);

function toCommandItem(entry: SearchEntry): CommandItemData {
  return {
    id: entry.id,
    label: entry.title,
    description: `${SEARCH_KIND_LABEL[entry.kind]} · ${entry.description}`,
    group: SEARCH_KIND_LABEL[entry.kind],
    keywords: entry.keywords,
  };
}

function search(query: string): CommandItemData[] {
  return searchSiteIndex(query, { limit: 32 }).map(toCommandItem);
}

function onSelect(item: CommandItemData): void {
  const entry = SEARCH_INDEX.find((row) => row.id === item.id);
  if (!entry) return;
  const href = withBase(base, entry.href);
  open = false;
  // Same-origin navigation only.
  if (typeof location !== 'undefined') {
    location.assign(href);
  }
}
</script>

<CommandPalette
  bind:open
  {search}
  {recentItems}
  {onSelect}
  shortcut
  title="Search Texuli"
  description="Find docs, components, themes and examples. Arrow keys to move, Enter to open."
  placeholder="Search docs, components, themes…"
  recentLabel="Suggested"
  emptyLabel="No matches in the static index."
  size="md"
  variant="outline"
/>
