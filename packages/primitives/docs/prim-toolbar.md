# Toolbar

**Package:** `@texuli/primitives` · **Import:** `@texuli/primitives/toolbar`

A headless toolbar, owned end to end, following the WAI-ARIA APG **toolbar**
pattern: one Tab stop, arrow keys between items, toggle buttons, radio groups,
links and separators, composed as `Toolbar.*` (`Root`, `Button`, `Link`,
`Group`, `GroupItem`, `Separator`).

## Usage

```svelte
<script lang="ts">
  import { Toolbar } from '@texuli/primitives/toolbar';

  let styles = $state<string[]>([]);
  let align = $state('left');
</script>

<Toolbar.Root aria-label="Formatting">
  <Toolbar.Group type="multiple" aria-label="Text style" bind:value={styles}>
    <Toolbar.GroupItem value="bold">Bold</Toolbar.GroupItem>
    <Toolbar.GroupItem value="italic">Italic</Toolbar.GroupItem>
  </Toolbar.Group>
  <Toolbar.Separator />
  <Toolbar.Group type="single" aria-label="Alignment" bind:value={align}>
    <Toolbar.GroupItem value="left">Left</Toolbar.GroupItem>
    <Toolbar.GroupItem value="center">Center</Toolbar.GroupItem>
  </Toolbar.Group>
  <Toolbar.Separator />
  <Toolbar.Button onclick={save}>Save</Toolbar.Button>
  <Toolbar.Link href="/help">Help</Toolbar.Link>
</Toolbar.Root>
```

**Name every toolbar** (`aria-label` or `aria-labelledby`), and every group,
when a page has more than one.

## Parts and props

**`Toolbar.Root`** (any `<div>` attribute):

| Prop | Default | |
| --- | --- | --- |
| `orientation` | `horizontal` | `vertical` also sets `aria-orientation` and switches the arrows to Up and Down |
| `loop` | `true` | The arrows wrap from the last item to the first and back |
| `ref` | — | Bindable: the toolbar element |

It renders `role="toolbar"`, `data-orientation` and `data-toolbar-root`.

**`Toolbar.Button`** (any `<button>` attribute): `disabled`, `ref`, and a
`child` snippet (`{ props }`) to render your own element.

**`Toolbar.Link`** (any `<a>` attribute): `href` passes through the URL policy
(`safeHref`). `hrefTrust` is `developer` (the default) for app links, or
`untrusted` for agent or user content. A rejected href renders no `href` and
`aria-disabled="true"`: the item stays in the toolbar but does nothing. Also
takes `ref`.

**`Toolbar.Group`** (any `<div>` attribute):
- `type`: `single` (one choice, a `radiogroup`; the default) or `multiple`
  (independent toggles, a `group`);
- `value`: bindable; a string for `single` (`''` for none), an array for
  `multiple`;
- `onValueChange`;
- `disabled`: disables every item in the group.

Pressing the chosen item of a `single` group again clears it, as Bits does.

**`Toolbar.GroupItem`** (any `<button>` attribute): `value` (required),
`disabled`, `ref`, `child`.
- In a `single` group it is `role="radio"` with `aria-checked`.
- In a `multiple` group it is a toggle button with `aria-pressed`.
- It renders `data-state="on" | "off"` and `data-value`.

**`Toolbar.Separator`** (any `<div>` attribute): `role="separator"`, oriented
across the toolbar (vertical in a horizontal toolbar). It is never focusable
and is skipped by the arrows.

Every item renders `data-toolbar-item` (exported as `TOOLBAR_ITEM`): the
roving set is the toolbar's `[data-toolbar-item]` elements in document order.

## The APG toolbar

- **One Tab stop.** Tab enters on the first item, or on the item used last;
  the next Tab leaves the toolbar.

  | Key | Effect |
  | --- | --- |
  | ArrowRight / ArrowLeft (horizontal) | Next or previous item, **mirrored in right to left** |
  | ArrowDown / ArrowUp (vertical) | Next or previous item |
  | Home / End | First or last item |
  | Space / Enter | Press the button, toggle or radio (native button behavior) |

- **Disabled items stay focusable** (APG allows it, so keyboard users can
  discover them). They render `aria-disabled="true"` and `data-disabled`,
  never the `disabled` attribute, and clicks and key presses do nothing.
- **Pointer and touch** are native button clicks: a click or tap presses the
  item, and the pressed item becomes the Tab stop.

## Size

`@texuli/primitives/toolbar` is **5,094 B gzip** (4,501 B brotli,
`pnpm exec tsx scripts/size.ts --filter @texuli/primitives/toolbar`,
2026-10-24). That is within its own 5,120 B budget, but over the task's
≤ 2 KB and the default `@texuli/primitives/*` cap of 4,096 B.
About 3.4 KB of it is shared code it reuses rather than copies: the
`@texuli/core/roving` engine (with its keys, direction and typeahead modules),
the primitives' roving attachment and `child` helpers, `safeHref` and the
separator attributes. The toolbar's own six parts add about 1.6 KB.

## Tests

```bash
pnpm vitest run packages/primitives/tests/composites.test.ts
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/toolbar.spec.ts
```

**Unit** (1 test, `-t toolbar`) covers links through the URL policy; the
structure, Tab stop, arrows, disabled items, groups and separators are
behavior rows.

**Browser** (Chromium, WebKit, Pixel 7) covers:
- Tab entry and re-entry on the last item;
- arrows, Home, End and wrap;
- vertical and right to left;
- Space and Enter on toggles and radios;
- disabled items;
- mouse clicks on desktop and taps on the phone;
- named groups, separators and links;
- axe WCAG 2.1 A/AA in light and dark.
