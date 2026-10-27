# Button, IconButton and ButtonGroup

**Package:** `texuli`  
**Import:** `import { Button, IconButton, ButtonGroup } from 'texuli/button'`  
**Tests:** `packages/texuli/tests/forms.test.ts`, `packages/texuli/tests/contracts.test.ts`  
**Example:** `texuli-button` (`packages/examples/src/button/`)

## Contract

Styled controls on the `--tx-*` token contract and `@layer tx.components`:

| Component | Role |
| --- | --- |
| `Button` | Text button or safe link; variants, sizes, loading |
| `IconButton` | Square icon control; requires `label` (accessible name) |
| `ButtonGroup` | `role="group"` with optional attached edges |

### Variants

`default` · `secondary` · `outline` · `ghost` · `destructive` · `link`

### Sizes

`sm` · `md` · `lg` · `icon` (IconButton always uses `icon`)

### Plain-text label

`label` (optional string) gives the button plain text without a snippet. It is
rendered as escaped text (never markup), and a non-empty `label` replaces
`children` when both are given; an empty or missing `label` keeps `children`.
Tested in `packages/texuli/tests/forms.test.ts`.

```svelte
<Button type="submit" label="Save changes" />
```

While loading, the label sits in the visually hidden label span, as `children`
do.

### Loading

- `loading` shows a spinner and sets `aria-busy`
- When `onclick` returns a promise and `autoLoading` is true (default), the
  button stays pending until the promise settles
- Wire services as `onclick={() => runService(...)}` so the returned promise
  drives pending feedback

### Links

`href` is filtered with `safeHref` from `@texuli/core/url-policy` (default trust
`developer`). Unsafe values render a disabled button with `data-href-blocked`.

### Element ref

`bind:ref` exposes the rendered root (`HTMLButtonElement` or `HTMLAnchorElement`),
matching the primitives pattern. The ref is `null` after unmount.

### Class composition

Uses Texuli’s own `cx` and `variants` (`packages/texuli/src/internal/`). No
`clsx`, `tailwind-merge`, or `tailwind-variants`. Consumer `class` props append
after component classes; cascade layer order lets consumer CSS win. See
[Using Texuli with your own CSS](./using-with-your-css.md) for the host layer
contract (element defaults before `tx.base`; never unlayered global `a {}`).

### A11y

- Focus-visible ring from tokens
- Disabled / busy block activation
- IconButton requires `label` → `aria-label`
- Forced-colors border fallbacks
- Reduced motion stops the spinner animation

## Example axes

The `texuli-button` example covers default variants, sizes, states (disabled,
loading, async, blocked href), group, RTL, and dark (`data-tx-mode="dark"`).
