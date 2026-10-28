<script lang="ts">
/** The 20 catalog layouts, each painting its own catalog sample. The deck is built in the browser, so it never inflates the page HTML. */
import { LAYOUT_GALLERY, layoutGalleryDeck } from './decks.ts';
import GalleryStage from './GalleryStage.svelte';

const deck = layoutGalleryDeck();
</script>

<GalleryStage {deck} entries={LAYOUT_GALLERY} label="Layouts" name="layouts" />
