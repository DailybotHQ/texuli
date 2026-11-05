<script lang="ts">
// Tabs scenario: @texuli/primitives Tabs public API only.
import { Tabs } from '@texuli/primitives/tabs';
import { behaviorEvent } from '../../harness/client/events.ts';

const params = new URLSearchParams(location.search);
// `?value=` starts on another tab (the tab-stop rows use it).
let value = $state(params.get('value') ?? 'profile');
// `?panels=none`: the tabs switch a view the host owns, so no Tabs.Content;
// the Team tab names the host region with `panelId`.
const panels = params.get('panels') !== 'none';
</script>

<Tabs.Root bind:value onValueChange={(next) => behaviorEvent('valueChange', next)}>
  <Tabs.List aria-label="Account">
    <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
    <Tabs.Trigger value="security">Security</Tabs.Trigger>
    <Tabs.Trigger value="billing" disabled>Billing</Tabs.Trigger>
    <Tabs.Trigger value="team" panelId={panels ? undefined : 'team-view'}>Team</Tabs.Trigger>
  </Tabs.List>
  {#if panels}
    <Tabs.Content value="profile"
      ><p>Profile details for Ada Example.</p><button type="button">Edit profile</button
      ></Tabs.Content
    >
    <Tabs.Content value="security"><p>Two-step sign-in is on.</p></Tabs.Content>
    <Tabs.Content value="billing"><p>Billing is managed elsewhere.</p></Tabs.Content>
    <Tabs.Content value="team"><p>Three fictional teammates.</p></Tabs.Content>
  {/if}
</Tabs.Root>
{#if !panels}
  <section id="team-view" aria-label="Team view"><p>Viewing: {value}</p></section>
{/if}
