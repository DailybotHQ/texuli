<script lang="ts">
/** The 13 background presets and one spec of each kind, each with its contrast scrim. The deck is built in the browser, so it never inflates the page HTML. */
import { BACKGROUND_GALLERY, backgroundGalleryDeck } from './decks.ts';
import GalleryStage from './GalleryStage.svelte';

const deck = backgroundGalleryDeck();
</script>

<GalleryStage {deck} entries={BACKGROUND_GALLERY} label="Backgrounds" name="backgrounds" />
