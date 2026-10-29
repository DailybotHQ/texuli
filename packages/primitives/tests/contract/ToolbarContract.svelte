<script lang="ts">
import { Toolbar } from '../../src/toolbar/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Toolbar.Root aria-label="Formatting" {...p('toolbar/Root')} bind:ref={refs['toolbar/Root']}>
  <Toolbar.Group type="multiple" aria-label="Style" {...p('toolbar/Group')} bind:ref={refs['toolbar/Group']}>
    <Toolbar.GroupItem value="bold">Bold</Toolbar.GroupItem>
    <Toolbar.GroupItem value="italic" {...p('toolbar/GroupItem')} bind:ref={refs['toolbar/GroupItem']}>Italic</Toolbar.GroupItem>
  </Toolbar.Group>
  <Toolbar.Separator {...p('toolbar/Separator')} bind:ref={refs['toolbar/Separator']} />
  <Toolbar.Button {...p('toolbar/Button')} bind:ref={refs['toolbar/Button']}>Save</Toolbar.Button>
  <Toolbar.Link href="https://example.com/help" {...p('toolbar/Link')} bind:ref={refs['toolbar/Link']}>Help</Toolbar.Link>
</Toolbar.Root>
