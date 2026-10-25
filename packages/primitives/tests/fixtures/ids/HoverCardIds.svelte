<script lang="ts">
import {
  HoverCardContent,
  HoverCardRoot,
  HoverCardTrigger,
} from '../../../src/hover-card/index.ts';
</script>

<HoverCardRoot open>
  <HoverCardTrigger id="profile-trigger">Sam Chen</HoverCardTrigger>
  <HoverCardContent id="profile-card" aria-label="Profile preview">
    <p>Sam Chen, product designer</p>
  </HoverCardContent>
</HoverCardRoot>
