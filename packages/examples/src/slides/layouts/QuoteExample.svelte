<script lang="ts">
import LayoutDeckDemo from '../LayoutDeckDemo.svelte';
import { layoutExampleDeck } from '../layout-samples.ts';
</script>

<LayoutDeckDemo deck={layoutExampleDeck('quote')} label="The quote layout" />
