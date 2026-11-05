# Texuli packages: breaking changes in 0.10.0 and earlier

Back to [`../SKILL.md`](../SKILL.md), which has `0.11.0` and later.

## 0.10.0: breaking changes

This sub-skill never upgrades packages; moving an app from `^0.9.0` to
`^0.10.0` is the developer's install ([`../../components/SKILL.md`](../../components/SKILL.md)).
`0.10.0` adds design systems ([`../../design-systems/SKILL.md`](../../design-systems/SKILL.md));
themes, scopes and every `--tx-*` read keep working, and an app that adopts
no design system loads none of it. Before the move, check the app for:

- **MCP tool names:** the seven 0.8 aliases are removed. A call is refused
  with the operation to use (`-32602` from `tools/call`,
  `unknown-operation` from `invoke()`), so move host prompts and
  allowlists: `deck` → `deck.run`; `document` → `document.run`, or
  `document.export` with `format: "pdf"` or `"docx"`; `catalog` →
  `catalog.search`; `component` → `component.get`; `validate` →
  `catalog.validate`; `example` → `example.search`; `theme` →
  `theme.search` or `theme.get` (with `id`).
- **Tree blocks:** `style` is removed; a `tree` block with `style` is
  refused, alone or next to `variant`. Send `variant` (`file-tree` or
  `org`).
- **Spec 0.10.0:** validated drafts carry `spec: "0.10.0"`;
  `validateDraft` migrates a `0.9.0` envelope (a stamp-only migration), and
  a host that compares the `spec` string must accept `"0.10.0"`.
- **Tokens CSS:** load `@texuli/tokens/base.css` or the new
  `@texuli/tokens/system.css` (the system token defaults without the
  reset). Component CSS reads the system tokens with no fallback, so a
  host with its own reset that loads neither renders controls with no size.
- **`@texuli/forms`:** an optional select shows a "None" choice that
  clears it (set `clearable: false` to keep the old list). The date, time,
  datetime, slider, tags, file, color and radio controls and the step
  progress load per type on first use, behind a same-size placeholder
  (`data-tx-pending`, `aria-busy`): pass `SCHEMA_FORM_CONTROLS` from
  `@texuli/forms/controls` as `controls` to paint them at once (server
  rendering), and let tests wait for them. `SchemaForm` focuses the
  summary or the confirmation after any finished submit, including
  `controller.submit()`.
- **`@texuli/sheets`:** the cell editor loads lazily on the first Enter
  (or F2); a host test awaits it before typing.
- **`@texuli/pages` core entries:** `editor-core`, `reader-core`,
  `paged-core`, `collab-core` and `host-core` have no default player
  loader; live embeds paint only with the host's `loadPlayer` (for example
  `() => import('@texuli/player')`). The default entries behave as before.

New APIs in `0.10.0` are marked "new in `0.10.0`" in
[`../../router/packages.md`](../../router/packages.md); the full notes are in
`docs/RELEASE.md` of the Texuli repository ("0.10.0").

## 0.9.0: breaking changes

This sub-skill never upgrades packages; moving an app from `^0.8.0` to
`^0.9.0` is the developer's install ([`../../components/SKILL.md`](../../components/SKILL.md)).
`0.9.0` publishes `@texuli/mcp` for the first time. Before the move, check
the app for:

- **Spec 0.9.0:** validated drafts carry `spec: "0.9.0"` (a stamp-only
  migration from `0.8.0`); a host that compares the string must accept it.
- **A new catalog hash:** a host that pins `catalogHash` refuses envelopes
  written for the 0.8 catalog (`catalog-mismatch`) until it pins the new
  hash.
- **MCP tool names:** the seven 0.8 names (`deck`, `document`, `catalog`,
  `component`, `validate`, `example`, `theme`) are deprecated aliases in
  `0.9.0` and removed in `0.10.0` (a call is refused with the name to
  use); move host prompts and allowlists to the `group.verb` tools
  ([`../../router/hosts.md`](../../router/hosts.md#mcp)). A stdio request before
  `initialize` now gets `-32600`, not `-32002`.
- **Token contract v2:** additive, `renames.json` is empty; component
  tokens are read with their registry default and never declared, so set
  them on a scope, and import `@texuli/tokens/base.css`, which declares the
  system defaults. Default variants and sizes come from
  `setDesignDefaults` (`texuli/defaults`); Select and Combobox follow them.
- **A pending Button** is `aria-disabled` (its click suppressed), not
  natively `disabled`; a test or selector that expected `disabled` needs an
  update.
- **Date controls** set `aria-invalid="true"` when a `Field` marks them
  invalid, not only from their own `error` prop.
- **Tree blocks** take `variant` (`file-tree` or `org`); `style` is an
  alias through `0.9.x` and is refused from `0.10.0`.

New APIs in `0.9.0` are marked "new in `0.9.0`" in
[`../../router/packages.md`](../../router/packages.md); the full notes are in
`docs/RELEASE.md` of the Texuli repository ("0.9.0").

## 0.8.0: breaking changes

This sub-skill never upgrades packages; moving an app from `^0.7.0` to
`^0.8.0` is the developer's install ([`../../components/SKILL.md`](../../components/SKILL.md)).
`0.8.0` publishes `@texuli/forms`, `@texuli/canvas` and `@texuli/sheets`
for the first time; an app that does not use them sees only these changes.
Before the move, check the app for:

- **Spec 0.8.0:** validated drafts carry `spec: "0.8.0"`; a host that
  compares the string must accept it. A `0.8.0` envelope with a `$source`
  binding or a `schema-form`, `canvas`, `spreadsheet` or dashboard node is
  refused by `0.7.0` validators, so upgrade the validating side first.
- **A new catalog hash:** the new ids change the catalog hash; a host that
  pins `catalogHash` refuses envelopes written for the `0.7.0` catalog
  (`catalog-mismatch`) until it pins the new hash.
- **`aria-required` inside a `Field`:** it lands only on roles that
  support it; a `DatePicker`, `DateRangePicker`, `TimeField` or `Slider`
  gets native `required` on its inputs, and a `ColorPicker` drops it. A
  test or selector that expected it on every control needs an update.
- **Component labels from one catalog:** `texuli` and
  `@texuli/primitives` labels resolve through `@texuli/core/i18n`; the
  English defaults stay and label props still win, but check labels an
  app set another way.

Not breaking: `validateDraft` takes `checkForm`, `checkCanvas` and
`checkSheet`; the player takes `formHost`, `canvasHost`, `sheetHost`,
`sourceRegistry` or `sourceLoader`, and `print`.

New APIs in `0.8.0` (none of them in `0.7.0`) are listed in
[`../../build-ui/references/imports.md`](../../build-ui/references/imports.md).

## 0.7.0: breaking changes

This sub-skill never upgrades packages; moving an app from `^0.6.0` to
`^0.7.0` is the developer's install ([`../../components/SKILL.md`](../../components/SKILL.md)).
`0.7.0` publishes `@texuli/document` and `@texuli/pages` for the first time;
an app that does not use them sees only these changes. Before the move,
check the app for:

- **Spec 0.7.0:** validated drafts carry `spec: "0.7.0"`; a host that
  compares the string must accept it. A `0.7.0` envelope with node keys or
  a `document` node is refused by `0.6.0` validators, so upgrade the
  validating side first.
- **A new catalog hash:** the `document` id changes the catalog hash; a
  host that pins `catalogHash` refuses envelopes written for the `0.6.0`
  catalog (`catalog-mismatch`) until it pins the new hash.
- **`EditOp` gains `patchDocument`:** an exhaustive `switch` over `EditOp`
  or `EditOpKind` (`@texuli/catalog/edit`) needs a branch;
  `applyEditOps` and `applyEditOp` take an optional third argument, and
  without its `patchDocument` patcher that op is refused (`invalid-op`).

Not breaking: nodes may carry an optional `key` (unique in the tree),
`RenderNode` carries it, the player takes a `documentHost`, and the
`texuli` bin gains a `document` command.

New APIs in `0.7.0` (none of them in `0.6.0`) are listed in
[`../../build-ui/references/imports.md`](../../build-ui/references/imports.md);
agent documents are stage I of [`../../blueprints/SKILL.md`](../../blueprints/SKILL.md).

## 0.6.0: breaking changes

This sub-skill never upgrades packages; moving an app from `^0.5.0` to
`^0.6.0` is the developer's install ([`../../components/SKILL.md`](../../components/SKILL.md)).
Under 0.x a new minor may break. Before that move, check the app for:

- **Field ids reach the focusable control:** `FileUpload`'s `id` lands on
  the file input and `TagsInput`'s on its text input (both were on the
  wrapper); `DatePicker`, `DateRangePicker` and `TimeField` put `id` on
  their first segment and, inside a `Field`, hide their own label (the
  Field's label names them).
- **`InputGroup`:** `id`, `aria-*`, `data-*` and handlers reach the input
  (`aria-*` and `data-*` were on the group).
- **Caller handlers on more parts:** menu items, the navigation menu, toast
  roots and viewports, the tree, splitter handles, the command input, the
  carousel and the input group run a caller's handler first, then their
  own unless the caller called `event.preventDefault()`; they no longer
  drop or replace it.
- **`texuli/avatar`:** `data-avatar` is `initials` after an image error.
- **Dates:** `@texuli/primitives/date-field` (and the styled date
  controls) report no value until the year has four digits.
- **Reduced motion is `0s`:** `base.css` and the player set durations and
  delays to `0s` (it was `0.01ms`), so no `transitionend` fires under
  reduced motion.
- **Motion through the runtime:** the toast, tooltip and slides stage CSS
  keyframes (`tx-toast-in`, `tx-toast-out`, `tx-tooltip-in`,
  `tx-deck-slide-*`) are gone; a closing overlay stays mounted, `inert`,
  until its exit ends (at most 1.2 s). Override with the `motion` prop or a
  `MotionProvider` from `texuli/motion`, not CSS keyframes; tests that
  expect an overlay to leave at once run under reduced motion or
  `motion={false}`.
- **`Toaster`:** no top-layer viewport while it has no toasts.
- **`@texuli/chat`:** the day separator is its own row above the avatar and
  bubbles; CSS on the old structure needs a look.
- **Types:** `FilterCondition.operator` widens to
  `FilterOperator | FilterCustomOperatorId` (add a default branch to an
  exhaustive `switch`); `AccordionRootProps` and `SliderRootProps` members
  are type aliases.
- **Spec 0.6.0:** validated drafts carry `spec: "0.6.0"`; a host that
  compares the string must accept it.

Not breaking: `DeckStage` now preloads its default renderers in server
builds, so the server render keeps slide content; `DateRangePicker`'s
`onInvalid` gains a third `{ side }` argument.

New APIs in `0.6.0` (none of them in `0.5.0`) are listed in
[`../../build-ui/references/imports.md`](../../build-ui/references/imports.md).

## 0.5.0: breaking changes

This sub-skill never upgrades packages; moving an app from `^0.4.0` to
`^0.5.0` is the developer's install ([`../../components/SKILL.md`](../../components/SKILL.md)).
Under 0.x a new minor may break. Before that move, check the app for:

- **`texuli/input`:** with `type="number"` or `type="range"`, `bind:value`
  holds a `number`, or `null` while empty (it was the field's text);
  `onValueChange` still receives the text. With `type="file"`, `files`
  starts as `null` and resets with `null`.
- **Caller handlers compose:** a handler passed to `Input`, `Textarea`,
  `InputGroup` and `TextCounter` (`oninput`), to `CopyButton` and to 14
  primitive parts (`onclick`, `onkeydown` and others) runs first and no
  longer replaces the built-in one; call `event.preventDefault()` in a click
  or key handler to skip the built-in behavior.
- **`Tag`:** the remove button is named "Remove {label}" (it was
  "Remove: {label}"); a `removeLabel` prefix gets the label appended
  without a colon.
- **`toast`:** the store owns the auto-dismiss timers; they count from
  publication, with or without a mounted `Toaster`, and each toast settles
  exactly once (`onSettle(reason)`).
- **`DeckStage`:** the default renderer tables load on first use, so the
  first stage paints a polite loading status (`aria-busy`) for one chunk,
  also on the server. Await `loadDefaultDeckRenderers()` (or, with
  `defaultRenderers={false}`, `loadBuiltinDeckBlocks()`) before mounting to
  paint at once.
- **`texuli/layouts/content`:** `TocItem.level` and `TocHeading.level`
  widen from `2 | 3` to `2 | 3 | 4 | 5 | 6`; exhaustive checks need the new
  levels.
- **Callback names:** `onStop`, `onCopy`, `onCopyError` and `onSettle` are
  camelCase props, not the native DOM events.

New APIs in `0.5.0` (none of them in `0.4.0`) are listed in
[`../../build-ui/references/imports.md`](../../build-ui/references/imports.md);
`@texuli/editor` is published for the first time.
