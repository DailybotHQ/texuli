<script lang="ts">
// A stand-in for `@texuli/player` in the G123 loader tests: it shows the
// label it was handed and the blueprint root id, as text.
let { label, blueprint }: { label: string; blueprint: { id: string } } = $props();
</script>

<p class="player-stub" data-player-stub={blueprint.id}>{label}</p>
