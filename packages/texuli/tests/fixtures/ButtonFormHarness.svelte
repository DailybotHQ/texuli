<script lang="ts">
import { Button } from '../../src/components/button/index.ts';

let {
  onclick,
  onsubmit,
}: {
  onclick?: (event: MouseEvent) => unknown;
  onsubmit?: (event: SubmitEvent) => void;
} = $props();
</script>

<form
  onsubmit={(event) => {
    event.preventDefault();
    onsubmit?.(event);
  }}
>
  <Button type="submit" {onclick}>Send</Button>
</form>
