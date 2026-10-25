# Separator

**Package:** `@texuli/primitives` · **Import:** `@texuli/primitives/separator`

A headless separator, owned end to end. It follows the WAI-ARIA APG static
separator. It is a boundary between sections, or purely visual decoration,
horizontal or vertical: `Separator.Root` with `orientation` and `decorative`.

## Usage

```svelte
<script lang="ts">
  import { Separator } from '@texuli/primitives/separator';
</script>

<Separator.Root />                                  <!-- semantic, horizontal -->
<Separator.Root orientation="vertical" />           <!-- semantic, vertical -->
<Separator.Root decorative class="my-rule" />       <!-- visual only -->

<Separator.Root>
  {#snippet child({ props })}<hr {...props} />{/snippet}
</Separator.Root>
```

`SeparatorRoot` is the same component as `Separator.Root`.

## Props

| Prop | Default | |
| --- | --- | --- |
| `orientation` | `horizontal` | `horizontal` or `vertical` |
| `decorative` | `false` | `true` hides it from assistive technology |
| `ref` | — | Bindable: the rendered element |
| `child` | — | Snippet `({ props })`: render your own element and spread `props` on it |
| any `<div>` attribute | — | Passed through (`class`, `id`, `data-*`, …) |

## What it renders

| | `role` | `aria-orientation` | `data-orientation` |
| --- | --- | --- | --- |
| semantic, horizontal | `separator` | none (ARIA's default is horizontal) | `horizontal` |
| semantic, vertical | `separator` | `vertical` | `vertical` |
| decorative | `none` | none | the orientation |

It always renders `data-separator-root`. The role and orientation belong to
the separator: a consumer `role` or `aria-orientation` never overrides them. It
is a static separator, so it never takes focus. It renders no styles: draw the
line with your own CSS, using `data-orientation` to choose the axis.

`separatorAttributes({ orientation, decorative })` returns the same attributes
for any element, outside Svelte.

## Behavior

`tests/behavior/scenarios/separator.spec.ts` runs on Chromium, WebKit and the
Pixel 7. It has four rows:
- a decorative separator is not announced;
- a semantic separator is horizontal by default;
- a vertical one says so;
- none takes focus.

Every row passes on all three projects. A horizontal semantic separator does
not write `aria-orientation="horizontal"`: that is ARIA's default, so the
accessibility tree reports the orientation without it.

## Size

`@texuli/primitives/separator`: **835 B gzip** (744 B brotli, `pnpm size`,
2026-10-24), against a task
budget of ≤ 1 KB and the default 4 KiB for a primitive.

## Tests

```bash
pnpm vitest run packages/primitives/tests/separator.test.ts
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/separator.spec.ts
```

The 10 unit tests cover:
- the attribute rules (default, vertical, decorative, unknown orientation);
- rendering;
- decorative hiding;
- authoritative semantics over passed-through attributes;
- `ref`;
- the `child` snippet.
