<script lang="ts">
import { Avatar } from '../../src/avatar/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Avatar.Root {...p('avatar/AvatarRoot')} bind:ref={refs['avatar/AvatarRoot']}>
  <Avatar.Image src="https://example.com/a.png" alt="Ada" {...p('avatar/AvatarImage')} bind:ref={refs['avatar/AvatarImage']} />
  <Avatar.Fallback {...p('avatar/AvatarFallback')} bind:ref={refs['avatar/AvatarFallback']}>AE</Avatar.Fallback>
</Avatar.Root>
