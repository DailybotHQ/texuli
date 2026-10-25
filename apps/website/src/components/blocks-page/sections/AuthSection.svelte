<script lang="ts">
import { Button } from 'texuli/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from 'texuli/card';
import { Field } from 'texuli/field';
import { Input } from 'texuli/input';

/**
 * Sign in: an email and password form in a card, with validation messages.
 * Copy-ready: `texuli add button card field input`, then wire `onsubmit` to
 * your auth service. This demo checks the fields and sends nothing.
 */
let email = $state('');
let password = $state('');
let submitted = $state(false);
let status = $state('');

const emailError = $derived(
  submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? 'Enter an email such as ada@harbor.example.'
    : null
);
const passwordError = $derived(
  submitted && password.length < 8 ? 'Use at least 8 characters.' : null
);

function submit(event: SubmitEvent): void {
  event.preventDefault();
  submitted = true;
  status = emailError || passwordError ? '' : `Demo only: ${email} would be signed in now.`;
}
</script>

<section class="auth" aria-labelledby="auth-title">
  <Card class="auth__card">
    <form novalidate onsubmit={submit}>
      <CardHeader>
        <CardTitle level={3} id="auth-title">Sign in to Harbor Notes</CardTitle>
        <CardDescription>Use the email your harbor master invited.</CardDescription>
      </CardHeader>
      <CardContent class="auth__fields">
        <Field label="Email" required error={emailError}>
          {#snippet children(control)}
            <Input {...control.props} type="email" autocomplete="email" bind:value={email} />
          {/snippet}
        </Field>
        <Field label="Password" required error={passwordError}>
          {#snippet children(control)}
            <Input {...control.props} type="password" autocomplete="current-password" bind:value={password} />
          {/snippet}
        </Field>
        <p class="auth__status" role="status">{status}</p>
      </CardContent>
      <CardFooter>
        <Button type="submit">Sign in</Button>
      </CardFooter>
    </form>
  </Card>
</section>

<style>
  .auth {
    display: grid;
    justify-items: center;
  }
  .auth :global(.auth__card) {
    inline-size: min(100%, 26rem);
  }
  .auth :global(.auth__fields) {
    display: grid;
    gap: 1rem;
  }
  .auth__status {
    margin: 0;
    min-block-size: 1.25rem;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }
</style>
