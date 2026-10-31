<script lang="ts">
import { getDesignDefaults } from '../../src/defaults/index.ts';

const defaults = getDesignDefaults('button');
</script>

<output data-testid="defaults">{JSON.stringify(defaults)}</output>
