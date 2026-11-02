# Live primitive demos

**Task:** T-site-live-primitives · **Spec:** `tests/e2e/site-live-primitives.spec.ts`

Every `/primitives-page/<id>/` page (42 primitives) mounts the **real
primitive** from `@texuli/primitives/<id>` in a live, framed preview. It is
styled with Texuli's own exported class recipes (for example
`accordionRootClass` from `texuli/tabs-accordion`, `dialogContentClass` from
`texuli/dialog`): the same composition the styled components use. There are
no screenshots, JSON cards or stand-ins.

```bash
bash -c 'pnpm build && TEXULI_E2E_PORT=<lane port> pnpm exec playwright test tests/e2e/site-live-primitives.spec.ts'
```

## What a demo page shows

| Piece | What it does |
| --- | --- |
| **Frame** | A preview card with a **Light / Dark** segmented control and a **Right to left** switch. Both are scoped to the preview (`data-tx-theme`, `data-tx-mode`, `dir` on the stage), so the page theme is untouched. Floating parts portal into the stage, so overlays follow the frame's mode and direction too |
| **Uncontrolled and controlled panels** | Side by side (stacked on phones). Uncontrolled: the primitive owns its state, from a plain initial value or the primitive's `default…` prop. Controlled: `bind:` keeps the state in the page, an `<output>` shows it and buttons outside the primitive change it |
| **Props panel** | Built from each demo's prop specs in the manifest prop kinds: enum → segmented control (`ToggleGroup`), boolean → `Switch`, number → `Slider`, string → `Input`. **Reset props** restores the defaults |
| **Code sample** | Generated from the current props with the primitive's real API (`Code` from `texuli/kbd-code`), and updated as the props change |
| **Keyboard hints** | The keys the primitive handles (from its source and the APG pattern). A hint lights up and a status line names it when its key is pressed in the preview |
| **Anatomy bridge** | Every rendered part carries `data-demo-part="<anatomy part>"`. Hovering or focusing a part outlines it and highlights its box in the anatomy diagram, and the part name is shown. Hovering a diagram box outlines every instance of that part in both panels |

## How it is built

- **`live/LiveDemo.svelte`** is the frame, mounted with `client:visible`.
  Astro hydrates it through an `IntersectionObserver`. On mount, the frame
  fetches the primitive's demo chunk, so a page pays for its demo only once
  the demo is in view.
- **`live/registry.ts`** holds `import.meta.glob('./demos/*.svelte')`: one
  lazy chunk per primitive, named after its subpath.
- **`live/demos/<id>.svelte`** is the demo. Its `<script module>` exports a
  `spec` (props, keyboard hints, panel notes, `code(values)`, a key check and
  a control check). The component takes `{ values, mode, portal, dir }`.
- **`live/PropsPanel.svelte`** builds the props panel from `spec.props`.
- **`live/types.ts`** holds the spec types and the small readers and
  code-sample helpers.
- `AnatomyDiagram.astro` styles the highlighted box (`data-hot`), with a
  forced-colors variant.

The frame mirrors each demo's key and control checks as data attributes,
so the browser spec runs exactly the checks the demo declares, and a hint
cannot drift from the behavior.

## What the spec checks

On the representative primitives (accordion, dialog, menu, select, slider,
tabs), on Chromium, in three tests since the 2026-10-27 trim: the
interactions (a fresh load of the page for each), axe plus the polish check
in each mode, and the toast pages plus the transfer budgets:

- **Lazy loading:** every primitive page's island is `client:visible`
  (pinned in `apps/website/tests/component-pages.test.ts`); on a short
  screen the demo stays unloaded until scrolled into view, and its
  server-rendered stage already wears the page's dark tokens before it
  hydrates.
- **Styled and interactive:** both panels render with Texuli-styled parts.
  The controlled panel's outside control changes the primitive's state.
- **Keyboard:** focus the declared part (opening floating content first when
  needed), press the declared key, and assert the resulting state. The
  matching hint lights up and the status names it. The reference's rows
  disclosure opens from the keyboard.
- **Anatomy:** every `data-demo-part` is a real anatomy part. Hover and
  focus highlight the diagram box, and hovering the box highlights the
  demo parts.
- **Props:** every prop, through its own control, changes the code sample.
- **Frame:** the Dark toggle changes the stage's computed background, and
  the RTL switch sets `dir="rtl"`.
- **axe, zero exclusions,** in light, dark and forced colors, with the demo
  mounted and the API rows (`details`) open, and again with floating content
  open where the demo has some; the polish check of
  [site-visual](site-visual.md) in light and dark. The other primitive pages
  share the template; every primitive's keyboard, pointer and axe contract
  runs in its behavior scenario (`tests/behavior`), and `a11y-site-<n>.spec.ts`
  sweeps the group's representative page.
- **Toasts:** the toast primitive page and the Toaster component page place
  live toasts on click, axe clean in every mode.
- **Budget:** each representative route stays within the site default
  before its demo is seen and within `budgetFor(route)` with it loaded.

## Measured (2026-10-23, gzip)

| State | JavaScript | Page weight |
| --- | --- | --- |
| Before the demo scrolls into view (any primitive) | 51.7 KB (default budget 64) | about 106 KB |
| Demo loaded, lightest (separator) | 73.7 KB | 128.3 KB |
| Demo loaded, heaviest (date-picker) | 97.7 KB | 154 KB |

Primitive routes have their own budget in `components/perf/budgets.ts`
(`jsGzipKb: 108`, `pageGzipKb: 160`), with the reason recorded. The demo
is at the top of the page, so on a desktop viewport it loads at open. The
untouched `/primitives-page/` index already weighs about 101 KB, so the
docs shell alone is above the 96 KB page default.

**Demo CSS:** the registry only globs the demos in the browser build. That
keeps their CSS out of every page: each demo's CSS loads with its chunk.

**Library fixes made for the demos:**
- Every `packages/texuli/src/components/*/variants.ts` now imports its
  component CSS, so composing a primitive with a recipe gets the styles.
- The uncontrolled `Switch` primitive (`defaultChecked`, no binding)
  re-renders when toggled. A regression test is in
  `packages/primitives/tests/forms.test.ts`.

## Limits

- Hints list the main keys of each pattern, not every key a primitive
  handles (for example type-ahead). The spec presses one declared key per
  primitive.
- Hover highlighting needs a pointer. On touch screens, focus (tap) drives
  the bridge.
- The code sample shows the essential markup for the current props, not the
  demo's styling classes.
- The toast viewport is a manual popover in the top layer, and texuli's
  `toast.css` does not reset the browser's popover box for
  `.tx-toaster__viewport`. The toast demo places its viewport with local
  CSS, and the styled `Toaster` shows the default box (an empty bordered
  square). This is reported as a library bug.
- Some styling has no exported recipe: no checkbox-group layout (the demo
  uses the choice group recipe), no sheet title or description recipe, and
  no listbox recipe (it uses the select recipes).
