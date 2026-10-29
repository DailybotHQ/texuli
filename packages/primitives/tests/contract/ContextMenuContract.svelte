<script lang="ts">
import { ContextMenu } from '../../src/context-menu/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<ContextMenu.Root open>
  <ContextMenu.Trigger {...p('context-menu/Trigger')} bind:ref={refs['context-menu/Trigger']}>Area</ContextMenu.Trigger>
  <ContextMenu.Content {...p('context-menu/Content')} bind:ref={refs['context-menu/Content']}>
    <ContextMenu.Item>Copy</ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu.Root>
