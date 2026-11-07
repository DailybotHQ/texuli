<script lang="ts">
import { type IconRegistry, IconsProvider } from 'texuli/icons';
import { layoutRenderers } from '../../src/layouts/index.ts';
import DeckStage from '../../src/stage/DeckStage.svelte';

let { deck, icons }: { deck: unknown; icons: IconRegistry } = $props();
</script>

<IconsProvider {icons}>
  <DeckStage deck={deck as never} renderers={layoutRenderers} syncHash={false} loadTheme={null} />
</IconsProvider>
