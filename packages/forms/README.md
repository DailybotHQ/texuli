# @texuli/forms

Schema-driven forms for [Texuli](https://texuli.com), an MIT-licensed
Svelte 5 component library by Dailybot, Inc. (*Small pieces. Infinite
possibilities.*). A closed form schema (typed fields, sections, multi-step
flows, conditional logic and validation rules) becomes an accessible form
painted with texuli controls, with announced errors, drafts and autosave.
Agents emit the same schema as data through the catalog's `schema-form` id:
formats and validators are names, conditions are expressions of the closed
language in `@texuli/core/expression`, and no schema carries a regular
expression or code.

> **Status: in development (pre-1.0).** `@texuli/forms` is published on
> npm as `0.9.0`, with provenance (first published as `0.8.0`; built in PLAN_010,
> ADR-015 in
> [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)).
> Under 0.x a new minor (`0.10.0`) may contain breaking changes, so pin the
> exact version or use `^0.9.0`, which accepts only 0.9.x
> (see [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).

It sits on layer L4 and depends on `texuli` and `@texuli/core`; `svelte`
(^5.57.2) is a peer dependency. The model (`@texuli/forms/model`) is
framework-free.

## Install

```bash
npm install @texuli/forms
```

In the Texuli workspace, depend on it as `"@texuli/forms": "workspace:*"`.
Import the token stylesheet once
(`@texuli/tokens/base.css`); `SchemaForm` imports its own CSS.

## Quick start

```svelte
<script lang="ts">
import { SchemaForm, validateFormSchema } from '@texuli/forms';

const result = validateFormSchema({
  title: 'Request access',
  submitLabel: 'Send request',
  fields: [
    { name: 'email', type: 'email', label: 'Work email', required: true },
    {
      name: 'team',
      type: 'select',
      label: 'Team',
      options: [
        { value: 'design', label: 'Design' },
        { value: 'engineering', label: 'Engineering' },
      ],
    },
    {
      name: 'reason',
      type: 'textarea',
      label: 'Why do you need access?',
      when: {
        require: { op: 'eq', left: { op: 'field', name: 'team' }, right: { op: 'str', value: 'engineering' } },
      },
    },
  ],
});
</script>

{#if result.ok}
  <SchemaForm form={result.form} onSubmit={async ({ values }) => ({ ok: true })} />
{/if}
```

## What's inside

| Subpath | What it holds | Docs |
| --- | --- | --- |
| `.` | `SchemaForm`, `DEFAULT_SCHEMA_FORM_LABELS`, the model's main entry points and `FORMS_PACKAGE_VERSION` | [SchemaForm](https://github.com/DailybotHQ/texuli/blob/main/packages/forms/docs/schema-form.md) |
| `./model` | The framework-free runtime: `validateFormSchema`, named formats, `computeFormLogic`, `validateFormValues`, `createFormController`, drafts | [Model](https://github.com/DailybotHQ/texuli/blob/main/packages/forms/docs/model.md) |
| `./controls` | The static control registry (`SCHEMA_FORM_CONTROLS`) for server rendering; without it SchemaForm loads per-type controls on first use | [Controls](https://github.com/DailybotHQ/texuli/blob/main/packages/forms/docs/controls.md) |
| `./host` | The `formHost` adapter for `@texuli/player` (`createFormPlayerHost`) and the draft check | [Host](https://github.com/DailybotHQ/texuli/blob/main/packages/forms/docs/host.md) |
| `./styles.css` | The layout stylesheet and its hooks | [Styles](https://github.com/DailybotHQ/texuli/blob/main/packages/forms/docs/styles.md) |

## Field types and rules

Fields: text, textarea, number, email, url (https, or http where the field
allows it), date, time, datetime, select (clearable while optional),
multiselect, checkbox, radio, switch, slider, file (the host uploads), tags,
color, password and otp (credential fields: kept out of drafts, and opt-in
for agent output) and custom (painted by the host, validated and submitted
with the rest). Date, time, datetime, slider, tags, file, color and radio
controls load per type on first use, with a static registry for server
rendering. Rules:
required, minLength and maxLength, min and max, step, minItems and
maxItems, a named format (email, url, phone, postal codes, digits, slug,
ISO dates, times, hex colors), a host validator by name (sync or async),
and cross-field rules as expressions. `when.show`, `when.require` and
`when.enable` are expressions over earlier fields; hidden and disabled
fields are neither validated nor submitted.

## Accessibility

A named form landmark; every control is a texuli control with a visible
label, its description and its error linked (the Field rule); errors are
announced, an error summary takes focus and links to each field; each step
heading takes focus and is announced; the form is keyboard-complete; step
transitions go through `texuli/motion` and are instant under reduced
motion. The view test runs axe name and ARIA rules over every field type.

## Security

Schemas from agents are validated at the `untrusted` tier: closed members,
named formats only (no agent regular expressions, so no backtracking),
help links through the URL policy, text as text (no HTML sinks), and
expressions that are closed data evaluated within the ADR-015 step limits.
Restored drafts are coerced field by field like any untrusted input.

## Learn more

- [SchemaForm](https://github.com/DailybotHQ/texuli/blob/main/packages/forms/docs/schema-form.md)
- [Model](https://github.com/DailybotHQ/texuli/blob/main/packages/forms/docs/model.md)
- [Styles](https://github.com/DailybotHQ/texuli/blob/main/packages/forms/docs/styles.md)
- [Host](https://github.com/DailybotHQ/texuli/blob/main/packages/forms/docs/host.md)
- [Controls](https://github.com/DailybotHQ/texuli/blob/main/packages/forms/docs/controls.md)
- The expression language: [core-expression](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-expression.md)
- Forms in blueprints (the `schema-form` catalog id, spec 0.8.0), painted by the player through `formHost`: [`@texuli/catalog`](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/README.md)
- Decisions: ADR-015 (one bounded expression language) and ADR-012 (spec evolution) in
  [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-forms).
