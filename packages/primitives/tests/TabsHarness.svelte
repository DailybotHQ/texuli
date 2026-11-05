<script lang="ts">
import { Tabs } from '../src/tabs/index.ts';

interface Props {
  value?: string;
  activationMode?: 'automatic' | 'manual';
  orientation?: 'horizontal' | 'vertical';
  onValueChange?: (value: string) => void;
  /** `false` renders no panels: the tabs switch a view the host owns. */
  panels?: boolean;
  forceMount?: boolean;
  /** The host region the Team tab controls instead of a Tabs.Content. */
  teamPanelId?: string;
}

let {
  value = $bindable('profile'),
  activationMode = 'automatic',
  orientation = 'horizontal',
  onValueChange,
  panels = true,
  forceMount = true,
  teamPanelId,
}: Props = $props();
</script>

<Tabs.Root bind:value {activationMode} {orientation} {onValueChange}>
  <Tabs.List aria-label="Account">
    <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
    <Tabs.Trigger value="security">Security</Tabs.Trigger>
    <Tabs.Trigger value="billing" disabled>Billing</Tabs.Trigger>
    <Tabs.Trigger value="team" panelId={teamPanelId}>Team</Tabs.Trigger>
  </Tabs.List>
  {#if panels}
    <Tabs.Content value="profile" {forceMount}
      ><p>Profile details for Ada Example.</p><button type="button">Edit profile</button
      ></Tabs.Content
    >
    <Tabs.Content value="security" {forceMount}><p>Two-step sign-in is on.</p></Tabs.Content>
    <Tabs.Content value="billing" {forceMount}><p>Billing is managed elsewhere.</p></Tabs.Content>
    {#if !teamPanelId}
      <Tabs.Content value="team" {forceMount}><p>Three fictional teammates.</p></Tabs.Content>
    {/if}
  {/if}
</Tabs.Root>
{#if teamPanelId}
  <section id={teamPanelId} aria-label="Team view">Three fictional teammates.</section>
{/if}
