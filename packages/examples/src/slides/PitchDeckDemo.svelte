<script lang="ts">
import DeckDemo from './DeckDemo.svelte';
import { pitchDeck } from './samples.ts';
</script>

<DeckDemo deck={pitchDeck()} initialSlideId="solution" label="Pitch template" />
