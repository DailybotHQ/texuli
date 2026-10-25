<script lang="ts">
// Tabs scenario: @texuli/primitives Tabs public API only.
import { Tabs } from '@texuli/primitives/tabs';
import { behaviorEvent } from '../../harness/client/events.ts';

// `?value=` starts on another tab (the tab-stop rows use it).
let value = $state(new URLSearchParams(location.search).get('value') ?? 'profile');
</script>

<Tabs.Root bind:value onValueChange={(next) => behaviorEvent('valueChange', next)}>
  <Tabs.List aria-label="Account">
    <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
    <Tabs.Trigger value="security">Security</Tabs.Trigger>
    <Tabs.Trigger value="billing" disabled>Billing</Tabs.Trigger>
    <Tabs.Trigger value="team">Team</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="profile"
    ><p>Profile details for Ada Example.</p><button type="button">Edit profile</button></Tabs.Content
  >
  <Tabs.Content value="security"><p>Two-step sign-in is on.</p></Tabs.Content>
  <Tabs.Content value="billing"><p>Billing is managed elsewhere.</p></Tabs.Content>
  <Tabs.Content value="team"><p>Three fictional teammates.</p></Tabs.Content>
</Tabs.Root>
