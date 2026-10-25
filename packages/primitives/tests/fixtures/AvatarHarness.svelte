<script lang="ts">
import type { HrefTrust } from '@texuli/core/url-policy';
import { Avatar } from '../../src/avatar/index.ts';
import type { AvatarImageLoadingStatus } from '../../src/avatar/types.ts';

let {
  src = null as string | null,
  srcTrust = 'untrusted' as HrefTrust,
  delayMs = 0,
  alt = '',
  loadingStatus = $bindable('loading' as AvatarImageLoadingStatus),
  onLoadingStatusChange,
}: {
  src?: string | null;
  srcTrust?: HrefTrust;
  delayMs?: number;
  alt?: string;
  loadingStatus?: AvatarImageLoadingStatus;
  onLoadingStatusChange?: (status: AvatarImageLoadingStatus) => void;
} = $props();
</script>

<Avatar.Root
  {delayMs}
  bind:loadingStatus
  {onLoadingStatusChange}
  aria-label="Portrait"
  data-testid="avatar-root"
>
  <Avatar.Image {src} {srcTrust} {alt} />
  <Avatar.Fallback>AE</Avatar.Fallback>
</Avatar.Root>
