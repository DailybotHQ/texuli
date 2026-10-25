<script lang="ts">
/** A tiny component for the custom elements tests. */
let { name, oninvalid: _oninvalid }: { name: string; oninvalid?: unknown } = $props();
</script>

<p class="greeting">Hello, {name}.</p>
