<script lang="ts">
import { Switch } from '../src/switch/index.ts';

let { onCheckedChange }: { onCheckedChange?: (checked: boolean) => void } = $props();
</script>

<Switch.Root id="digest" defaultChecked {onCheckedChange}>
  <Switch.Thumb />
</Switch.Root>
<label for="digest">Weekly digest</label>
