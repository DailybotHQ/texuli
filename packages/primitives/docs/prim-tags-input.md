# Primitive: TagsInput

**Package:** `@texuli/primitives` · **Subpath:** `@texuli/primitives/tags-input` ·
**Path:** `src/tags-input/` · **Task:** T-prim-tags-input

An owned, headless Svelte 5 tags input. You add tags by typing, by a
delimiter or by pasting, and remove them by keyboard, pointer or touch. It
validates tags and announces every change.

The APG has no dedicated tags-input pattern, so this composes APG building
blocks:
- a labelled `group`
- a `list` of tags
- one text input as the group's single Tab stop (as in a composite widget)
- remove buttons with accessible names
- a polite `status` live region

```svelte
<script lang="ts">
import { TagsInput } from '@texuli/primitives/tags-input';
let topics = $state(['design', 'research']);
</script>

<span id="topics-label">Topics</span>
<TagsInput.Root bind:value={topics} name="topic" max={5} aria-labelledby="topics-label">
  {#snippet children({ tags })}
    <TagsInput.List>
      {#each tags as tag, index (`${index}-${tag}`)}
        <TagsInput.Tag {index}>
          <span>{tag}</span>
          <TagsInput.TagRemove {index}>×</TagsInput.TagRemove>
        </TagsInput.Tag>
      {/each}
    </TagsInput.List>
    <TagsInput.Input aria-label="Add a topic" />
  {/snippet}
</TagsInput.Root>
```

## Parts and props

| Part | Renders | Props |
| --- | --- | --- |
| `TagsInput.Root` | `div role="group"` | `value` (bindable `string[]`), `onValueChange`, `onInvalid({ tag, reason, message? })`, `delimiter` (`,` default; a string or a RegExp), `addOnPaste` (true), `addOnBlur` (false), `allowDuplicates` (false), `max`, `validate(tag, tags)` (return `false` or a message to refuse), `disabled`, `name`, `form`, `required`, `labels`, `ref`. Name the group with `aria-label` or `aria-labelledby` |
| `TagsInput.List` | `ul role="list"` | The tags' container |
| `TagsInput.Tag` | `li tabindex="-1"` | `index`. Focus comes from the arrow keys; it is not a Tab stop |
| `TagsInput.TagRemove` | `button tabindex="-1"` | `index`. Named "Remove {tag}" by default; for pointer and touch |
| `TagsInput.Input` | `input type="text" autocomplete="off"` | The only Tab stop. Give it an accessible name |

- The root's `children` snippet receives `{ tags }`.
- Every part takes a `child` snippet. The root's hidden form fields and its
  live region are rendered beside the root element, so a custom root still
  submits and announces.

## Behavior

- **Adding:**
  - Enter adds the typed text. Enter on an empty input is left alone, so a
    form can still submit.
  - Typing a one-character delimiter adds a tag.
  - Typed and pasted text is split on the delimiter and on line breaks;
    pieces are trimmed and empty ones dropped.
  - Pasting adds the split tags after what was already typed (`addOnPaste`).
  - `addOnBlur` adds the draft when the input loses focus.
- **Validation:** candidates are checked in order: duplicates (unless
  `allowDuplicates`), then `max`, then `validate`.
  - Accepted tags are added and the input clears.
  - Refused tags fire `onInvalid` with the reason (`duplicate`, `max` or
    `invalid`) and keep the draft so it can be fixed.
  - A refusal sets `aria-invalid` on the input and `data-invalid` on the
    root, until the next keystroke.
- **Announcements:** a visually hidden `role="status"` region says
  "{tag} added", "{tag} removed", "{tag} is already added", "You can add up
  to {max} tags", "{tag} is not valid", or the validator's own message. All of
  these strings can be translated through `labels`.
- **Keyboard:**
  - In the input: Backspace on an empty input, or ArrowLeft with the caret
    at the start, moves to the last tag.
  - On a tag: ArrowLeft and ArrowRight move between tags (swapped in RTL).
    ArrowRight past the last tag, and End, return to the input. Home goes to
    the first tag.
  - Backspace removes the tag and moves to the previous one. Delete removes
    it and moves to the next one, or to the input when none is left.
  - The focused tag has `data-state="active"`.
- **Pointer and touch:** the remove button removes its tag and returns focus
  to the input.
- **Direction** is the nearest `dir` attribute, otherwise the computed CSS
  direction.
- **Disabled:** the input and remove buttons are disabled and keys do
  nothing. The root gets `data-disabled`.
- **Forms:**
  - With `name`, each tag submits as its own field (read with
    `FormData.getAll`).
  - `required` blocks submission while there are no tags, and moves focus to
    the text input. This uses the shared `@texuli/core/form-bridge` field,
    attached to the Input part and left unnamed so it submits nothing.
  - A form reset restores the starting tags, unless the reset was canceled.
  - The text input itself has no `name`, so drafts are never submitted.

## Verified

- `pnpm vitest run packages/primitives/tests/tags-input.test.ts`: 24 tests.
  - The pure split and accept rules.
  - Structure and names.
  - Adding by Enter and the delimiter; Enter not submitting while there is
    text.
  - Duplicate, max and validator refusals with announcements and
    `aria-invalid`.
  - Paste splitting, with it off, and add-on-blur.
  - Every keyboard path and RTL.
  - Removal and where focus goes; the remove button.
  - Disabled; form submit, `required` (also when it changes after mount),
    focus on invalid, and reset.
  - The child snippet.
  - Deliberate mutations of the rules, keyboard and form bridge (focus target,
    reset, `required` and value sync) each fail a test.
- `pnpm exec playwright test tests/behavior/scenarios/tags-input.spec.ts`
  passes 22 runs and skips 2, in Chromium, WebKit and the Pixel 7. It covers
  the group and Tab stop, adding and refusing with announcements, keyboard
  navigation and removal, a real `ClipboardEvent` paste, pointer removal,
  form submission and axe (0 violations). The touch-tap test runs only on
  the Pixel 7 (the two skips are its desktop runs).

## Size

`pnpm size`: **4,288 B gzip** (4.19 KiB), within its **4,608 B** budget
(`texuli.budgets.json`). TagsInput uses the shared `@texuli/core/form-bridge`
texel like every other form-capable primitive. The lead chose consistency
over the 535 B it costs here.

## Limits

- No editing a tag in place. Remove it and type it again.
- No suggestions or autocomplete; compose with a Combobox for that.
- The starting tags for form reset are read once, when the root is created.
