<script lang="ts">
import DeckDemo from './DeckDemo.svelte';
import { fragmentsDeck } from './samples.ts';
</script>

<DeckDemo deck={fragmentsDeck()} initialSlideId="plan" initialStep={2} label="Reveal steps" />
