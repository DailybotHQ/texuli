# @texuli/forms/builder

> **Status: in development (pre-1.0).** Added after `0.17.4`; it ships in
> the next release of `@texuli/forms`.

A visual form builder for the schema `SchemaForm` renders. Authors pick
fields from a palette, reorder them on a canvas (pointer drag through
`@texuli/drag/sortable`, Alt plus Arrow Up or Arrow Down on a handle, or
the move buttons), edit each field in an inspector (label, required,
format, options, a show condition) and see a live, validated `SchemaForm`
preview and the schema JSON.

```svelte
<script lang="ts">
import { FormBuilder } from '@texuli/forms/builder';
import type { FormSchema } from '@texuli/forms/model';

let schema = $state<FormSchema>({ title: 'Event sign-up', fields: [] });
</script>

<FormBuilder {schema} onChange={(next) => (schema = next)} />
```

The builder edits one flat field list. A schema with sections or steps is
read flat (`builderFields`), and `onChange` emits a flat schema. The
preview validates with the `developer` tier, and nothing the author types
is rendered as markup. Password, OTP, file and custom fields are not in
the palette.

## Exports

| Export | What it does |
| --- | --- |
| `FormBuilder` | The builder component. Props: `schema` (the starting schema) and `onChange(schema)` (every edit). |
| `BuilderField` | A field with the `name` and `label` the builder needs. |
| `builderFields` | Reads the editable field list from a schema, flattening sections and steps. |
| `createBuilderField` | Makes a minimal valid field for a palette type with a unique name; `null` for an unknown type or past 200 fields. |
| `reorderBuilderFields` | Moves a field to a final index; invalid ids or indices return the list unchanged. |
| `withBuilderFields` | Writes an edited field list back into a schema, keeping its title, description, submit label and rules. |

## Accessibility

Each canvas row has a reorder handle with an accessible name and a polite
status message after every move, and the inspector uses labeled native
controls. Keyboard reorder never needs a pointer.
