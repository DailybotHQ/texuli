# Coding standards — Texuli

These rules come from the real configuration (`tsconfig.base.json`,
`biome.json`) and the code that exists today. `AGENTS.md` lists the
mandatory subset; this file explains them.

## TypeScript

- **Strict and erasable.** `tsconfig.base.json` sets `strict`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`, `isolatedModules` and
  `noUncheckedIndexedAccess`. No enums (use an `as const` array or object plus
  a union type), no constructor parameter properties, no namespaces.
- **Type-only imports and exports** are marked: `import type { … }` or the
  inline form used in `packages/core/src/index.ts`:
  `export { type HrefTrust, safeHref } from './url/safe-href.ts';`
- **Relative imports keep the `.ts` extension** (`'./url/safe-href.ts'`,
  `'../src/index.ts'`); `allowImportingTsExtensions` is on.
- **Packages export source.** A package's `exports["."]` points to
  `./src/index.ts`. The barrel is the public API; anything not exported from
  it is private.
- **Indexed access is `T | undefined`.** Guard it or use `?.`
  (`safe-href.ts` reads `exec(href)?.[1]?.toLowerCase()`). Non-null
  assertions (`!`) are allowed only in tests (Biome override for
  `**/tests/**` and `**/*.test.ts`).
- **Fail closed in policy code.** Texels that judge input return a safe empty
  value (`safeHref` returns `undefined`) instead of throwing, and document
  the contract in a JSDoc block above the export.

## Svelte 5 and Astro

- **Runes only:** `$props()`, `$state`, `$derived`, `$effect`, `onclick`,
  snippets. No `export let`, no `on:click`, no `$:`, no slots.
- **No `{@html}`** on anything that comes from props, content or an agent.
- **Astro components** keep logic in the frontmatter and styles scoped;
  global tokens come from `@texuli/tokens` (`base.css` and the compiled
  theme CSS, as in `apps/website/src/layouts/ExamplePreviewLayout.astro`).

## Component API contract

Every exported Svelte component in `@texuli/primitives` and `texuli` follows
one contract. `packages/primitives/tests/contract.test.ts` and
`packages/texuli/tests/contract.test.ts` derive the component list from the
package `exports` and check every entry (a new export without a case fails),
and the texuli file also checks the Field rule below. Today the layouts
(`texuli/layouts/*`) are excluded as planned work: they join in a follow-up
task.

- **Rest attributes and `ref`.** Attributes a component does not consume
  (`id`, `aria-*`, `data-*`, `class`, `style`, handlers) land on its root
  element, and `bind:ref` binds that same element (`HTMLElement | null`;
  `SVGSVGElement` for icons). An overlay part's `ref` is `null` while it is
  closed. A part rendered through a `child` snippet leaves the element to the
  consumer, so `ref` stays `null`; bind your own element.
- **Form controls split.** A styled control that wraps its focusable control
  in a field wrapper (Checkbox, Switch, Radio, Slider, TagsInput, TextCounter,
  FileUpload, Rating, DatePicker, DateRangePicker, TimeField) sends `aria-*`,
  `data-*`, handlers and the form and focus attributes to the control, and
  layout hooks (`style`, `hidden`) to the wrapper; `ref` is the wrapper, which
  contains the control. Input, Textarea and InputGroup have no separate root:
  everything, `ref` included, is the input.
- **The Field rule.** The `id`, `aria-describedby`, `aria-invalid` and
  `disabled` a `Field` hands its control (`{...control.props}`) reach the
  focusable element, so `<label for>` focuses it and its description and error
  are announced: the input of TagsInput and FileUpload (`inputId` works
  too), the first thumb of a Slider, the first segment of DatePicker,
  DateRangePicker and TimeField. Inside a Field, those three date controls
  hide their own label and are named by the Field label (`hideLabel` does
  the same outside one). Group controls with no labelable element (RadioGroup,
  Rating, ColorPicker) take the `id` on the group.
- **Providers render nothing.** Roots that only hold state (menu, select,
  popover, dialog, tooltip, toast provider roots) and portals render no
  element of their own, so they take no `ref` or rest attributes; the
  contract tests list them as exclusions with that reason.
- **Handler order: the caller first.** A caller's DOM handler never replaces
  the component's own. It runs first; then:
  - for actions (`onclick`, `onkeydown`, `onpointerdown`, `onpointerenter`)
    the component's behavior runs unless the caller called
    `event.preventDefault()` (`composeHandlers`);
  - for bookkeeping that must not be skipped (`onfocus`, `onblur`,
    `onfocusin`, `onpointerleave`, `onscroll`, drag state) the component's
    behavior always runs (`chainHandlers`); `focus` and `blur` cannot be
    prevented anyway.
  - **Value sync is the one exception:** Input, Textarea, InputGroup and
    TextCounter update `value` first and then call the caller's `oninput`, so
    the caller reads the new value. `input` cannot be prevented, so the order
    changes nothing a caller could veto.
- **Callback naming.** Lowercase `on<event>` props are DOM handlers and reach
  the root element (or the control, for split controls). camelCase `on<Name>`
  props are component callbacks with a typed payload (`onValueChange`,
  `onOpenChange`, `onSelect`, `onDismissRequest`, `onCloseAutoFocus`,
  `onSettle`, `onCopy`, `onStop`), never DOM events; a callback that can be
  vetoed receives an event with `preventDefault()` (`onSelect`,
  `onDismissRequest`, `onCloseAutoFocus`).
- **`onValueChange` payloads** carry the same type as `bind:value`, after the
  component normalized it: strings for text controls, `string[]` for multiple
  selection, `number` for numeric fields and sliders, `YYYY-MM-DD` strings (or
  `null`) for dates. The rule is that it reports changes the person (or the
  component) makes, not a value the host sets; this is not yet checked by a
  test across every component. `Input` with `type="number"` is the
  exception: `bind:value` holds a number, and `onValueChange` reports the
  input's text, so a partial entry (`-`, `1e`) reaches the caller as typed.
- **`headingLevel`** is the level of the component's top-level visible
  heading (2–6); nested headings go one level deeper, capped at 6. Examples:
  NotificationInbox (`@texuli/data`): the inbox heading (default 2); Board:
  the column headings (default 3), with swimlane titles one level deeper
  (at 6 they share level 6); texuli Accordion: the item headers (default 3).
  Board also renders a visually hidden board title one level above its
  columns (none at 2); that hidden heading is the one documented exception.

### Motion prop contract

Components that move take one `motion` prop and animate only through the
shared runtime, `@texuli/core/motion`
([ADR-013](DECISIONS.md#adr-013-motion-runtime-web-animations-with-an-owned-spring-solver);
reference: [ui-motion](../packages/texuli/docs/ui-motion.md)).

- **One shape:** `motion?: { enter?, exit?, layout?, duration? } | false`.
  `enter` and `exit` name a preset from the spec's closed vocabulary
  (`fade`, `rise`, `scale`, `slide-start`, `slide-end`, or `false`),
  `layout` turns layout animation on or off (FLIP for reorders, inserts and
  removes; the tabs indicator; accordion height), `duration` names a token
  step (`fast`, `base`, `slow`). `false` turns the component's motion off.
  Never CSS, keyframes or milliseconds; unknown names fall back to the
  component's default (`texuli/motion`, `resolveComponentMotion`).
- **The level comes from context:** `MotionProvider` (`full`, `subtle`,
  `none`, and an optional `reducedMotion` override) sets it for a subtree; a
  nested provider can only lower it. Components read it at init through the
  `texuli/motion` seams; they never read `prefers-reduced-motion` on their own.
- **Instant when it must be:** reduced motion, level `none` and
  `motion={false}` commit the end state at once; nothing animates on the
  server or for content present on the first render (hydration).
- **Overlays release interaction at close:** focus returns, `inert` lifts
  and the layer stack lets go when an overlay closes; only its exit (the
  part held mounted, `inert`, `data-state="closed"`) waits. Primitives take
  the hooks as `motionHooks` and animate nothing without them.
- **No CSS-only enter or exit motion and no lasting inline style:**
  presence and layout motion play through the runtime with `fill: "none"`;
  end states live in classes and attributes. CSS transitions remain for
  hover and focus feedback and for direct manipulation (a drawer's drag
  snap).
- **A test per component** with the Web Animations stand-in
  (`packages/core/tests/motion-fakes.ts`) proves it calls the runtime and is
  instant under reduced motion and at level `none`.

## CSS

- **Logical properties** where direction matters: `inline-size`,
  `block-size`, `margin-inline`, `margin-block`, `padding-inline`,
  `inset-inline-start`, `border-inline-start`. The website already follows
  this (`max-inline-size`, `margin-inline`, `margin-block-start`).
- Colors and surfaces come from custom properties, never hard-coded inside a
  component when a token exists.
- Respect `prefers-color-scheme`, `forced-colors` and
  `prefers-reduced-motion`; the styled components already carry
  `forced-colors` and reduced-motion rules.

## Formatting and lint (Biome 2.5.15)

- Two-space indent, line width 100, single quotes, semicolons, ES5 trailing
  commas. Biome is the formatter of record; do not hand-format against it.
- `useImportType` is off (the compiler enforces type imports through
  `verbatimModuleSyntax`), and unused-variable rules are relaxed for
  `.svelte` and `.astro` files because the compiler sees template usage.
- Suppressions need a reason, as in `safe-href.ts`:
  `// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are the target`.
- Never weaken `biome.json` or `tsconfig.base.json` to make a check pass;
  they are owner-held files.

## Naming

- Files: `kebab-case.ts` (`safe-href.ts`); tests are named after the area
  or subpath (`packages/core/tests/url-policy.test.ts` covers `src/url/`
  and `src/url-policy/`). Svelte and Astro components: `PascalCase`
  (`TexelsDiagram.astro`).
- Packages: `@texuli/<name>` for workspace packages; the styled package
  is the unscoped `texuli`.
- Folders inside `src/` group a concern (`src/url/`).

## Accessibility

- Every interactive element has an accessible name; icon-only controls need
  a label.
- Keyboard: Tab order follows visual order; Escape closes the topmost layer
  only; focus returns to the trigger when a layer closes.
- Overlays make the outside `inert` and lock scroll while modal.
- Decorative graphics carry `aria-hidden="true"` (as in
  `TexelsDiagram.astro`).

## Dependencies

- No runtime dependency on another component library. No runtime dependency
  in `@texuli/core`.
- Adding a dependency means editing the package's `package.json` and asking
  the lockfile owner to run `pnpm install`.

## Honesty in docs

- Mark planned work as planned. Never document a command you did not run or
  a number you did not measure.
