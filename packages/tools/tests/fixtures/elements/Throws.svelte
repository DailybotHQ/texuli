<script lang="ts">
/** Refuses its props on purpose, like a chart given an invalid series. */
let { name }: { name: string } = $props();
if (name !== 'ok') throw new TypeError(`Unknown name: ${name}`);
</script>

<p>{name}</p>
