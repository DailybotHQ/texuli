# Auth, onboarding and settings layouts

**Package:** `texuli` · **Import:** `texuli/layouts/auth-settings`

Three page frames: **AuthSplitLayout** (sign-in), **WizardLayout** (onboarding),
and **SettingsLayout** (section list + detail). Logical CSS, RTL-safe, responsive
breakpoints. Brand and section labels are author-provided (no product copy defaults
on the auth brand panel).

## Auth split

```svelte
<script lang="ts">
  import { AuthSplitLayout } from 'texuli/layouts/auth-settings';
  import { Button } from 'texuli/button';
</script>

<AuthSplitLayout
  brandTitle="Harbor Labs"
  brandDescription="A clearer way for the team to ship."
  brandEyebrow="Workspace"
>
  {#snippet brand()}Harbor{/snippet}
  {#snippet form()}
    <form>
      <label>Email <input type="email" autocomplete="username" /></label>
      <Button type="submit">Continue</Button>
    </form>
  {/snippet}
</AuthSplitLayout>
```

| Prop | Notes |
| --- | --- |
| `form` / `mountScreen` | Form body, or LayoutHost screen outlet |
| `brand` | Small mark above the form |
| `panel` | Full brand panel; else `brandTitle` / `brandDescription` / `brandEyebrow` |
| `formLabel` / `panelLabel` | Accessible names (localizable) |

Below `64rem` only the form column shows; the brand panel appears from `lg`.

## Wizard (onboarding)

```svelte
<script lang="ts">
  import { WizardLayout } from 'texuli/layouts/auth-settings';
  let current = $state(0);
</script>

<WizardLayout
  bind:current
  title="Set up Harbor"
  description="Three short steps."
  steps={[
    { id: 'profile', label: 'Profile' },
    { id: 'team', label: 'Team' },
    { id: 'done', label: 'Done' },
  ]}
  onFinish={() => {}}
>
  {#snippet content({ step })}
    <p>Step: {step.label}</p>
  {/snippet}
</WizardLayout>
```

Wraps the texuli `Wizard` / `Stepper` inside a centered card. Pass `mountScreen`
instead of `steps`/`content` for LayoutHost routing.

## Settings

```svelte
<script lang="ts">
  import { SettingsLayout } from 'texuli/layouts/auth-settings';
  let active = $state('profile');
</script>

<SettingsLayout
  bind:active
  title="Settings"
  description="Harbor workspace preferences."
  sections={[
    { id: 'profile', label: 'Profile', description: 'Name and email' },
    { id: 'security', label: 'Security' },
  ]}
>
  {#snippet children(id)}
    <p>Section {id}</p>
  {/snippet}
</SettingsLayout>
```

Phones alternate list and detail; from `48rem` both columns show. Choosing a
section focuses the detail heading; Back returns to the list.

## LayoutHost registration

```ts
import { registerAuthSettingsLayouts } from 'texuli/layouts/auth-settings';
registerAuthSettingsLayouts();
// layout ids: 'auth-split' | 'wizard'
```

## Examples

`layouts-auth-settings` — auth split, wizard and settings side by side, plus an RTL settings strip.
