<script lang="ts">
import DeckDemo from './DeckDemo.svelte';
import { reviewDeck } from './samples.ts';
</script>

<DeckDemo deck={reviewDeck()} initialSlideId="demo" label="Review template" />
