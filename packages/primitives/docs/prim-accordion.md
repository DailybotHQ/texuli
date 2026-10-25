# Primitive: Accordion

**Package:** `@texuli/primitives` · **Subpath:** `@texuli/primitives/accordion` ·
**Path:** `src/accordion/` · **Task:** T-prim-accordion

An owned, headless Svelte 5 accordion that follows the
[APG Accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/). It
supports single and multiple modes, a collapsible option, a heading level per
header, and animated height through presence. The parts are composed as
`Accordion.*`.

```svelte
<script lang="ts">
import { Accordion } from '@texuli/primitives/accordion';
let value = $state('');
</script>

<Accordion.Root type="single" bind:value>
  <Accordion.Item value="shipping">
    <Accordion.Header level={3}>
      <Accordion.Trigger>Shipping</Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content><p>Orders ship within two fictional days.</p></Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
```

## Parts and props

| Part | Renders | Props |
| --- | --- | --- |
| `Accordion.Root` | `div` | `type` (`'single'` or `'multiple'`), `value` (bindable: `string`, `''` for none, or `string[]`), `onValueChange`, `collapsible` (single only, default `true`), `disabled`, `orientation` (`vertical` default, or `horizontal`), `loop` (default `true`), `dir`, `ref` |
| `Accordion.Item` | `div` | `value` (required, unique), `disabled`, `ref` |
| `Accordion.Header` | `h1`–`h6` | `level` (default `3`, clamped to 1–6), `ref` |
| `Accordion.Trigger` | `button type="button"` | `ref`, plus any button attribute. A consumer `onclick` that calls `preventDefault()` cancels the toggle |
| `Accordion.Content` | `div role="region"` | `forceMount` (keep in the DOM while closed, with `hidden`), `ref` |

- Every part accepts a `child` snippet: `{#snippet child({ props })}` renders
  your own element, with `props` spread on its root. A custom header keeps its
  semantics through `role="heading"` and `aria-level`. A custom trigger must
  be a focusable element that handles Enter and Space itself; a `<button>`
  does that natively.
- Every other attribute passes through to the rendered element.

## Accessibility (APG)

- Each trigger is a `button` inside a heading, with `aria-expanded`, and
  `aria-controls` pointing to its panel. Each panel is a `region` labelled by
  its trigger (`aria-labelledby`). Ids come from `$props.id()`, so they are
  unique on the page and identical in SSR and hydration.
- **Keyboard:**
  - Enter and Space toggle (the native button).
  - Tab and Shift+Tab move through every trigger. There is no roving
    `tabindex`, as the APG requires.
  - ArrowDown and ArrowUp move between triggers (ArrowRight and ArrowLeft
    when `orientation="horizontal"`, flipped in RTL). Home and End jump to
    the first and last trigger.
  - Arrows wrap unless `loop={false}`, and skip disabled triggers.
  - A key held with Ctrl, Meta or Alt, or pressed while composing text, is
    left to the platform.
  - A nested accordion keeps its arrows to its own triggers.
- **Disabled:** a disabled item's trigger is natively `disabled`. In a
  single, non-collapsible accordion, the open item's trigger gets
  `aria-disabled="true"`, because it cannot close.

## State attributes and styling hooks

| Attribute | On | Values |
| --- | --- | --- |
| `data-state` | item, header, trigger, content | `open` or `closed` (the content's follows presence, so it reads `closed` while animating out) |
| `data-orientation` | root, item, header, trigger, content | `vertical` or `horizontal` |
| `data-disabled` | root, item, header, trigger, content | present when disabled |
| `--tx-accordion-content-height` / `-width` | content | the panel's measured size, updated on every open and close |

### Animated height

```css
[role='region'][data-state='open'] { animation: tx-open 200ms ease-out; overflow: hidden; }
[role='region'][data-state='closed'] { animation: tx-close 200ms ease-in; overflow: hidden; }
@keyframes tx-open { from { height: 0 } to { height: var(--tx-accordion-content-height) } }
@keyframes tx-close { from { height: var(--tx-accordion-content-height) } to { height: 0 } }
@media (prefers-reduced-motion: reduce) { [role='region'] { animation: none } }
```

A closing panel stays mounted, with `data-state="closed"` and not `hidden`,
until its exit animation or transition ends (the `presence` texel). Without
motion, or under reduced motion, it closes on the next frame.

## Built on

- `@texuli/core/presence` keeps the panel mounted through its exit animation.
- The primitives' internal `createPrimitiveContext` and `ChildSnippet` (see
  `svelte-attachments.md`) provide the context and the child snippet contract.
- Arrow and Home/End handling is local, about 20 lines with the same rules as
  `@texuli/core/keyboard` and `roving`. Importing those texels cost
  about 1.2 KB gzip here, most of it code an accordion never runs.

## Verified

- `pnpm vitest run packages/primitives/tests/accordion.test.ts`: 26 tests
  covering structure, ids, heading levels, the Tab order, `data-*`
  attributes, single, multiple and collapsible modes, disabled items and a
  disabled root, the keyboard rules, nested scoping, `forceMount`, the size
  variables, the exit animation, the child snippet and consumer
  `preventDefault`. Deliberate mutations of the toggle and navigation logic
  fail the tests.
- **Behavior:**
  ```
  pnpm exec playwright test tests/behavior/scenarios/accordion.spec.ts
  ```
  passes 5/5 rows in Chromium, WebKit and the Pixel 7.
- A real-browser probe (Chromium and WebKit, 2026-10-23) checked a CSS height
  animation: the panel measures 118 px open; mid-close it is still mounted at
  95–100 px with `data-state="closed"`; then it is removed. Under
  `prefers-reduced-motion` it closes at once.

## Size

| Measure | gzip |
| --- | ---: |
| `pnpm size` `@texuli/primitives/accordion` (2026-10-24) | **3.94 KiB** (budget 4 KiB) |

The task file's target is 3.5 KB. The entry is about 440 B over it, mostly
from the shared presence texel (1,527 B gzip on its own). Dialog, Popover,
Tooltip and other overlay primitives use the same texel, so an app pays for it
once.

## Limits

- No `hiddenUntilFound` (find-in-page that opens a closed panel). Use
  `forceMount` to keep content in the DOM.
- `forceMount` is read once, when the panel is created.
- The size variables come from `scrollHeight` and `scrollWidth`. A panel
  whose content changes size while open updates them on its next open or
  close.
