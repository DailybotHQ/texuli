# `@texuli/forms/styles.css`

Layout for `SchemaForm`. The controls are texuli components and bring their
own styles; this sheet only arranges them. `SchemaForm` imports it, so a
bundler that keeps CSS side effects needs nothing else; import
`@texuli/forms/styles.css` yourself when yours drops them. Import the token
stylesheet once (`@texuli/tokens/base.css`).

- **Tokens only:** colors, radii, borders and focus rings come from the
  `--tx-*` contract, with system-color fallbacks. `--tx-forms-gap` (default
  `1.25rem`) and `--tx-forms-max-inline-size` (default `40rem`) tune the
  layout.
- **Logical properties only** (`inline-size`, `padding-inline`,
  `border-inline-start-width`, `margin-inline-start`), so right-to-left
  forms follow `dir`.
- **Forced colors:** the summary and the confirmation borders map to
  `CanvasText`, focus outlines to `Highlight`.

## Hooks

| Selector | What it is |
| --- | --- |
| `.tx-forms` | The form root (`data-status` holds the `FormStatus`) |
| `.tx-forms__title`, `.tx-forms__description` | The form title and description |
| `.tx-forms__step`, `.tx-forms__step-title`, `.tx-forms__step-description` | The current step (`data-step`), its heading (focused on each step change) and text |
| `.tx-forms__section`, `.tx-forms__section-title`, `.tx-forms__section-description` | Sections (a fieldset with a legend when titled) |
| `.tx-forms__field`, `.tx-forms__field--toggle`, `.tx-forms__group`, `.tx-forms__legend`, `.tx-forms__choices` | A field (`data-tx-forms-field`, `data-type`), checkbox and switch fields, choice groups, their legend and choices |
| `.tx-forms__required` | The required marker of a group legend |
| `.tx-forms__pending`, `.tx-forms__link` | "Checking…" while a host validator runs, and a field's help link |
| `.tx-forms__summary`, `.tx-forms__summary-title`, `.tx-forms__summary-list` | The error summary |
| `.tx-forms__done` | The confirmation after a successful submit |
| `.tx-forms__actions`, `.tx-forms__draft` | The Back, Next and Submit row, and the draft status (`data-draft`) |
| `.tx-forms__progress` | The texuli `Stepper` of a multi-step form |
| `.tx-forms__visually-hidden` | The polite status line (step changes, restored drafts, the confirmation) |
