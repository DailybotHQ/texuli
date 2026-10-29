<script lang="ts">
import type { HrefTrust } from '@texuli/core/url-policy';
import {
  Avatar,
  AvatarGroup,
  type AvatarGroupItem,
  type AvatarSize,
  type AvatarStatus,
} from '../../src/components/avatar/index.ts';

interface Props {
  mode?: 'single' | 'group';
  name?: string;
  src?: string | null;
  srcTrust?: HrefTrust;
  srcset?: string | null;
  sizes?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  decorative?: boolean;
  items?: readonly AvatarGroupItem[];
  max?: number;
  label?: string;
}

let {
  mode = 'single',
  name = 'Ada Example',
  src = null,
  srcTrust = 'untrusted',
  srcset,
  sizes,
  size = 'md',
  status,
  decorative = false,
  items = [],
  max,
  label = 'Team',
}: Props = $props();
</script>

{#if mode === 'group'}
  <AvatarGroup {items} {max} {size} {label} />
{:else}
  <Avatar {name} {src} {srcTrust} {srcset} {sizes} {size} {status} {decorative} />
{/if}
