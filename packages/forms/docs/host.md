# @texuli/forms/host

> **Status: in development (pre-1.0).** On npm from `0.8.0`, the
> package's first release.

The form host for `@texuli/player`: how a `schema-form` catalog node
(spec 0.8.0, ADR-015) paints. The player does not depend on
`@texuli/forms`; the host passes this adapter as `formHost`, and the form
engine loads only when a blueprint holds a form.

```svelte
<script lang="ts">
import { createFormPlayerHost } from '@texuli/forms/host';
import { Player } from '@texuli/player';

const formHost = createFormPlayerHost({
  validators: {
    'company-email': (value) =>
      typeof value === 'string' && value.endsWith('@example.com') ? undefined : 'Use a company email.',
  },
});
</script>

<Player {blueprint} {formHost} onAction={(intent) => 'confirmed'} />
```

## Exports

| Export | What it does |
| --- | --- |
| `createFormPlayerHost(options?)` | Returns a `FormHost`: `checkForm` joins the player's `validateDraft`, `validators` lists the registered names, and `present` validates the schema again at the player's tier and mounts `SchemaForm` (loaded on first use) into the player's element. A schema that does not validate paints nothing; the cleanup unmounts the form or cancels a mount still loading |
| `checkFormDraft(schema, tier, validators?)` | The draft check (`validateFormSchema` at the tier): `{ ok, issues }`. Also exported by `@texuli/forms/model` for hosts that only validate (the agent service) |
| `FormHost` | `{ checkForm, validators, present(request) }`, structurally the player's `FormPlayerHost` |
| `FormHostOptions` | `validators` (host validators by name, sync or async) and `labels` (`SchemaForm` label overrides) |
| `FormHostRequest` | What the player hands `present`: `schema`, `action`, `formLabel`, `tier`, the live `active`, `labels` and `target`, and `submit(values)` |
| `FormHostSubmitResult` | `{ ok: true }` or `{ ok: false, message }`: what `submit` resolves to after the host confirmed or refused the action |
| `FormDraftCheck` | The type of `checkForm` |
| `FormHostTier` | `'developer' | 'untrusted'` |

## Rules

- **Validator names are closed.** Only the names in `options.validators`
  are allowed; with none registered, a field that names a validator is
  refused before anything paints.
- **The tier is the host's.** `present` validates at the player's tier,
  never at one the draft claims.
- **Submit goes through the player.** The form's submit calls
  `request.submit`, which proposes the node's `action` intent to the host
  (`onAction`) with the visible, enabled answers; a refusal shows in the
  form and keeps the answers.

Tests: `packages/forms/tests/host.test.ts` and
`packages/player/tests/schema-form.test.ts`.
