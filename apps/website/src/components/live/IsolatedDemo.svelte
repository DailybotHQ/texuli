<script lang="ts">
/**
 * Lazy entry for an isolated preview on component pages: a full-page layout
 * (inert, with a link to its document) or a framed id (operable in place).
 * Only LiveDemo imports this (dynamically): a module imported both lazily and
 * statically makes the bundler share a namespace helper that drags an
 * unrelated chunk into the page, so the shared IsolatedStage stays static.
 */
import IsolatedStage from './IsolatedStage.svelte';

type Props = {
  componentId: string;
  values: Readonly<Record<string, unknown>>;
  height: 'sm' | 'md' | 'lg' | 'xl';
  fullPage: boolean;
};

let { componentId, values, height, fullPage }: Props = $props();
</script>

<IsolatedStage {componentId} {values} {height} {fullPage} />
