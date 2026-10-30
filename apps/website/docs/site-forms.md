# Forms page (texuli.com)

**App:** `apps/website`
**Path:** `/forms-page/` (Components group, after Documents)
**Packages:** `@texuli/forms` (root, `model`, `host`), `@texuli/core/expression`,
`@texuli/core/data-source`, `@texuli/player`; on npm from `0.8.0`
(`@texuli/forms` for the first time, in development, pre-1.0); the
`schema-form` catalog id is spec `0.8.0`
**Decision:** ADR-015 (one bounded expression language) in [DECISIONS](../../../docs/DECISIONS.md)
**Tests:** `apps/website/tests/site-forms.test.ts`, `tests/e2e/site-forms.spec.ts`

## Goal

Show every part of schema-driven forms working: every field type, every
named format, every closed rule with announced errors, multi-step flows with
conditional logic, drafts and autosave, fields backed by host data sources,
and a form an agent wrote, painted by the player. The page frame is the
shared `FeaturePage.astro` (`src/components/feature-site/`), which the later
0.8.0 showcase pages reuse.

## Layout

| Section | Island | What it shows |
| --- | --- | --- |
| Hero | static | Status (in development, on npm from `0.8.0`), the pieces, and a link to the hand-written forms guide (`/guides/forms/`). |
| `#fields` | `FieldGallery.svelte` | One `SchemaForm` with a field of every `FORM_FIELD_TYPES` entry (built from a record keyed by `FormFieldType`), the typed values live and what a submit sends; a build-time table of every type, its control and its value type. |
| `#formats` | `FormatLab.svelte` | Every `FORM_FORMATS` entry checked live by `matchesFormat`, each with an accepted and a refused sample (`formats.ts`). |
| `#validation` | `ValidationDemo.svelte` | Every `FORM_RULE_NAMES` entry (the coverage table maps each to its field), an async host validator, a cross-field rule, the error summary that takes focus, and server errors from `onSubmit`. |
| `#flow` | `FlowDemo.svelte` | A four-step flow: a field shown and required by `role == "other"`, a section by `plan == "enterprise"`, a field enabled by `sso`, a whole step by `people > 50`, and a cross-field rule; beside it every condition in its text form and the live logic from `computeFormLogic`. |
| `#drafts` | `DraftsDemo.svelte` | Autosave to an in-page `FormDraftStorage` the reader can see, remount and restore, clear, and a tampered draft coerced field by field. |
| `#sources` | `SourceDemo.svelte` | `example.teams` and `example.handles` declared with `defineSource` and answered from memory (`sources.ts`); the team choices come from the loader, the handle check searches it, a rate-limited read is retried, and the request log shows each validated query. |
| `#agents` | `AgentFormDemo.svelte` | The blueprint JSON and the hostile field (static), and the real `<Player>` at the untrusted tier with `createFormPlayerHost()`; submit proposes the action to the page; the hostile `pattern` is refused before painting. |
| `#keyboard`, `#safety`, `#package-docs` | static | Keys, what a screen reader hears, the rules, code samples and doc paths. |

## Notes

- The field gallery and the flow server-render `SchemaForm` (texuli's
  `Select.Value` is SSR-safe since 0232cda5, so the earlier paint-after-mount
  workaround is gone).
- Field names avoid `title`, `description` and `summary`, which `SchemaForm`
  once used for its own element ids (fixed in 0232cda5; the names stay).
- The two Steppers carry their own progress labels so the navigation
  landmarks stay unique.
