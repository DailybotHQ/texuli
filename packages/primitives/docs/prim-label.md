# Primitive: Label and Field

**Package:** `@texuli/primitives` · **Path:** `src/label/` · **Subpath:**
`@texuli/primitives/label` · **Task:** T-prim-label

Headless Svelte 5 parts that name a form control and wire its description
and error, following the WAI-ARIA Authoring Practices for form fields.
Owned code, written from the WAI-ARIA Authoring Practices.

```svelte
<script lang="ts">
import { Field, Label } from '@texuli/primitives/label';

let email = $state('');
const invalid = $derived(email !== '' && !email.includes('@'));
</script>

<Label.Root for="company">Company</Label.Root>
<input id="company" />

<Field.Root {invalid} required>
  <Field.Label>Work email</Field.Label>
  <Field.Control type="email" bind:value={email} />
  <Field.Description>We send receipts here.</Field.Description>
  <Field.Error>Enter an address like name@example.com.</Field.Error>
</Field.Root>
```

## Parts

| Part | Renders | Behavior |
| --- | --- | --- |
| `Label.Root` (`LabelRoot`) | `<label>` | Names its control by `for` or by wrapping it, so clicking or tapping it focuses a text field or toggles a checkbox natively. A double-click does not select its text, unless the press lands on interactive content inside the label. |
| `Field.Root` (`FieldRoot`) | `<div>` | Owns the ids (`<id>-control`, `-label`, `-description`, `-error`; `id` defaults to a generated one) and the state `invalid`, `disabled` and `required`. Sets `data-invalid`, `data-disabled` and `data-required`. |
| `Field.Label` | `Label.Root` | `for` the control, with its own id; the same data attributes. |
| `Field.Control` | `<input>` (`bind:value`) | `id`, `aria-describedby`, `aria-invalid="true"`, `aria-errormessage`, `required` + `aria-required`, `disabled`. The field's wiring wins over same-named props; an author's own `aria-describedby` ids are kept after the field's. |
| `Field.Description` | `<p>` | Referenced by the control **only while mounted**. |
| `Field.Error` | `<p aria-live="polite">` | The container stays mounted as a polite live region, so the message is announced when it appears. The message (and the control's reference to it) exists only while the field is invalid; `forceMount` keeps the message for an exit animation. Has `data-state="invalid"` or `"valid"`. |

**No dangling references.** Description and error parts register while
they are mounted, so `aria-describedby` never names an element that is
not in the DOM. A field can be invalid without an error part: it is still
`aria-invalid`, just not described by a missing id.

**Composition.** Every part accepts a `child` snippet that receives `props`
to spread on any element (`Field.Error`'s also receives `show`):

```svelte
<Field.Control>
  {#snippet child({ props })}<textarea {...props} bind:value={notes}></textarea>{/snippet}
</Field.Control>
```

`Label.Root` composes its handler after the consumer's: the consumer's
`onmousedown` runs first, and calling `preventDefault()` there skips the
label's own handling.

**Helpers** (framework-free, exported): `controlAttributes(state, extra?)`,
`fieldDataAttributes`, `joinIds` and `shouldPreventLabelSelection`, plus
`fieldContext` for building a custom part.

## Verified

- **Unit tests:** `pnpm vitest run packages/primitives/tests/models.test.ts packages/primitives/tests/forms.test.ts`,
  6 tests (`-t '^label '`):
  - the helpers: id joining;
  - Field: references to unmounted parts never emitted; author references
    kept; unique generated ids; the missing provider named;
  - Label: `child` composition with the consumer handler first.
- **Behavior:** `pnpm exec playwright test tests/behavior/scenarios/label.spec.ts`
  runs 8 rows, against the Bits `Label` driver and the owned driver:
  - names (by `for` and by wrapping);
  - pointer **and touch** (tap on the Pixel 7 project): a label focuses its
    field and toggles its checkbox;
  - keyboard: labels never take focus, and Tab reaches the fields in order;
  - the accessible description;
  - error wiring and recovery;
  - the polite live region exists before the error;
  - no selection on double-click;
  - **axe clean, valid and invalid**.

  Both drivers passed 24/24 (chromium, webkit, mobile). `compare-cli`:
  **equal** on all three projects, size ratio **0.56×**. Disabling the
  label's double-click handling makes the owned driver fail its row
  (mutation check).

## Size (gzip)

| Measure | Size |
| --- | --- |
| `@texuli/primitives/label` (`pnpm size`, 2026-10-24: the whole subpath) | 2.61 KiB (default `@texuli/primitives/*` cap 4 KiB) |
| `Label` alone (Vite build, Svelte external) | 1.23 KiB, within the task's 1.5 KB target |
| `Field` + `Label` | 2.47 KiB when measured: the five Field parts added 1.24 KiB, so the family as a whole is above the 1.5 KB target |

## Limits

- **Field covers one control.** A group of radios or checkboxes with one
  legend is a `<fieldset>` concern; Radio Group has its own primitive.
- **`aria-errormessage`** is set alongside `aria-describedby`. Some screen
  readers ignore `aria-errormessage`, and `aria-describedby` is what makes
  the error heard.
- **Platform Tab order.** WebKit's default Tab order skips buttons and
  checkboxes (a macOS setting). The behavior keyboard row asserts only the
  text fields and label non-focusability for that reason.
