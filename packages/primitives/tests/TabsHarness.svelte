<script lang="ts">
import { Tabs } from '../src/tabs/index.ts';

interface Props {
  value?: string;
  activationMode?: 'automatic' | 'manual';
  orientation?: 'horizontal' | 'vertical';
  onValueChange?: (value: string) => void;
}

let {
  value = $bindable('profile'),
  activationMode = 'automatic',
  orientation = 'horizontal',
  onValueChange,
}: Props = $props();
</script>

<Tabs.Root bind:value {activationMode} {orientation} {onValueChange}>
  <Tabs.List aria-label="Account">
    <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
    <Tabs.Trigger value="security">Security</Tabs.Trigger>
    <Tabs.Trigger value="billing" disabled>Billing</Tabs.Trigger>
    <Tabs.Trigger value="team">Team</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="profile"
    ><p>Profile details for Ada Example.</p><button type="button">Edit profile</button
    ></Tabs.Content
  >
  <Tabs.Content value="security"><p>Two-step sign-in is on.</p></Tabs.Content>
  <Tabs.Content value="billing"><p>Billing is managed elsewhere.</p></Tabs.Content>
  <Tabs.Content value="team"><p>Three fictional teammates.</p></Tabs.Content>
</Tabs.Root>
