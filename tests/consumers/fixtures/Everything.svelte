<script lang="ts">
/**
 * The tarball-mode root: the smoke controls, one component per UI package
 * and the every-subpath list. Registry mode mounts Smoke.svelte alone.
 */
import Packages from './Packages.svelte';
import Smoke from './Smoke.svelte';
import Universe from './Universe.svelte';
</script>

<Smoke />
<Packages />
<Universe />
