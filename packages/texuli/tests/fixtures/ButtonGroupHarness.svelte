<script lang="ts">
import { Button, ButtonGroup } from '../../src/components/button/index.ts';

let {
  label = 'Group',
  orientation = 'horizontal' as 'horizontal' | 'vertical',
}: {
  label?: string;
  orientation?: 'horizontal' | 'vertical';
} = $props();
</script>

<ButtonGroup {label} {orientation}>
  <Button variant="outline">Left</Button>
  <Button variant="outline">Center</Button>
  <Button variant="outline">Right</Button>
</ButtonGroup>
