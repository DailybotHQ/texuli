## Install and status

Install the published schema form package with `pnpm add @texuli/forms`. The package is in development (pre-1.0). The visual builder (`@texuli/forms/builder`) is in development: it was added after `0.17.4`, is not in a published release yet, and is planned for the next release.

Import the base theme stylesheet once in your application. `SchemaForm` renders the validated schema using Texuli controls.

```svelte
<script lang="ts">
import { SchemaForm, validateFormSchema } from '@texuli/forms';

const result = validateFormSchema({
  title: 'Workshop request',
  fields: [{ name: 'email', type: 'email', label: 'Email address', required: true }],
});
</script>

{#if result.ok}<SchemaForm form={result.form} />{/if}
```
