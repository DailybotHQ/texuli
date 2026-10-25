<script lang="ts">
// The sample scenario with two bugs on purpose (self test only): focus is not
// returned on close, and the scroll lock is never released.
import Sample from './scenario.svelte';
</script>

<Sample broken />
