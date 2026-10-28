<script lang="ts">
/**
 * The `item` renderer: a `::: component` placed on a free slide. The stage
 * wraps it in its fragment element (the item's `step`, `fragment`, `tone`),
 * so reveal steps need nothing here; this paints the catalog component.
 */
import { slideStateKey } from '../registry/state.ts';
import type { DeckItemRendererProps } from '../stage/renderers.ts';
import CatalogNode from './CatalogNode.svelte';

let { item, path, context }: DeckItemRendererProps = $props();
let label = $derived(item.id ?? item.component);
let key = $derived(slideStateKey(context.deck.slides[context.index]?.id ?? 'slide', path));
</script>

<CatalogNode
  id={item.component}
  props={item.props as Record<string, unknown>}
  {context}
  stateKey={key}
  {label}
  height={item.height ?? 'md'}
/>
