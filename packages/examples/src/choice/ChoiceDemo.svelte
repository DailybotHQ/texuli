<script lang="ts">
import { Checkbox, RadioGroup, Switch } from 'texuli/choice';

let email = $state(true);
let marketing = $state(false);
let all = $state(false);
let allIndeterminate = $state(true);
let dark = $state(false);
let plan = $state('team');
let theme = $state('system');

function onAllChange(checked: boolean) {
  all = checked;
  allIndeterminate = false;
  email = checked;
  marketing = checked;
}
</script>

<section data-example="texuli-choice" aria-labelledby="choice-demo-title">
  <h2 id="choice-demo-title">Checkbox, Radio and Switch</h2>

  <h3>Checkbox</h3>
  <div class="stack" dir="rtl">
    <Checkbox
      label="Select all notifications"
      indeterminate={allIndeterminate}
      checked={all}
      onCheckedChange={onAllChange}
    />
    <Checkbox bind:checked={email} label="Product updates" description="Harbor Notes releases (fictional)." />
    <Checkbox bind:checked={marketing} label="Tips" description="Optional tips. No real mail is sent." size="sm" />
    <Checkbox label="Disabled" disabled checked />
  </div>

  <h3>Switch</h3>
  <div class="stack">
    <Switch bind:checked={dark} label="Compact density" description="Preview only (simulated)." />
    <Switch label="Offline mode" size="sm" />
    <Switch label="Locked" disabled checked />
  </div>

  <h3>Radio (default)</h3>
  <RadioGroup
    bind:value={plan}
    name="plan"
    items={[
      { value: 'solo', label: 'Solo', description: 'One workspace' },
      { value: 'team', label: 'Team', description: 'Shared Harbor Notes' },
      { value: 'org', label: 'Organization', description: 'Many teams', disabled: true },
    ]}
  />

  <h3>Radio (card, horizontal)</h3>
  <RadioGroup
    bind:value={theme}
    name="theme"
    variant="card"
    orientation="horizontal"
    items={[
      { value: 'light', label: 'Light', description: 'Day palette' },
      { value: 'dark', label: 'Dark', description: 'Night palette' },
      { value: 'system', label: 'System', description: 'Follow device' },
    ]}
  />
</section>

<style>
  .stack {
    display: grid;
    gap: 0.75rem;
    min-inline-size: 0;
    max-inline-size: min(100%, 28rem);
    margin-block-end: 1.5rem;
  }
  h3 {
    margin-block: 1.25rem 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tx-muted-foreground, #575757);
  }
</style>
