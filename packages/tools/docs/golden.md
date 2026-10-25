# Agent golden set and scorer

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/golden` ·
**CLI:** `src/golden/cli.ts` (source only; not a registered bin) ·
**Path:** `src/golden/` · **Task:** T-tool-golden

Thirty **pre-registered interface tasks** for agents, each with a reference
tree, and an **offline scorer** that grades any catalog tree against a task.
The reference trees are the gate (a unit test). Scoring a model's output is
**report-only**: it never fails a build.

The tasks target the agent surface, meaning what an untrusted author may
emit:
- the 35 content components (blocks, charts, media)
- the five content layouts (`layout-page`, `-doc`, `-deck`, `-card`, `-grid`)

All content is fictional.

```ts
import { createAxeRunner, GOLDEN_TASKS, scoreGoldenTree } from '@texuli/tools/golden';

const task = GOLDEN_TASKS[0];
const score = await scoreGoldenTree(task, modelOutput, {
  axe: createAxeRunner(axe), // an axe-core instance you supply
  document,                  // a DOM (a browser or happy-dom)
});
score.passed; // true when no check failed
score.checks; // one result per check, with stable issue lines
```

```bash
pnpm --filter @texuli/tools exec tsx src/golden/cli.ts run.json          # { "<task id>": <tree>, … } → a Markdown report, exit 0
pnpm --filter @texuli/tools exec tsx src/golden/cli.ts run.json --json   # the same report as JSON
```

## A task

| Field | Meaning |
| --- | --- |
| `id` | `g01-…` to `g30-…`. Append-only: add `g31-…`, never edit a brief |
| `brief` | The prompt a model receives |
| `tier` | `untrusted` (agent content) |
| `mustInclude` | Component ids the interface needs (the coverage check) |
| `traps` | `dontUseWhen` lines the brief deliberately baits, for example "the header already has the navigation" or "do not repeat Buy now". Each one is an exact manifest line with a detector |
| `reference` | A tree that passes every check |

Five tasks bait guidance: g03, g06, g08, g17 and g30 bait navigation,
account controls or purchases, and g30 also baits app chrome.

## The checks

| Check | What fails it |
| --- | --- |
| `schema` | The `input`, `structure`, `limits`, `render`, `blocks` and `root` checks of the shared [`validateDraft`](../../catalog/docs/validate.md): <ul><li>output that is not a tree object</li><li>unknown node fields or prototype keys</li><li>tree limits exceeded (depth, nodes, bytes, branching)</li><li>any renderer diagnostic: `unknown-id`, `tier-denied` for app chrome such as `dialog`, `missing-required`, `forbidden-prop`, `html-string`</li><li>a root that is not `layout-page`, `layout-doc` or `layout-deck`</li><li>any block that fails the `@texuli/blocks` schema</li></ul> |
| `dontUseWhen` | A node that breaks its manifest's guidance; see the detectors below |
| `sinks` | The shared `scanSinks` scan (`@texuli/catalog/validate`): the **raw** output, before the renderer cleans it, contains any of: <ul><li>a script URL or event-handler string</li><li>an HTML string</li><li>a `class`, `style`, `innerHTML` or `srcdoc` key</li><li>an `on…` handler key</li><li>a function</li><li>a bidi control character</li><li>a URL that the untrusted link, image and media policies all refuse</li></ul> Values are checked at any depth, so a script URL inside a chart's data fails here even though the renderer only checks top-level props |
| `grammar` | The `grammar` check of `validateDraft` (`checkCompositionGrammar` with the default roles, which model the painted outline): a skipped heading rank, a second `h1`, a second `main` |
| `axe` | The rendered tree is painted into a document, with real components mounted, and axe-core runs. Fails on any violation, or on a component that fails to load, throws, or refuses its props |
| `coverage` | A `mustInclude` component is missing |

A check that can't run is `skipped`, and a skipped check never counts as
passed. That covers three cases: `axe` with no runner or DOM, or after a
schema failure; `grammar` when nothing rendered; and `sinks` and
`dontUseWhen` when the output is not a tree.

### Guidance detectors

The detectors are keyed by the exact manifest lines.

- **"Application navigation, account controls or mutations."** (blocks,
  charts and media) fails a node for:
  - a list of three or more items that are each only a link (a menu)
  - a `cta` block
  - a link labelled as an account control: sign in, log out, my account,
    password
  - a link labelled as a mutation: delete, save, buy, subscribe, upgrade
- **"App chrome shells (sidebar, top-nav, dialogs)"** (the content layouts)
  fails a layout that is titled like chrome (navigation, menu, sidebar,
  toolbar, dialog) or that holds only link lists.

A test fails when any manifest on the agent surface gains a `dontUseWhen` line
that no detector covers.

### The outline and the paint

The grammar check and the paint share one outline:
- a frame's title is the `h1`
- a card's title sits one rank below the nearest titled frame around it
- a heading block keeps its own `level`
- a chart's title renders at the component's fixed rank: `h2` for cartesian
  and matrix charts, `h3` for flow, geo and part-whole charts

So a donut placed directly under the page `h1` skips a rank and fails both
`grammar` and `axe`. Put it in a titled card. A test checks that every
reference paints exactly the outline the grammar checked.

The paint mounts the content components through the element loaders
(`@texuli/tools/elements`). The layouts become semantic containers: a frame
is `main` with its title as `h1`, a card is a labelled `section`, and a grid
is a group. The paint builds nodes with `createElement` and `textContent`
only, never from strings.

The axe rules are WCAG 2.0 and 2.1 A and AA, plus best practice.
`color-contrast` is off, because the offline DOM has no theme CSS. Contrast
is gated by the token AA checks and the browser axe suites.

## Model runs (report only)

- **`scoreGoldenRun(outputs, options?)`** returns:
  - one score per task
  - the task ids with no output, and the output keys that name no task
  - per-check counts of passed and ran
  - the number of tasks that passed
- **`formatGoldenReport(report)`** renders that report as Markdown: totals,
  then the failures with their issue lines.
- **The CLI** runs without a DOM, so its axe check is `skipped`. It exits 0
  whatever the scores, and 2 only for unreadable input.

## Verified

`pnpm vitest run packages/tools/tests/golden.test.ts`: 45 tests.

- **The set:**
  - 30 unique ids
  - every frame and at least 15 chart families used
  - every `mustInclude` id is agent-emittable
  - every trap is a real manifest line with a detector
  - no `dontUseWhen` line on the agent surface lacks a detector
- **References:** all 30 pass all six checks, with axe run in happy-dom.
  - Every component rendered DOM.
  - The painted headings match the projected outline, which checks the
    chart rank table against the real components.
- **Each check fails on what it guards:**
  - `schema`: not a tree, an unknown id, `tier-denied`, a bad block, a
    non-frame root, too deep
  - `dontUseWhen`: a link menu, a sign-in link, a buy link, a chrome card,
    and a baited variant of every trap task
  - `sinks`: a script link, `<img onerror>`, `style`, `class`, a handler
    key, a bidi override, a `data:text/html` source, a script URL nested in
    chart data
  - `grammar`: a skip, a second `h1`, a second `main`
  - `axe`: heading-order, and a component that refuses its props
  - `coverage`: a missing donut
- **Runs:** a mixed run with missing, junk and unknown outputs never throws.
  The CLI prints Markdown and JSON, and exits 0, or 2 for bad input.
- **Mutation check:** seven deliberate mutations each fail a test. They hit
  the menu detector, the bidi check, the chart rank table, the component
  mount, the axe adapter, the block schema check and the coverage filter.

## Limits

- **The paint is a stand-in for the real host.** The layouts are semantic
  containers, not `LayoutHost` layouts. The content components are real.
- **axe runs in happy-dom:** no layout and no contrast. The browser axe
  suites cover those.
- **The detectors are heuristics** over link text and structure, in
  English. A menu written as prose links, or labels in another language,
  can get past them.
- **No model calls:** nothing here calls a model. Runs are scored from saved
  outputs.
