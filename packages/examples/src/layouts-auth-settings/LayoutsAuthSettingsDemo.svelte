<script lang="ts">
import { Button } from 'texuli/button';
import {
  AuthSplitLayout,
  SettingsLayout,
  type SettingsNavItem,
  WizardLayout,
} from 'texuli/layouts/auth-settings';
import type { StepperStep } from 'texuli/stepper';

const steps: StepperStep[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'invite', label: 'Invite' },
];

let wizardStep = $state(0);
let settingsActive = $state('profile');
let rtlActive = $state('profile');

const sections: SettingsNavItem[] = [
  { id: 'profile', label: 'Profile', description: 'Name and avatar' },
  { id: 'security', label: 'Security', description: 'Password and sessions' },
  { id: 'notifications', label: 'Notifications' },
];
</script>

<section
  class="demo"
  data-example="layouts-auth-settings"
  aria-labelledby="layouts-auth-title"
>
  <h2 id="layouts-auth-title">Auth, onboarding and settings</h2>
  <p>
    Authentication split, onboarding wizard and settings shell. Responsive and RTL-ready.
    Fictional Harbor Labs copy only.
  </p>

  <h3>Auth split</h3>
  <div class="frame">
    <AuthSplitLayout
      brandTitle="Harbor Labs"
      brandDescription="A clearer way for the team to ship prototypes together."
      brandEyebrow="Workspace"
    >
      {#snippet brand()}Harbor{/snippet}
      {#snippet form()}
        <div class="form">
          <label class="field">
            <span>Email</span>
            <input type="email" autocomplete="username" value="ada@example.com" readonly />
          </label>
          <Button type="button">Continue</Button>
        </div>
      {/snippet}
    </AuthSplitLayout>
  </div>

  <h3>Onboarding wizard</h3>
  <div class="frame frame--muted">
    <WizardLayout
      bind:current={wizardStep}
      title="Set up Harbor"
      description="Three short steps to open the Harbor Labs workspace."
      {steps}
      finishLabel="Open workspace"
      onFinish={() => {
        wizardStep = 0;
      }}
    >
      {#snippet content({ step })}
        <p class="step-body">You are on <strong>{step.label}</strong>.</p>
      {/snippet}
    </WizardLayout>
  </div>

  <h3>Settings</h3>
  <div class="frame frame--pad">
    <SettingsLayout
      bind:active={settingsActive}
      title="Settings"
      description="Harbor workspace preferences."
      {sections}
      startWithList={false}
    >
      {#snippet children(id)}
        <p class="step-body">
          {#if id === 'profile'}
            Profile for Ada Park at Harbor Labs.
          {:else if id === 'security'}
            Password, MFA and active sessions.
          {:else}
            Email and in-app notification preferences.
          {/if}
        </p>
      {/snippet}
    </SettingsLayout>
  </div>

  <h3>Settings (RTL)</h3>
  <div class="frame frame--pad" dir="rtl" lang="ar">
    <SettingsLayout
      bind:active={rtlActive}
      title="الإعدادات"
      description="تفضيلات مساحة عمل هاربور."
      navLabel="أقسام الإعدادات"
      backLabel="الإعدادات"
      sections={[
        { id: 'profile', label: 'الملف الشخصي' },
        { id: 'security', label: 'الأمان' },
      ]}
      startWithList={false}
    >
      {#snippet children(id)}
        <p class="step-body">{id === 'profile' ? 'الملف الشخصي لأدا.' : 'كلمة المرور والجلسات.'}</p>
      {/snippet}
    </SettingsLayout>
  </div>
</section>

<style>
  .demo {
    display: grid;
    gap: 1.25rem;
    padding: 1.5rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2,
  h3 {
    margin: 0;
  }
  h2 {
    font-size: 1.25rem;
  }
  h3 {
    font-size: 1rem;
  }
  p {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
  }
  .frame {
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.75rem;
    overflow: hidden;
    min-block-size: 18rem;
  }
  .frame--muted {
    background: color-mix(in srgb, var(--tx-muted, GrayText) 8%, transparent);
  }
  .frame--pad {
    padding: 0;
  }
  .form {
    display: grid;
    gap: 1rem;
  }
  .field {
    display: grid;
    gap: 0.35rem;
    font-size: 0.875rem;
  }
  .field input {
    min-block-size: 2.25rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-input, currentColor);
    border-radius: 0.5rem;
    background: var(--tx-surface, Field);
    color: inherit;
    font: inherit;
  }
  .step-body {
    margin: 0;
    color: var(--tx-foreground, CanvasText);
  }
</style>
