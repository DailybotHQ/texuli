<script lang="ts">
/** Catalog components on slides, painted through the player at the untrusted tier. The deck is built in the browser, so it never inflates the page HTML. */
import { COMPONENT_GALLERY, componentsDeck } from './decks.ts';
import GalleryStage from './GalleryStage.svelte';

const deck = componentsDeck();
</script>

<GalleryStage {deck} entries={COMPONENT_GALLERY} label="Components on slides" name="components" />
