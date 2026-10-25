<script lang="ts">
import type { StepperStep } from '../../src/components/stepper/types.ts';
import {
  AuthSplitLayout,
  SettingsLayout,
  type SettingsNavItem,
  WizardLayout,
} from '../../src/layouts/auth-settings/index.ts';

let {
  view = 'auth' as 'auth' | 'auth-bare' | 'wizard' | 'settings',
  dir = 'ltr' as 'ltr' | 'rtl',
  startWithList = true,
}: {
  view?: 'auth' | 'auth-bare' | 'wizard' | 'settings';
  dir?: 'ltr' | 'rtl';
  startWithList?: boolean;
} = $props();

const steps: StepperStep[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'team', label: 'Team' },
  { id: 'done', label: 'Done' },
];

let current = $state(0);
let active = $state('profile');

const sections: SettingsNavItem[] = [
  { id: 'profile', label: 'Profile', description: 'Name and email' },
  { id: 'security', label: 'Security', description: 'Password and MFA' },
  { id: 'billing', label: 'Billing' },
];
</script>

<div {dir} data-harness={view}>
  {#if view === 'auth'}
    <AuthSplitLayout
      brandTitle="Harbor Labs"
      brandDescription="Ship prototypes with the team."
      brandEyebrow="Workspace"
    >
      {#snippet brand()}Harbor{/snippet}
      {#snippet form()}
        <p>Continue with email</p>
        <label>
          Email
          <input type="email" name="email" autocomplete="username" data-testid="auth-email" />
        </label>
        <button type="button">Continue</button>
      {/snippet}
    </AuthSplitLayout>
  {:else if view === 'auth-bare'}
    <AuthSplitLayout>
      {#snippet form()}
        <p>Sign in form</p>
      {/snippet}
    </AuthSplitLayout>
  {:else if view === 'wizard'}
    <WizardLayout
      bind:current
      title="Set up Harbor"
      description="Three short steps for the Harbor Labs workspace."
      {steps}
    >
      {#snippet content({ step })}
        <p>{step.label} body</p>
      {/snippet}
    </WizardLayout>
  {:else}
    <SettingsLayout
      bind:active
      title="Settings"
      description="Harbor workspace preferences."
      {sections}
      {startWithList}
    >
      {#snippet children(id)}
        {#if id === 'profile'}
          <p>Profile panel</p>
        {:else if id === 'security'}
          <p>Security panel</p>
        {:else}
          <p>Billing panel</p>
        {/if}
      {/snippet}
    </SettingsLayout>
  {/if}
</div>
